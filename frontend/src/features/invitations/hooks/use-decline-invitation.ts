import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { declineInvitation } from "../api/invitations.api";
import { invitationKeys } from "../lib/invitation-keys";
import type { Invitation } from "../types";

export function useDeclineInvitation() {
  const queryClient = useQueryClient();

  return useMutation<Invitation, AppError, string>({
    mutationFn: (token) => declineInvitation(token),
    onSuccess: (_invitation, token) => {
      // Declining does not change workspace membership, so only the
      // invitation's own preview cache needs to be refreshed.
      queryClient.invalidateQueries({ queryKey: invitationKeys.preview(token) });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
