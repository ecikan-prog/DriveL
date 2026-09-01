import { afterEach, describe, expect, it, vi } from "vitest";

import { sendVerificationEmail } from "../server/email";

const originalBrevoApiKey = process.env.BREVO_API_KEY;

afterEach(() => {
  if (originalBrevoApiKey === undefined) {
    delete process.env.BREVO_API_KEY;
  } else {
    process.env.BREVO_API_KEY = originalBrevoApiKey;
  }
  vi.restoreAllMocks();
});

describe("Brevo email delivery", () => {
  it("sends verification email through the Brevo HTTP API", async () => {
    process.env.BREVO_API_KEY = "test-brevo-api-key";

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ messageId: "abc123" }),
    } as Response);

    const result = await sendVerificationEmail(
      "driver@example.com",
      "Driver",
      "verify-token",
      "https://operators.drivelegal.app/"
    );

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "api-key": "test-brevo-api-key",
        "Content-Type": "application/json",
      }),
    });
    expect(String(init?.body)).toContain(
      "https://operators.drivelegal.app/verify-email?token=verify-token"
    );
  });
});
