import { authClient } from "@/lib/auth-client";

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

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

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Something went wrong. Please try again.");
}
