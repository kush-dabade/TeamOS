import { z } from "zod";

export const listAttachmentsQuerySchema = z.object({}).strict();

export type ListAttachmentsQueryInput = z.infer<
  typeof listAttachmentsQuerySchema
>;