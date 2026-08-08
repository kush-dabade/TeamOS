import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { deleteAvatar } from "../api/avatar.api";

export function useDeleteAvatar() {
  return useMutation<void, AppError, void>({
    mutationFn: deleteAvatar,
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
