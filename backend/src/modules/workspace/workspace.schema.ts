import { z } from "zod";
import { WorkspaceRole } from "../../generated/prisma/enums.js";

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Workspace name must be at least 3 characters")
    .max(100, "Workspace name must be at most 100 characters"),
});

export const updateWorkspaceMemberRoleSchema = z.object({
  role: z.nativeEnum(WorkspaceRole),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceMemberRoleInput = z.infer<
  typeof updateWorkspaceMemberRoleSchema
>;