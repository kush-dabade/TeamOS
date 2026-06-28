import { z } from "zod";

export const listAttachmentsQuerySchema = z.object({});

export type ListAttachmentsQueryInput = z.infer<
  typeof listAttachmentsQuerySchema
>;