// Stable marker for a permanently failed email job. scripts/ops/ops-check.sh
// counts the email queue's failed set directly, but the marker also makes
// the matching worker log line greppable (`docker logs ... | grep
// EMAIL_DELIVERY_FAILED`) without parsing pino's JSON.
export const EMAIL_DELIVERY_FAILED_ALERT = "EMAIL_DELIVERY_FAILED";

const EMAIL_ADDRESS_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Provider error messages can embed email addresses - Resend's sandbox
 * rejection names the account owner's own address, for example - and none
 * of them belong in logs.
 */
export function redactEmailAddresses(text: string): string {
  return text.replace(EMAIL_ADDRESS_PATTERN, "[redacted-email]");
}

interface FailedEmailJob {
  name: string;
  attemptsMade: number;
  opts: { attempts?: number };
}

export interface EmailJobFailureLog {
  level: "warn" | "error";
  message: string;
  fields: {
    jobName: string;
    attemptsMade: number;
    maxAttempts: number;
    errorName: string;
    errorMessage: string;
    statusCode?: number;
    alert?: typeof EMAIL_DELIVERY_FAILED_ALERT;
  };
}

/**
 * BullMQ emits "failed" after every attempt, not only the last one, so a
 * single transient Resend error would otherwise look identical to a job
 * that has given up. Only the final attempt is an error worth an operator's
 * attention; earlier ones are retries in progress.
 */
export function describeEmailJobFailure(
  job: FailedEmailJob | undefined,
  error: unknown,
): EmailJobFailureLog {
  const maxAttempts = job?.opts.attempts ?? 1;
  const attemptsMade = job?.attemptsMade ?? maxAttempts;
  const isFinalAttempt = attemptsMade >= maxAttempts;

  const errorRecord = (typeof error === "object" && error !== null ? error : {}) as {
    name?: unknown;
    message?: unknown;
    statusCode?: unknown;
  };

  const rawMessage =
    typeof errorRecord.message === "string" ? errorRecord.message : String(error);

  return {
    level: isFinalAttempt ? "error" : "warn",
    message: isFinalAttempt
      ? "Email job permanently failed"
      : "Email job attempt failed; it will be retried",
    fields: {
      jobName: job?.name ?? "unknown",
      attemptsMade,
      maxAttempts,
      errorName: typeof errorRecord.name === "string" ? errorRecord.name : "Error",
      errorMessage: redactEmailAddresses(rawMessage),
      ...(typeof errorRecord.statusCode === "number" && {
        statusCode: errorRecord.statusCode,
      }),
      ...(isFinalAttempt && { alert: EMAIL_DELIVERY_FAILED_ALERT }),
    },
  };
}
