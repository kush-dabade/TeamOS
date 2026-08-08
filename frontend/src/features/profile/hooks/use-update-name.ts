import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { updateName } from "../api/profile.api";

export function useUpdateName() {
  return useMutation<void, Error, { name: string }>({
    mutationFn: updateName,
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
