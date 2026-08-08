import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { changePassword } from "../api/profile.api";

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function useChangePassword() {
  return useMutation<void, Error, ChangePasswordInput>({
    mutationFn: changePassword,
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
