import { z } from "zod";

export const listAttachmentsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();

export type ListAttachmentsQueryInput = z.infer<
  typeof listAttachmentsQuerySchema
>;