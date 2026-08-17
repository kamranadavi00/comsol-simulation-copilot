import { z } from "zod";

const finiteNumber = z.number().finite();
const fieldAction = z.object({ field: z.string().min(1) }).strict();
const locationSchema = z
  .object({ x: finiteNumber, y: finiteNumber, z: finiteNumber.optional() })
  .strict();

export const aiActionSchema = z.discriminatedUnion("type", [
  fieldAction.extend({ type: z.literal("change_field") }),
  fieldAction.extend({
    type: z.literal("filter"),
    operator: z.enum([">", ">=", "<", "<="]),
    value: finiteNumber,
  }),
  fieldAction.extend({ type: z.literal("find_max") }),
  fieldAction.extend({ type: z.literal("find_min") }),
  fieldAction.extend({ type: z.literal("statistics") }),
  fieldAction.extend({
    type: z.literal("create_profile"),
    axis: z.enum(["x", "y", "z"]),
  }),
  locationSchema.extend({ type: z.literal("focus_point") }),
  z
    .object({
      type: z.literal("highlight_points"),
      rowIndexes: z.array(z.number().int().nonnegative()).max(50_000),
    })
    .strict(),
  z.object({ type: z.literal("reset_view") }).strict(),
]);

export const aiResponseSchema = z
  .object({
    message: z.string().trim().min(1).max(4_000),
    actions: z.array(aiActionSchema).max(6),
  })
  .strict();

export const aiConversationMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(4_000),
  })
  .strict();

const thresholdContextSchema = z
  .object({
    field: z.string().min(1),
    operator: z.enum([">", ">=", "<", "<=", "=="]),
    value: finiteNumber,
  })
  .strict();

export const aiDatasetContextSchema = z
  .object({
    datasetId: z.string().min(1).max(200),
    rowCount: z.number().int().positive(),
    dimension: z.enum(["2D", "3D"]),
    coordinates: z.array(z.enum(["x", "y", "z"])).min(2).max(3),
    coordinateColumns: z
      .object({
        x: z.string().min(1),
        y: z.string().min(1),
        z: z.string().min(1).nullable().optional(),
      })
      .strict(),
    availableFields: z.array(z.string().min(1)).min(1).max(200),
    bounds: z.partialRecord(z.enum(["x", "y", "z"]), z.tuple([finiteNumber, finiteNumber])),
  })
  .strict();

export const aiVisualizationContextSchema = z
  .object({
    activeField: z.string().min(1),
    representation: z.enum(["surface", "points", "wireframe"]),
    threshold: thresholdContextSchema.nullable(),
    highlightedRegion: thresholdContextSchema
      .extend({ matchedCount: z.number().int().nonnegative() })
      .nullable(),
    selectedLocation: locationSchema.nullable(),
  })
  .strict();

export const verifiedExtremeResultSchema = z
  .object({
    action: z.enum(["find_max", "find_min"]),
    field: z.string().min(1),
    value: finiteNumber,
    rowIndex: z.number().int().nonnegative(),
    location: locationSchema,
  })
  .strict();

export const verifiedNearestPointResultSchema = z
  .object({
    action: z.literal("nearest_point"),
    rowIndex: z.number().int().nonnegative(),
    location: locationSchema,
    values: z.record(z.string(), finiteNumber),
  })
  .strict();

export const aiVerifiedResultSchema = z.discriminatedUnion("action", [
  verifiedExtremeResultSchema,
  z
    .object({
      action: z.literal("statistics"),
      field: z.string().min(1),
      count: z.number().int().nonnegative(),
      min: finiteNumber,
      max: finiteNumber,
      mean: finiteNumber,
      median: finiteNumber,
      standardDeviation: finiteNumber,
      range: finiteNumber,
      minLocation: locationSchema,
      maxLocation: locationSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("filter"),
      field: z.string().min(1),
      operator: z.enum([">", ">=", "<", "<="]),
      value: finiteNumber,
      matchedCount: z.number().int().nonnegative(),
      rowIndexes: z.array(z.number().int().nonnegative()).max(50_000),
    })
    .strict(),
  z
    .object({
      action: z.literal("profile"),
      field: z.string().min(1),
      axis: z.enum(["x", "y", "z"]),
      pointCount: z.number().int().nonnegative(),
    })
    .strict(),
  verifiedNearestPointResultSchema,
]);

export const aiChatRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(2_000),
    dataset: aiDatasetContextSchema,
    visualization: aiVisualizationContextSchema,
    history: z.array(aiConversationMessageSchema).max(16).default([]),
    verifiedResults: z.array(aiVerifiedResultSchema).max(6).default([]),
  })
  .strict();

export type AIAction = z.infer<typeof aiActionSchema>;
export type AIResponse = z.infer<typeof aiResponseSchema>;
export type AIConversationMessage = z.infer<typeof aiConversationMessageSchema>;
export type AIDatasetContext = z.infer<typeof aiDatasetContextSchema>;
export type AIVisualizationContext = z.infer<typeof aiVisualizationContextSchema>;
export type AIVerifiedResult = z.infer<typeof aiVerifiedResultSchema>;
export type AIChatRequest = z.infer<typeof aiChatRequestSchema>;

export class AIResponseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIResponseValidationError";
  }
}

function locationIsInBounds(
  location: { x: number; y: number; z?: number },
  dataset: AIDatasetContext,
): boolean {
  return dataset.coordinates.every((axis) => {
    const value = location[axis];
    const bounds = dataset.bounds[axis];
    return value !== undefined && bounds !== undefined && value >= bounds[0] && value <= bounds[1];
  });
}

export function validateAIResponse(value: unknown, dataset: AIDatasetContext): AIResponse {
  const response = aiResponseSchema.parse(value);

  for (const action of response.actions) {
    if ("field" in action && !dataset.availableFields.includes(action.field)) {
      throw new AIResponseValidationError(
        `The assistant selected unavailable field '${action.field}'.`,
      );
    }
    if (action.type === "create_profile" && !dataset.coordinates.includes(action.axis)) {
      throw new AIResponseValidationError(
        `Axis '${action.axis}' is unavailable for this ${dataset.dimension} dataset.`,
      );
    }
    if (action.type === "focus_point") {
      if (dataset.dimension === "2D" && action.z !== undefined) {
        throw new AIResponseValidationError("A 2D focus point cannot include a Z coordinate.");
      }
      if (!locationIsInBounds(action, dataset)) {
        throw new AIResponseValidationError(
          "The assistant selected a focus point outside the dataset bounds.",
        );
      }
    }
  }

  return response;
}

function actionJsonSchema(
  type: string,
  properties: Record<string, unknown>,
  required: string[],
) {
  return {
    type: "object",
    additionalProperties: false,
    properties: { type: { type: "string", const: type }, ...properties },
    required: ["type", ...required],
  };
}

export const aiResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    message: { type: "string", minLength: 1, maxLength: 4_000 },
    actions: {
      type: "array",
      maxItems: 6,
      items: {
        oneOf: [
          actionJsonSchema("change_field", { field: { type: "string" } }, ["field"]),
          actionJsonSchema(
            "filter",
            {
              field: { type: "string" },
              operator: { type: "string", enum: [">", ">=", "<", "<="] },
              value: { type: "number" },
            },
            ["field", "operator", "value"],
          ),
          actionJsonSchema("find_max", { field: { type: "string" } }, ["field"]),
          actionJsonSchema("find_min", { field: { type: "string" } }, ["field"]),
          actionJsonSchema("statistics", { field: { type: "string" } }, ["field"]),
          actionJsonSchema(
            "create_profile",
            { field: { type: "string" }, axis: { type: "string", enum: ["x", "y", "z"] } },
            ["field", "axis"],
          ),
          actionJsonSchema(
            "focus_point",
            { x: { type: "number" }, y: { type: "number" }, z: { type: "number" } },
            ["x", "y"],
          ),
          actionJsonSchema(
            "highlight_points",
            {
              rowIndexes: {
                type: "array",
                maxItems: 50_000,
                items: { type: "integer", minimum: 0 },
              },
            },
            ["rowIndexes"],
          ),
          actionJsonSchema("reset_view", {}, []),
        ],
      },
    },
  },
  required: ["message", "actions"],
} as const;
