import { z } from "zod";
import { WorkspaceRole } from "../../generated/prisma/enums.js";

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Workspace name must be at least 3 characters")
    .max(100, "Workspace name must be at most 100 characters"),
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Workspace name must be at least 3 characters")
    .max(100, "Workspace name must be at most 100 characters"),
});

export const updateWorkspaceMemberRoleSchema = z.object({
  role: z.nativeEnum(WorkspaceRole),
});

export const transferWorkspaceOwnershipSchema = z.object({
  memberId: z.string().cuid("Invalid member ID"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type UpdateWorkspaceMemberRoleInput = z.infer<
  typeof updateWorkspaceMemberRoleSchema
>;
export type TransferWorkspaceOwnershipInput = z.infer<
  typeof transferWorkspaceOwnershipSchema
>;