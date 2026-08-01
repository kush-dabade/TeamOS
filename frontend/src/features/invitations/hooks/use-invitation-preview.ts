import { useQuery } from "@tanstack/react-query";

import type { AppError } from "@/lib/api";

import { fetchInvitationPreview } from "../api/invitations.api";
import { invitationKeys } from "../lib/invitation-keys";
import type { InvitationPreview } from "../types";

export function useInvitationPreview(token: string | undefined) {
  return useQuery<InvitationPreview, AppError>({
    queryKey: invitationKeys.preview(token ?? ""),
    queryFn: () => fetchInvitationPreview(token as string),
    enabled: Boolean(token),
  });
}
