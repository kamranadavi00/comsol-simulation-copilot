import { NextResponse } from "next/server";
import { z } from "zod";

import { aiResponseSchema } from "@/lib/ai/schema";

const requestSchema = z.object({
  message: z.string().trim().min(1).max(2_000),
  fields: z.array(z.string().min(1)).min(1).max(200),
  activeField: z.string().min(1),
  dimension: z.enum(["2D", "3D"]),
});

function action(type: string, properties: Record<string, unknown>, required: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    properties: { type: { type: "string", const: type }, ...properties },
    required: ["type", ...required],
  };
}

const actionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    message: { type: "string" },
    actions: {
      type: "array",
      maxItems: 6,
      items: {
        oneOf: [
          action("change_field", { field: { type: "string" } }, ["field"]),
          action(
            "set_threshold",
            {
              field: { type: "string" },
              operator: { type: "string", enum: [">", ">=", "<", "<=", "=="] },
              value: { type: "number" },
            },
            ["field", "operator", "value"],
          ),
          action("find_max", { field: { type: "string" } }, ["field"]),
          action("find_min", { field: { type: "string" } }, ["field"]),
          action("statistics", { field: { type: "string" } }, ["field"]),
          action(
            "create_profile",
            { field: { type: "string" }, axis: { type: "string", enum: ["x", "y", "z"] } },
            ["field", "axis"],
          ),
          action(
            "focus_point",
            { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } },
            ["x", "y"],
          ),
          action("reset_view", {}, []),
        ],
      },
    },
  },
  required: ["message", "actions"],
} as const;

export async function POST(request: Request) {
  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) {
    return NextResponse.json({ detail: "Invalid assistant request." }, { status: 400 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "z-ai/glm-5.2";
  if (!apiKey) {
    return NextResponse.json(
      { detail: "Set OPENROUTER_API_KEY in frontend/.env.local to enable the assistant." },
      { status: 503 },
    );
  }

  const { message, fields, activeField, dimension } = parsedRequest.data;
  const systemPrompt = [
    "You are the command interpreter for a COMSOL results explorer.",
    "Return only actions from the supplied JSON schema.",
    `The available scalar fields are exactly: ${JSON.stringify(fields)}.`,
    `The active field is ${JSON.stringify(activeField)} and the dataset is ${dimension}.`,
    "Never invent field names, coordinates, or scientific values.",
    "Use numerical actions to ask the deterministic Python backend for calculations.",
    "If a request cannot be represented safely, explain why and return an empty actions array.",
  ].join("\n");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0,
        max_tokens: 800,
        provider: { require_parameters: true },
        response_format: {
          type: "json_schema",
          json_schema: { name: "comsol_visualization_actions", strict: true, schema: actionJsonSchema },
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
    const validated = aiResponseSchema.parse(JSON.parse(content));
    const unknownField = validated.actions.find(
      (candidate) => "field" in candidate && !fields.includes(candidate.field),
    );
    if (unknownField) throw new Error("The assistant selected a field that is not in this dataset.");
    return NextResponse.json(validated);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The assistant response was invalid.";
    return NextResponse.json({ detail }, { status: 502 });
  }
}
