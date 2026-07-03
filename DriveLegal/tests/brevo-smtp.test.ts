import { describe, it, expect } from "vitest";
import * as nodemailer from "nodemailer";

describe("Brevo SMTP Key Validation", () => {
  it("should connect to Brevo SMTP relay with the configured key", async () => {
    const smtpKey = process.env.BREVO_SMTP_KEY;
    expect(smtpKey).toBeDefined();
    expect(smtpKey!.length).toBeGreaterThan(5);

    // Brevo SMTP uses the API key as both user and pass
    // The 'user' for Brevo SMTP relay is the account login email
    // but with API keys, the login is the key itself
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_LOGIN || "support@drivelegal.app",
        pass: smtpKey,
      },
    });

    // Verify connection — this checks credentials without sending an email
    const verified = await transporter.verify();
    expect(verified).toBe(true);
  }, 15000);
});
