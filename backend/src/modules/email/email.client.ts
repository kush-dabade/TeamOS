import { Resend } from "resend";
import { emailConfig } from "./email.config.js";

export const resend = new Resend(emailConfig.resendApiKey);