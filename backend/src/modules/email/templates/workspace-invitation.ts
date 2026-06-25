import type {
  EmailTemplate,
  WorkspaceInvitationTemplateData,
} from "../email.types.js";

export function workspaceInvitationTemplate(
  data: WorkspaceInvitationTemplateData,
): EmailTemplate {
  const subject = `You've been invited to join ${data.workspaceName}`;
  const heading = "You've been invited to TeamOS";
  const buttonText = "Accept Invitation";

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const workspaceName = escapeHtml(data.workspaceName);
  const invitedByName = escapeHtml(data.invitedByName);
  const role = escapeHtml(data.role);
  const invitationUrl = escapeHtml(data.invitationUrl);
  const expiresText = escapeHtml(data.expiresText);

  const text = `
${heading}

${data.invitedByName} has invited you to collaborate in the workspace "${data.workspaceName}" as a ${data.role}.

Accept your invitation:
${data.invitationUrl}

${data.expiresText}

If you weren't expecting this invitation, you can safely ignore this email. No changes will be made to your account unless you choose to accept the invitation.

—
TeamOS
`.trim();

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${subject}</title>
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
                      max-width:600px;
                      background:#ffffff;
                      border:1px solid #e4e4e7;
                      border-radius:16px;
                      overflow:hidden;
                      "
                      >
                      <tr>
                        <td
                            align="center"
                            style="
                            padding:48px 48px 32px;
                            border-bottom:1px solid #f4f4f5;
                            "
                            >
                            <h1
                              style="
                              margin:0;
                              font-size:32px;
                              font-weight:700;
                              letter-spacing:-0.03em;
                              color:#18181b;
                              "
                              >
                              TeamOS
                            </h1>
                            <div
                              style="
                              width:48px;
                              height:4px;
                              border-radius:999px;
                              background:#2563eb;
                              margin:20px auto 0;
                              "
                              ></div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:48px;">
                            <h2
                              style="
                              margin:0;
                              font-size:28px;
                              line-height:36px;
                              font-weight:700;
                              color:#18181b;
                              "
                              >
                              ${heading}
                            </h2>
                            <p
                              style="
                              margin:24px 0 0;
                              font-size:16px;
                              line-height:28px;
                              color:#3f3f46;
                              "
                              >
                              <strong>${invitedByName}</strong>
                              has invited you to collaborate in the workspace
                              <strong>${workspaceName}</strong>
                              as a
                              <strong>${role}</strong>.
                            </p>
                            <p
                              style="
                              margin:20px 0 36px;
                              font-size:16px;
                              line-height:28px;
                              color:#3f3f46;
                              "
                              >
                              Click the button below to accept your invitation and start collaborating with your team.
                            </p>
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                              border="0"
                              style="
                              border:1px solid #e4e4e7;
                              border-radius:12px;
                              background:#fafafa;
                              margin-bottom:36px;
                              "
                              >
                              <tr>
                                  <td style="padding:28px;">
                                    <p
                                        style="
                                        margin:0;
                                        font-size:13px;
                                        font-weight:600;
                                        text-transform:uppercase;
                                        letter-spacing:0.08em;
                                        color:#71717a;
                                        "
                                        >
                                        Workspace
                                    </p>
                                    <p
                                        style="
                                        margin:8px 0 28px;
                                        font-size:22px;
                                        font-weight:700;
                                        color:#18181b;
                                        "
                                        >
                                        ${workspaceName}
                                    </p>
                                    <p
                                        style="
                                        margin:0;
                                        font-size:13px;
                                        font-weight:600;
                                        text-transform:uppercase;
                                        letter-spacing:0.08em;
                                        color:#71717a;
                                        "
                                        >
                                        Your Role
                                    </p>
                                    <table
                                        role="presentation"
                                        cellpadding="0"
                                        cellspacing="0"
                                        >
                                        <tr>
                                          <td
                                              style="
                                              background:#dbeafe;
                                              color:#1d4ed8;
                                              border:1px solid #bfdbfe;
                                              border-radius:999px;
                                              padding:8px 16px;
                                              font-size:14px;
                                              font-weight:600;
                                              "
                                              >
                                              ${role}
                                          </td>
                                        </tr>
                                    </table>
                                  </td>
                              </tr>
                            </table>
                            <table
                              role="presentation"
                              cellpadding="0"
                              cellspacing="0"
                              border="0"
                              style="margin-bottom:40px;"
                              >
                              <tr>
                                  <td
                                    bgcolor="#1d4ed8"
                                    style="
                                    border-radius:10px;
                                    "
                                    >
                                    <a
                                        href="${invitationUrl}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        role="button"
                                        style="
                                        display:inline-block;
                                        padding:16px 34px;
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
                              margin:0 0 10px;
                              color:#71717a;
                              font-size:14px;
                              line-height:22px;
                              "
                              >
                              If the button doesn't work, copy and paste this link into your browser:
                            </p>
                            <p
                              style="
                              margin:0;
                              word-break:break-all;
                              color:#2563eb;
                              font-size:14px;
                              line-height:22px;
                              "
                              >
                              ${invitationUrl}
                            </p>
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                              border="0"
                              style="margin:40px 0 24px;"
                              >
                              <tr>
                                  <td
                                    style="
                                    border-top:1px solid #e4e4e7;
                                    "
                                    ></td>
                              </tr>
                            </table>
                            <p
                              style="
                              margin:0;
                              font-size:14px;
                              line-height:24px;
                              color:#52525b;
                              "
                              >
                              <strong>${expiresText}</strong>
                            </p>
                            <p
                              style="
                              margin:16px 0 0;
                              font-size:14px;
                              line-height:24px;
                              color:#71717a;
                              "
                              >
                              If you weren't expecting this invitation, you can safely ignore this email. No changes will be made to your account unless you choose to accept the invitation.
                            </p>
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                              border="0"
                              style="margin:40px 0 0;"
                              >
                              <tr>
                                  <td
                                    style="
                                    border-top:1px solid #e4e4e7;
                                    "
                                    ></td>
                              </tr>
                            </table>
                            <table
                              role="presentation"
                              width="100%"
                              cellpadding="0"
                              cellspacing="0"
                              border="0"
                              >
                              <tr>
                                  <td
                                    align="center"
                                    style="
                                    padding-top:28px;
                                    "
                                    >
                                    <p
                                        style="
                                        margin:0;
                                        font-size:14px;
                                        font-weight:600;
                                        color:#18181b;
                                        "
                                        >
                                        TeamOS
                                    </p>
                                    <p
                                        style="
                                        margin:10px 0 0;
                                        font-size:13px;
                                        line-height:22px;
                                        color:#71717a;
                                        "
                                        >
                                        Built with ❤️ by TeamOS
                                    </p>
                                    <p
                                        style="
                                        margin:20px 0 0;
                                        font-size:12px;
                                        color:#a1a1aa;
                                        "
                                        >
                                        This is an automated transactional email.
                                    </p>
                                  </td>
                              </tr>
                            </table>
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
