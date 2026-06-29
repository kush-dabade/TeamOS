import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, "Search query must be at least 2 characters long.")
    .max(100, "Search query cannot exceed 100 characters."),

  workspaceId: z.string().cuid("Invalid workspace ID."),

  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
