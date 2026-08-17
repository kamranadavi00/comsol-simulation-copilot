import { z } from "zod";

const fieldAction = z.object({ field: z.string().min(1) });

export const aiActionSchema = z.discriminatedUnion("type", [
  fieldAction.extend({ type: z.literal("change_field") }),
  fieldAction.extend({
    type: z.literal("set_threshold"),
    operator: z.enum([">", ">=", "<", "<=", "=="]),
    value: z.number(),
  }),
  fieldAction.extend({ type: z.literal("find_max") }),
  fieldAction.extend({ type: z.literal("find_min") }),
  fieldAction.extend({ type: z.literal("statistics") }),
  fieldAction.extend({
    type: z.literal("create_profile"),
    axis: z.enum(["x", "y", "z"]),
  }),
  z.object({
    type: z.literal("focus_point"),
    x: z.number(),
    y: z.number(),
    z: z.number().optional(),
  }),
  z.object({ type: z.literal("reset_view") }),
]);

export const aiResponseSchema = z.object({
  message: z.string().min(1),
  actions: z.array(aiActionSchema).max(6),
});

export type AIAction = z.infer<typeof aiActionSchema>;
export type AIResponse = z.infer<typeof aiResponseSchema>;
