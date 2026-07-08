import type { LoginFormData } from "../validation/login";
import type { RegisterFormData } from "../validation/register";
import { getErrorMessage } from "@/utils";

import { authClient } from "@/lib/auth-client";

type LoginCredentials = LoginFormData;

type RegisterCredentials = Pick<RegisterFormData, "name" | "email" | "password">;

export async function login(data: LoginCredentials): Promise<void> {
  const { error } = await authClient.signIn.email({
    email: data.email,
    password: data.password,
  });

  throwIfAuthError(error);
}

export async function register(data: RegisterCredentials): Promise<void> {
  const { error } = await authClient.signUp.email({
    name: data.name,
    email: data.email,
    password: data.password,
  });

  throwIfAuthError(error);
}

export async function logout(): Promise<void> {
  const { error } = await authClient.signOut();

  throwIfAuthError(error);
}

function throwIfAuthError(error: unknown): void {
  if (!error) {
    return;
  }

  throw new Error(getErrorMessage(error));
}
