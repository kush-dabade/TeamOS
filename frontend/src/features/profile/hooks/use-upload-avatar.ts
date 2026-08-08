import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import type { AppError } from "@/lib/api";

import { uploadAvatar } from "../api/avatar.api";

export function useUploadAvatar() {
  return useMutation<void, AppError, File>({
    mutationFn: uploadAvatar,
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
