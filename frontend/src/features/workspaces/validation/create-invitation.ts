import { z } from "zod";

export const createInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  role: z.enum(["ADMIN", "MEMBER", "GUEST"], {
    message: "Select a role.",
  }),
});

export type CreateInvitationFormData = z.infer<typeof createInvitationSchema>;
