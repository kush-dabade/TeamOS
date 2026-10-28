import { describe, expect, it } from "vitest";

import {
  EMAIL_DELIVERY_FAILED_ALERT,
  describeEmailJobFailure,
  redactEmailAddresses,
} from "../../src/queues/email/email-failure.js";

// Shape of the error Resend returns for the sandbox sender restriction that
// blocked production delivery (audit F-01) - its message names the Resend
// account owner's own address.
const resendSandboxError = {
  name: "validation_error",
  statusCode: 403,
  message:
    "You can only send testing emails to your own email address (owner@example.com). To send emails to other recipients, please verify a domain at resend.com/domains.",
};

describe("redactEmailAddresses", () => {
  it("replaces every address in the text", () => {
    expect(redactEmailAddresses("a@x.io and b.c+tag@sub.example.co.uk")).toBe(
      "[redacted-email] and [redacted-email]",
    );
  });

  it("leaves text without addresses untouched", () => {
    expect(redactEmailAddresses("resend.com/domains returned 403")).toBe(
      "resend.com/domains returned 403",
    );
  });
});

describe("describeEmailJobFailure", () => {
  it("treats a non-final attempt as a retry warning without the alert marker", () => {
    const failure = describeEmailJobFailure(
      { name: "email-verification", attemptsMade: 2, opts: { attempts: 5 } },
      resendSandboxError,
    );

    expect(failure.level).toBe("warn");
    expect(failure.fields.alert).toBeUndefined();
    expect(failure.fields).toMatchObject({ attemptsMade: 2, maxAttempts: 5 });
  });

  it("marks the final attempt as a permanent delivery failure", () => {
    const failure = describeEmailJobFailure(
      { name: "email-verification", attemptsMade: 5, opts: { attempts: 5 } },
      resendSandboxError,
    );

    expect(failure.level).toBe("error");
    expect(failure.message).toBe("Email job permanently failed");
    expect(failure.fields).toMatchObject({
      jobName: "email-verification",
      alert: EMAIL_DELIVERY_FAILED_ALERT,
      errorName: "validation_error",
      statusCode: 403,
    });
  });

  it("never logs the recipient or owner address carried in the provider error", () => {
    const failure = describeEmailJobFailure(
      { name: "password-reset", attemptsMade: 5, opts: { attempts: 5 } },
      resendSandboxError,
    );

    const serialized = JSON.stringify(failure);
    expect(serialized).not.toContain("owner@example.com");
    expect(failure.fields.errorMessage).toContain("[redacted-email]");
  });

  it("treats a failure without job context as final", () => {
    const failure = describeEmailJobFailure(undefined, new Error("connection reset"));

    expect(failure.level).toBe("error");
    expect(failure.fields).toMatchObject({
      jobName: "unknown",
      errorName: "Error",
      errorMessage: "connection reset",
      alert: EMAIL_DELIVERY_FAILED_ALERT,
    });
  });
});
