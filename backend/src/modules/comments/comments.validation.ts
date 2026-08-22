import { z } from "zod";

export const createCommentSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Comment content is required")
      .max(5000, "Comment content must be at most 5000 characters"),
  })
  .strict();

export type CreateCommentInput = z.infer<
  typeof createCommentSchema
>;

export const updateCommentSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Comment content is required")
      .max(5000, "Comment content must be at most 5000 characters"),
  })
  .strict();

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

export const listCommentsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();
