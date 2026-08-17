import {
  aiChatRequestSchema,
  validateAIResponse,
  type AIConversationMessage,
  type AIResponse,
  type AIVerifiedResult,
  type AIVisualizationContext,
} from "@/lib/ai/schema";
import type { DatasetMetadata } from "@/types/datasets";

export async function requestAssistantActions(
  message: string,
  metadata: DatasetMetadata,
  visualization: AIVisualizationContext,
  history: AIConversationMessage[] = [],
  verifiedResults: AIVerifiedResult[] = [],
): Promise<AIResponse> {
  const dataset = {
    datasetId: metadata.datasetId,
    dimension: metadata.dimension,
    coordinates: metadata.dimension === "3D" ? (["x", "y", "z"] as const) : (["x", "y"] as const),
    availableFields: metadata.fields,
    bounds: metadata.bounds,
  };
  const assistantRequest = aiChatRequestSchema.parse({
    message,
    dataset,
    visualization,
    history: history.slice(-16),
    verifiedResults,
  });
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assistantRequest),
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const detail = typeof payload === "object" && payload && "detail" in payload ? payload.detail : null;
    throw new Error(typeof detail === "string" ? detail : "The AI assistant request failed.");
  }
  return validateAIResponse(payload, assistantRequest.dataset);
}
