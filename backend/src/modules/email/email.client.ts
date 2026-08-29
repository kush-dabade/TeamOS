import { Resend } from "resend";
import { emailConfig } from "./email.config.js";

// Only constructed with a real key when actual sending is configured -
// `new Resend()` throws synchronously on a missing/empty key (verified
// against the installed resend package's constructor: `if (!key) { ...
// if (!this.key) throw new Error("Missing API key...") }`), so a real
// client must never be constructed when emailConfig.enabled is false (local
// development without a Resend account) - that would reintroduce the exact
// worker-boot crash a missing RESEND_API_KEY caused before, just one layer
// deeper than email.config.ts's own guard.
export const resend: Resend | null = emailConfig.enabled
  ? new Resend(emailConfig.resendApiKey)
  : null;