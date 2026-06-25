const emailFrom = process.env.EMAIL_FROM;
const resendApiKey = process.env.RESEND_API_KEY;

if (!emailFrom) {
  throw new Error("EMAIL_FROM environment variable is required.");
}

if (!resendApiKey) {
  throw new Error("RESEND_API_KEY environment variable is required.");
}

export const emailConfig = {
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  from: emailFrom,
  resendApiKey,
};