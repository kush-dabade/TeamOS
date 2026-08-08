import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/utils";

interface UpdateNameInput {
  name: string;
}

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function updateName(data: UpdateNameInput): Promise<void> {
  const { error } = await authClient.updateUser({ name: data.name });

  throwIfAuthError(error);
}

export async function changePassword(data: ChangePasswordInput): Promise<void> {
  const { error } = await authClient.changePassword({
    currentPassword: data.currentPassword,
    newPassword: data.newPassword,
  });

  throwIfAuthError(error);
}

function throwIfAuthError(error: unknown): void {
  if (!error) {
    return;
  }

  throw new Error(getErrorMessage(error));
}
