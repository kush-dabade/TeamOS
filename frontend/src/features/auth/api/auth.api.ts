import type { LoginFormData } from "../validation/login";
import type { RegisterFormData } from "../validation/register";

import { authClient } from "@/lib/auth-client";
import { type AppError, typeFromStatus } from "@/lib/api";

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

// Calls Better Auth's existing POST /send-verification-email endpoint
// (auto-registered once emailVerification.sendVerificationEmail is
// configured - backend/src/lib/auth.ts) - not a custom endpoint.
// callbackURL is deliberately omitted: auth.ts's hooks.before already
// defaults it to `${FRONTEND_URL}/verify-email` for this exact path when
// the caller doesn't supply one, the same mechanism the sign-up flow uses
// (Commit 1), so there is nothing for the frontend to configure here.
export async function resendVerificationEmail(email: string): Promise<void> {
  const { error } = await authClient.sendVerificationEmail({ email });

  throwIfAuthError(error);
}

// Better Auth's client resolves errors as a plain object shaped like
// { message?, code?, status, statusText } (see @better-fetch/fetch's
// non-throwing betterFetch() path) - not an Error instance, and distinct
// from the { message } string this used to collapse into, which is what
// silently dropped `code` (e.g. "EMAIL_NOT_VERIFIED") before. Normalizing
// into the same AppError shape lib/api/error.ts already produces for REST
// errors means every consumer (toasts, isAppError/error.code checks) can
// treat auth errors and API errors identically, instead of a second,
// parallel error type.
interface BetterAuthErrorLike {
  message?: string;
  code?: string;
  status?: number;
  // POST /send-verification-email is rate-limited ahead of Better Auth by
  // TeamOS's own Express middleware (app.ts's verificationEmailLimiter -
  // see middleware/rate-limit.ts for why), so a 429 for that one call
  // reaches this function through the REST API's { success, error: { code,
  // message } } envelope (middleware/error-handler.ts) instead of Better
  // Auth's own flat shape. Reading both here means the caller doesn't need
  // to know which one produced a given response.
  error?: { message?: string; code?: string };
}

function throwIfAuthError(error: unknown): void {
  if (!error) {
    return;
  }

  const { message, code, status, error: nested } = error as BetterAuthErrorLike;

  // No numeric status means no HTTP response was ever received (offline,
  // DNS failure, etc.) - the same distinction lib/api/error.ts's
  // normalizeError makes via axios's `!error.response`, so this produces
  // the same "network" AppError and message rather than falling through to
  // the generic "unknown" case below.
  if (typeof status !== "number") {
    const networkError: AppError = {
      type: "network",
      message: "Unable to reach the server. Check your connection and try again.",
    };

    throw networkError;
  }

  const appError: AppError = {
    type: typeFromStatus(status),
    message: message ?? nested?.message ?? "Something went wrong. Please try again.",
    status,
    code: code ?? nested?.code,
  };

  throw appError;
}
