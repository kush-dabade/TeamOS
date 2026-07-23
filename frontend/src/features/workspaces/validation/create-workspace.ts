import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Workspace name must be at least 3 characters.")
    .max(100, "Workspace name must be 100 characters or fewer."),
});

export type CreateWorkspaceFormData = z.infer<typeof createWorkspaceSchema>;
