import { aiResponseSchema, type AIResponse } from "@/lib/ai/schema";
import type { DatasetMetadata } from "@/types/datasets";

export async function requestAssistantActions(
  message: string,
  metadata: DatasetMetadata,
  activeField: string,
): Promise<AIResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, fields: metadata.fields, activeField, dimension: metadata.dimension }),
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const detail = typeof payload === "object" && payload && "detail" in payload ? payload.detail : null;
    throw new Error(typeof detail === "string" ? detail : "The AI assistant request failed.");
  }
  return aiResponseSchema.parse(payload);
}
