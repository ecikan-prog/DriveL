/**
 * Drive Legal transactional email service.
 *
 * Uses the Brevo HTTPS API instead of SMTP.
 * This avoids Railway SMTP connection timeouts.
 *
 * Required Railway variable:
 * BREVO_API_KEY
 */

const FROM_EMAIL = "support@drivelegal.app";
const FROM_NAME = "Drive Legal";
const BREVO_API_URL =
  "https://api.brevo.com/v3/smtp/email";

type BrevoResponse = {
  messageId?: string;
  code?: string;
  message?: string;
};

type SendEmailParams = {
  toEmail: string;
  recipientName: string;
  subject: string;
  htmlContent: string;
};

function normaliseBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendBrevoEmail(
  params: SendEmailParams
): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.error(
      "[Email] BREVO_API_KEY is not configured."
    );
    return false;
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15_000);

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL,
        },
        to: [
          {
            email: params.toEmail,
            name:
              params.recipientName ||
              params.toEmail,
          },
        ],
        subject: params.subject,
        htmlContent: params.htmlContent,
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();

    let responseData: BrevoResponse = {};

    if (responseText) {
      try {
        responseData =
          JSON.parse(responseText);
      } catch {
        responseData = {
          message: responseText,
        };
      }
    }

    if (!response.ok) {
      console.error(
        `[Email] Brevo API returned HTTP ${response.status}:`,
        responseData
      );

      return false;
    }

    console.log(
      `[Email] Email sent to ${params.toEmail}. MessageId: ${
        responseData.messageId ?? "unknown"
      }`
    );

    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      console.error(
        "[Email] Brevo API request timed out."
      );
    } else {
      console.error(
        "[Email] Brevo API request failed:",
        error
      );
    }

    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function buildEmailLayout(params: {
  title: string;
  greetingName: string;
  introduction: string;
  actionText: string;
  actionUrl: string;
  expiryText: string;
  footerText: string;
}): string {
  const recipientName =
    params.greetingName.trim();

  const greeting = recipientName
    ? `Hi ${escapeHtml(recipientName)},`
    : "Hi,";

  const safeActionUrl =
    escapeHtml(params.actionUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <title>${escapeHtml(params.title)} — Drive Legal</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#F0F4FF;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
  "
>
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    style="background:#F0F4FF;padding:40px 20px;"
  >
    <tr>
      <td align="center">
        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="
            max-width:520px;
            background:#FFFFFF;
            border-radius:16px;
            overflow:hidden;
            box-shadow:0 4px 24px rgba(0,51,102,0.08);
          "
        >
          <tr>
            <td
              style="
                background:#003366;
                padding:28px 32px;
                text-align:center;
              "
            >
              <h1
                style="
                  margin:0;
                  font-size:24px;
                  font-weight:800;
                  color:#FFFFFF;
                  letter-spacing:2px;
                "
              >
                DRIVE
                <span style="color:#4ADE80;">
                  LEGAL
                </span>
              </h1>

              <p
                style="
                  margin:6px 0 0;
                  font-size:12px;
                  color:rgba(255,255,255,0.65);
                  letter-spacing:1px;
                  text-transform:uppercase;
                "
              >
                DRIVER LOGBOOK
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">
              <h2
                style="
                  margin:0 0 12px;
                  font-size:21px;
                  font-weight:700;
                  color:#003366;
                "
              >
                ${escapeHtml(params.title)}
              </h2>

              <p
                style="
                  margin:0 0 20px;
                  font-size:14px;
                  color:#4A5568;
                  line-height:1.6;
                "
              >
                ${greeting}
              </p>

              <p
                style="
                  margin:0 0 12px;
                  font-size:14px;
                  color:#4A5568;
                  line-height:1.6;
                "
              >
                ${escapeHtml(params.introduction)}
              </p>

              <p
                style="
                  margin:0 0 24px;
                  font-size:14px;
                  color:#4A5568;
                  line-height:1.6;
                "
              >
                ${escapeHtml(params.expiryText)}
              </p>

              <table
                role="presentation"
                cellpadding="0"
                cellspacing="0"
                style="margin:0 auto 24px;"
              >
                <tr>
                  <td
                    style="
                      background:#3156D3;
                      border-radius:10px;
                    "
                  >
                    <a
                      href="${safeActionUrl}"
                      target="_blank"
                      rel="noopener noreferrer"
                      style="
                        display:inline-block;
                        padding:14px 32px;
                        font-size:15px;
                        font-weight:700;
                        color:#FFFFFF;
                        text-decoration:none;
                        letter-spacing:0.3px;
                      "
                    >
                      ${escapeHtml(params.actionText)}
                    </a>
                  </td>
                </tr>
              </table>

              <p
                style="
                  margin:0 0 12px;
                  font-size:13px;
                  color:#6B7A99;
                  line-height:1.5;
                "
              >
                If the button does not work, copy and paste this link into your browser:
              </p>

              <p
                style="
                  margin:0 0 24px;
                  font-size:12px;
                  color:#3156D3;
                  word-break:break-all;
                  line-height:1.5;
                "
              >
                ${safeActionUrl}
              </p>

              <hr
                style="
                  border:none;
                  border-top:1px solid #E8EEF8;
                  margin:24px 0;
                "
              />

              <p
                style="
                  margin:0;
                  font-size:12px;
                  color:#9BA8C0;
                  line-height:1.5;
                "
              >
                ${escapeHtml(params.footerText)}
              </p>
            </td>
          </tr>

          <tr>
            <td
              style="
                background:#F8FAFC;
                padding:20px 32px;
                text-align:center;
                border-top:1px solid #E8EEF8;
              "
            >
              <p
                style="
                  margin:0;
                  font-size:11px;
                  color:#9BA8C0;
                  line-height:1.5;
                "
              >
                &copy; ${new Date().getFullYear()} Drive Legal
              </p>

              <p
                style="
                  margin:4px 0 0;
                  font-size:11px;
                  color:#9BA8C0;
                "
              >
                Electronic driver logbook designed around
                New Zealand work-time requirements
              </p>

              <p
                style="
                  margin:4px 0 0;
                  font-size:11px;
                  color:#9BA8C0;
                "
              >
                support@drivelegal.app
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildVerificationEmailHtml(
  verifyUrl: string,
  recipientName: string
): string {
  return buildEmailLayout({
    title: "Verify Your Email",
    greetingName: recipientName,
    introduction:
      "Thanks for registering with Drive Legal. Please verify your email address to activate your account.",
    expiryText:
      "This verification link will expire after 24 hours.",
    actionText: "Verify Email Address",
    actionUrl: verifyUrl,
    footerText:
      "If you did not create a Drive Legal account, you can safely ignore this email.",
  });
}

function buildResetEmailHtml(
  resetUrl: string,
  recipientName: string
): string {
  return buildEmailLayout({
    title: "Reset Your Password",
    greetingName: recipientName,
    introduction:
      "We received a request to reset your Drive Legal password.",
    expiryText:
      "This password-reset link will expire after 1 hour.",
    actionText: "Reset Password",
    actionUrl: resetUrl,
    footerText:
      "If you did not request a password reset, you can safely ignore this email.",
  });
}

export async function sendVerificationEmail(
  toEmail: string,
  recipientName: string,
  verificationToken: string,
  baseUrl: string
): Promise<boolean> {
  const verifyUrl =
    `${normaliseBaseUrl(baseUrl)}/verify-email?token=` +
    encodeURIComponent(verificationToken);

  const htmlContent =
    buildVerificationEmailHtml(
      verifyUrl,
      recipientName
    );

  return sendBrevoEmail({
    toEmail: toEmail.trim().toLowerCase(),
    recipientName: recipientName.trim(),
    subject:
      "Verify Your Email — Drive Legal",
    htmlContent,
  });
}

export async function sendPasswordResetEmail(
  toEmail: string,
  recipientName: string,
  resetToken: string,
  baseUrl: string,
  userType: "driver" | "operator"
): Promise<boolean> {
  const encodedToken = encodeURIComponent(resetToken);

const resetUrl =
  userType === "operator"
    ? `${normaliseBaseUrl(baseUrl)}/portal/reset-password?token=${encodedToken}`
    : `drivelegal://reset-password?token=${encodedToken}`;

  const htmlContent =
    buildResetEmailHtml(
      resetUrl,
      recipientName
    );

  return sendBrevoEmail({
    toEmail: toEmail.trim().toLowerCase(),
    recipientName: recipientName.trim(),
    subject:
      "Reset Your Password — Drive Legal",
    htmlContent,
  });
}
