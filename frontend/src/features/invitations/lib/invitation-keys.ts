export const invitationKeys = {
  all: ["invitations"] as const,
  previews: () => [...invitationKeys.all, "preview"] as const,
  preview: (token: string) => [...invitationKeys.previews(), token] as const,
};
