import { z } from "zod";
import { WorkspaceRole } from "../../generated/prisma/enums.js";

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),

  role: z
    .nativeEnum(WorkspaceRole)
    .refine((role) => role !== WorkspaceRole.OWNER, {
      message: "Owner invitations are not allowed",
    }),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const invitationTokenParamSchema = z.object({
  token: z.string().trim().min(1, "Invitation token is required"),
});

export type InvitationTokenParamInput = z.infer<
  typeof invitationTokenParamSchema
>;
