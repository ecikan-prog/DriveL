/**
 * Email sending utility using nodemailer with Brevo SMTP relay.
 * Sends branded verification and password reset emails for Drive Legal.
 *
 * SMTP config:
 *   Host:  smtp-relay.brevo.com
 *   Port:  587 (STARTTLS)
 *   Login: BREVO_SMTP_LOGIN env var (format: xxxxx@smtp-brevo.com)
 *   Pass:  BREVO_SMTP_KEY env var (xsmtpsib-... format)
 */

import nodemailer from "nodemailer";

const FROM_EMAIL = "support@drivelegal.app";
const FROM_NAME = "Drive Legal";

/** Create a fresh transporter each call so env vars are always read at runtime. */
function createTransporter() {
  const login = process.env.BREVO_SMTP_LOGIN;
  const pass = process.env.BREVO_SMTP_KEY;
  if (!login || !pass) {
    throw new Error("[Email] BREVO_SMTP_LOGIN or BREVO_SMTP_KEY not configured");
  }
  return nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // STARTTLS
    auth: { user: login, pass },
  });
}

function buildResetEmailHtml(resetUrl: string, recipientName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password — Drive Legal</title>
</head>
<body style="margin:0;padding:0;background:#F0F4FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4FF;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,51,102,0.08);">
          <tr>
            <td style="background:#003366;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:2px;">DRIVE <span style="color:#4ADE80;">LEGAL</span></h1>
              <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.6);letter-spacing:1px;text-transform:uppercase;">DRIVER LOGBOOK</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#003366;">Reset Your Password</h2>
              <p style="margin:0 0 20px;font-size:14px;color:#4A5568;line-height:1.6;">Hi${recipientName ? " " + recipientName : ""},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#4A5568;line-height:1.6;">
                We received a request to reset your password. Click the button below to create a new password. This link will expire in <strong>1 hour</strong>.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background:#5980E9;border-radius:10px;">
                    <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.5px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:13px;color:#6B7A99;line-height:1.5;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 24px;font-size:12px;color:#5980E9;word-break:break-all;line-height:1.4;">${resetUrl}</p>
              <hr style="border:none;border-top:1px solid #E8EEF8;margin:24px 0;" />
              <p style="margin:0;font-size:12px;color:#9BA8C0;line-height:1.5;">If you didn't request a password reset, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#F8FAFC;padding:20px 32px;text-align:center;border-top:1px solid #E8EEF8;">
              <p style="margin:0;font-size:11px;color:#9BA8C0;">&copy; ${new Date().getFullYear()} Drive Legal — Electronic Logbook built to NZTA Work Time and Logbooks Rule requirements</p>
              <p style="margin:4px 0 0;font-size:11px;color:#9BA8C0;">support@drivelegal.app</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildVerificationEmailHtml(verifyUrl: string, recipientName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email — Drive Legal</title>
</head>
<body style="margin:0;padding:0;background:#F0F4FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4FF;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,51,102,0.08);">
          <tr>
            <td style="background:#003366;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:2px;">DRIVE <span style="color:#4ADE80;">LEGAL</span></h1>
              <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.6);letter-spacing:1px;text-transform:uppercase;">DRIVER LOGBOOK</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#003366;">Verify Your Email</h2>
              <p style="margin:0 0 20px;font-size:14px;color:#4A5568;line-height:1.6;">Hi${recipientName ? " " + recipientName : ""},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#4A5568;line-height:1.6;">
                Thanks for registering with Drive Legal! Please verify your email address by clicking the button below. This link will expire in <strong>24 hours</strong>.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background:#5980E9;border-radius:10px;">
                    <a href="${verifyUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.5px;">Verify Email Address</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;font-size:13px;color:#6B7A99;line-height:1.5;">If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="margin:0 0 24px;font-size:12px;color:#5980E9;word-break:break-all;line-height:1.4;">${verifyUrl}</p>
              <hr style="border:none;border-top:1px solid #E8EEF8;margin:24px 0;" />
              <p style="margin:0;font-size:12px;color:#9BA8C0;line-height:1.5;">If you didn't create an account with Drive Legal, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#F8FAFC;padding:20px 32px;text-align:center;border-top:1px solid #E8EEF8;">
              <p style="margin:0;font-size:11px;color:#9BA8C0;">&copy; ${new Date().getFullYear()} Drive Legal — Electronic Logbook built to NZTA Work Time and Logbooks Rule requirements</p>
              <p style="margin:4px 0 0;font-size:11px;color:#9BA8C0;">support@drivelegal.app</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(
  toEmail: string,
  recipientName: string,
  verificationToken: string,
  baseUrl: string
): Promise<boolean> {
  try {
    const transporter = createTransporter();
    const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
    const html = buildVerificationEmailHtml(verifyUrl, recipientName);
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: toEmail,
      subject: "Verify Your Email — Drive Legal",
      html,
    });
    console.log(`[Email] Verification email sent to ${toEmail}. MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send verification email via SMTP:", error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  toEmail: string,
  recipientName: string,
  resetToken: string,
  baseUrl: string,
  userType: "driver" | "operator"
): Promise<boolean> {
  try {
    const transporter = createTransporter();
    const resetPath = userType === "operator" ? "/portal/reset-password" : "/reset-password";
    const resetUrl = `${baseUrl}${resetPath}?token=${resetToken}`;
    const html = buildResetEmailHtml(resetUrl, recipientName);
    const info = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: toEmail,
      subject: "Reset Your Password — Drive Legal",
      html,
    });
    console.log(`[Email] Password reset email sent to ${toEmail}. MessageId: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("[Email] Failed to send reset email via SMTP:", error);
    return false;
  }
}
