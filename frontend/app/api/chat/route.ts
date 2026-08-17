import { NextResponse } from "next/server";

import {
  aiChatRequestSchema,
  aiResponseJsonSchema,
  validateAIResponse,
} from "@/lib/ai/schema";
import { buildAIContextPrompt, COMSOL_AI_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";

type FocusLocation = { x: number; y: number; z?: number };

function locationFitsDataset(
  location: FocusLocation,
  request: ReturnType<typeof aiChatRequestSchema.parse>,
): boolean {
  if (request.dataset.dimension === "2D" && location.z !== undefined) return false;
  return request.dataset.coordinates.every((axis) => {
    const value = location[axis];
    const bounds = request.dataset.bounds[axis];
    return value !== undefined && bounds !== undefined && value >= bounds[0] && value <= bounds[1];
  });
}

function locationsMatch(left: FocusLocation, right: FocusLocation): boolean {
  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function focusPointHasProvenance(
  location: FocusLocation,
  request: ReturnType<typeof aiChatRequestSchema.parse>,
): boolean {
  const verifiedLocations = request.verifiedResults.flatMap((result): FocusLocation[] => {
    if (result.action === "find_max" || result.action === "find_min" || result.action === "nearest_point") {
      return [result.location];
    }
    if (result.action === "statistics") return [result.minLocation, result.maxLocation];
    return [];
  });
  if (verifiedLocations.some((verified) => locationsMatch(location, verified))) return true;

  const numbers = (request.message.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [])
    .map(Number)
    .filter(Number.isFinite);
  return request.dataset.coordinates.every((axis) => {
    const coordinate = location[axis];
    return coordinate !== undefined && numbers.includes(coordinate);
  });
}

function highlightedRowsHaveProvenance(
  rowIndexes: number[],
  request: ReturnType<typeof aiChatRequestSchema.parse>,
): boolean {
  const verifiedIndexes = new Set(
    request.verifiedResults.flatMap((result) =>
      result.action === "filter" ? result.rowIndexes : [],
    ),
  );
  return rowIndexes.every((rowIndex) => verifiedIndexes.has(rowIndex));
}

function requestContextIsValid(request: ReturnType<typeof aiChatRequestSchema.parse>): boolean {
  const expectedCoordinates = request.dataset.dimension === "3D" ? ["x", "y", "z"] : ["x", "y"];
  if (
    request.dataset.coordinates.length !== expectedCoordinates.length ||
    !expectedCoordinates.every((axis) =>
      request.dataset.coordinates.includes(axis as "x" | "y" | "z"),
    )
  ) {
    return false;
  }
  if (
    (request.dataset.dimension === "3D" && !request.dataset.coordinateColumns.z) ||
    (request.dataset.dimension === "2D" && Boolean(request.dataset.coordinateColumns.z))
  ) {
    return false;
  }
  if (
    !request.dataset.coordinates.every((axis) => {
      const bounds = request.dataset.bounds[axis];
      return bounds !== undefined && bounds[0] <= bounds[1];
    })
  ) {
    return false;
  }
  if (!request.dataset.availableFields.includes(request.visualization.activeField)) return false;
  if (
    request.visualization.threshold &&
    !request.dataset.availableFields.includes(request.visualization.threshold.field)
  ) {
    return false;
  }
  if (
    request.visualization.highlightedRegion &&
    !request.dataset.availableFields.includes(request.visualization.highlightedRegion.field)
  ) {
    return false;
  }
  if (
    request.visualization.selectedLocation &&
    !locationFitsDataset(request.visualization.selectedLocation, request)
  ) {
    return false;
  }
  return request.verifiedResults.every((result) => {
    if ("field" in result && !request.dataset.availableFields.includes(result.field)) return false;
    if (result.action === "find_max" || result.action === "find_min" || result.action === "nearest_point") {
      return result.rowIndex < request.dataset.rowCount && locationFitsDataset(result.location, request);
    }
    if (result.action === "statistics") {
      return (
        locationFitsDataset(result.minLocation, request) &&
        locationFitsDataset(result.maxLocation, request)
      );
    }
    if (result.action === "profile") {
      return result.axis !== "z" || request.dataset.dimension === "3D";
    }
    if (result.action === "filter") {
      return result.rowIndexes.every((rowIndex) => rowIndex < request.dataset.rowCount);
    }
    return true;
  });
}

export async function POST(request: Request) {
  const parsedRequest = aiChatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success || !requestContextIsValid(parsedRequest.data)) {
    return NextResponse.json({ detail: "Invalid assistant request context." }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "z-ai/glm-5.2";
  const apiUrl = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1/chat/completions";
  if (!apiKey) {
    return NextResponse.json(
      { detail: "Set OPENROUTER_API_KEY in frontend/.env.local to enable the assistant." },
      { status: 503 },
    );
  }

  const assistantRequest = parsedRequest.data;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": request.headers.get("origin") ?? "http://localhost:3000",
        "X-Title": "COMSOL AI Results Explorer",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: COMSOL_AI_SYSTEM_PROMPT },
          { role: "system", content: buildAIContextPrompt(assistantRequest) },
          ...assistantRequest.history,
          { role: "user", content: assistantRequest.message },
        ],
        temperature: 0,
        max_tokens: 1_200,
        provider: { require_parameters: true },
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "comsol_visualization_actions",
            strict: true,
            schema: aiResponseJsonSchema,
          },
        },
      }),
    });

    const body = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!response.ok || body.error) {
      throw new Error(body.error?.message ?? `OpenRouter returned ${response.status}.`);
    }
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned an empty response.");

    const validated = validateAIResponse(JSON.parse(content), assistantRequest.dataset);
    const unverifiedFocus = validated.actions.find(
      (action) =>
        action.type === "focus_point" && !focusPointHasProvenance(action, assistantRequest),
    );
    if (unverifiedFocus) {
      throw new Error("The assistant returned focus coordinates without a verified source.");
    }
    const unverifiedHighlight = validated.actions.find(
      (action) =>
        action.type === "highlight_points" &&
        !highlightedRowsHaveProvenance(action.rowIndexes, assistantRequest),
    );
    if (unverifiedHighlight) {
      throw new Error("The assistant returned point indexes without a verified source.");
    }
    return NextResponse.json(validated);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The assistant response was invalid.";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
