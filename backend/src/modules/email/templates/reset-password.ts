import type { EmailTemplate, PasswordResetTemplateData } from "../email.types.js";

export function passwordResetTemplate(data: PasswordResetTemplateData): EmailTemplate {
  const subject = "Reset your TeamOS password";
  const eyebrow = "Password reset requested";
  const buttonText = "Reset Password";

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const titleText = escapeHtml(subject);
  const recipientName = escapeHtml(data.recipientName);
  const resetUrl = escapeHtml(data.resetUrl);

  const text = `
${eyebrow}

Hi ${data.recipientName},

We received a request to reset your TeamOS password. This link expires in 1 hour.

Reset your password:
${data.resetUrl}

If you didn't request this, you can safely ignore this email - your password will not be changed.
`.trim();

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="color-scheme" content="light" />
          <meta name="supported-color-schemes" content="light" />
          <title>${titleText}</title>
          <style>
            @media screen and (max-width: 600px) {
              .tos-card-padding {
                padding-left: 24px !important;
                padding-right: 24px !important;
              }
              .tos-header-padding {
                padding: 32px 24px 24px !important;
              }
              .tos-button {
                display: block !important;
                width: 100% !important;
                box-sizing: border-box !important;
                text-align: center !important;
              }
              .tos-button-cell {
                width: 100% !important;
              }
            }
          </style>
      </head>
      <body
          style="
          margin:0;
          padding:40px 20px;
          background:#f4f4f5;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
          color:#18181b;
          "
          >
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
            >
            <tr>
                <td align="center">
                  <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="
                      max-width:560px;
                      background:#ffffff;
                      border:1px solid #e4e4e7;
                      border-radius:12px;
                      overflow:hidden;
                      "
                      >
                      <tr>
                        <td
                            align="center"
                            class="tos-header-padding"
                            style="
                            padding:36px 48px 28px;
                            border-bottom:1px solid #f4f4f5;
                            "
                            >
                            <span
                              style="
                              font-size:20px;
                              font-weight:700;
                              letter-spacing:-0.02em;
                              color:#18181b;
                              "
                              >
                              TeamOS
                            </span>
                        </td>
                      </tr>
                      <tr>
                        <td class="tos-card-padding" style="padding:44px 48px;">
                            <p
                              style="
                              margin:0;
                              font-size:15px;
                              line-height:22px;
                              font-weight:600;
                              color:#71717a;
                              "
                              >
                              ${eyebrow}
                            </p>
                            <p
                              style="
                              margin:20px 0 0;
                              font-size:16px;
                              line-height:26px;
                              color:#3f3f46;
                              "
                              >
                              Hi <strong>${recipientName}</strong>, we received a request to reset your TeamOS password. This link expires in 1 hour.
                            </p>
                            <table
                              role="presentation"
                              cellpadding="0"
                              cellspacing="0"
                              border="0"
                              style="margin:32px 0 0;"
                              >
                              <tr>
                                  <td
                                    class="tos-button-cell"
                                    bgcolor="#18181b"
                                    style="
                                    border-radius:8px;
                                    "
                                    >
                                    <a
                                        href="${resetUrl}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        role="button"
                                        class="tos-button"
                                        style="
                                        display:inline-block;
                                        padding:14px 32px;
                                        color:#ffffff;
                                        text-decoration:none;
                                        font-size:16px;
                                        font-weight:600;
                                        line-height:20px;
                                        "
                                        >
                                    ${buttonText}
                                    </a>
                                  </td>
                              </tr>
                            </table>
                            <p
                              style="
                              margin:24px 0 0;
                              color:#71717a;
                              font-size:13px;
                              line-height:20px;
                              "
                              >
                              If the button doesn't work, copy and paste this link into your browser:
                            </p>
                            <p
                              style="
                              margin:6px 0 0;
                              word-break:break-all;
                              color:#2563eb;
                              font-size:13px;
                              line-height:20px;
                              "
                              >
                              ${resetUrl}
                            </p>
                        </td>
                      </tr>
                      <tr>
                        <td
                            class="tos-card-padding"
                            style="
                            padding:24px 48px 32px;
                            border-top:1px solid #f4f4f5;
                            "
                            >
                            <p
                              style="
                              margin:0;
                              font-size:13px;
                              line-height:20px;
                              color:#a1a1aa;
                              "
                              >
                              If you didn't request a password reset, you can safely ignore this email - your password will not be changed.
                            </p>
                        </td>
                      </tr>
                  </table>
                </td>
            </tr>
          </table>
      </body>
    </html>
  `.trim();

  return {
    subject,
    text,
    html,
  };
}
