import axios from "axios";

export type AppErrorType =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "not_found"
  | "server"
  | "unknown";

const APP_ERROR_TYPES: readonly AppErrorType[] = [
  "network",
  "unauthorized",
  "forbidden",
  "validation",
  "not_found",
  "server",
  "unknown",
];

export interface AppError {
  type: AppErrorType;
  message: string;
  status?: number;
  code?: string;
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { type?: unknown }).type === "string" &&
    APP_ERROR_TYPES.includes((error as { type: AppErrorType }).type) &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

interface BackendErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

function isBackendErrorBody(data: unknown): data is BackendErrorBody {
  if (typeof data !== "object" || data === null || !("error" in data)) {
    return false;
  }

  const { error } = data as { error: unknown };

  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

function typeFromStatus(status: number): AppErrorType {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}

export function normalizeError(error: unknown): AppError {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return {
        type: "network",
        message: "Unable to reach the server. Check your connection and try again.",
      };
    }

    const { status, data } = error.response;
    const body = isBackendErrorBody(data) ? data.error : undefined;

    return {
      type: typeFromStatus(status),
      message: body?.message ?? error.message,
      status,
      code: body?.code,
    };
  }

  if (error instanceof Error) {
    return { type: "unknown", message: error.message };
  }

  return { type: "unknown", message: "Something went wrong. Please try again." };
}
