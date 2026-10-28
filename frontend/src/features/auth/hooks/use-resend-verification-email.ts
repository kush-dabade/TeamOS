import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { resendVerificationEmail } from "../api/auth.api";

import { getErrorMessage } from "@/utils";

export function useResendVerificationEmail() {
  return useMutation({
    mutationFn: resendVerificationEmail,
    onSuccess: () => {
      toast.success("Verification email requested. It can take a few minutes to arrive.");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });
}
