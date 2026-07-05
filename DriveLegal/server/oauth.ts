import { Express, Request, Response } from "express";
import crypto from "crypto";

/**
 * Simple OAuth placeholder system (Railway-safe)
 * You can later replace with Google / Apple OAuth fully
 */

const pendingTokens = new Map<string, string>();

/**
 * Register OAuth routes
 */
export function registerOAuthRoutes(app: Express) {
  /**
   * Step 1: Start login
   * Example: /auth/login?email=test@email.com
   */
  app.get("/auth/login", async (req: Request, res: Response) => {
    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    const token = crypto.randomUUID();

    pendingTokens.set(token, email);

    // Redirect back to app (Expo deep link)
    const redirectUrl = `manusguidednzlogbook://auth-callback?token=${token}`;

    res.json({
      success: true,
      redirectUrl,
    });
  });

  /**
   * Step 2: Exchange token for user session
   */
  app.get("/auth/verify", async (req: Request, res: Response) => {
    const token = req.query.token as string;

    if (!token || !pendingTokens.has(token)) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const email = pendingTokens.get(token)!;
    pendingTokens.delete(token);

    // TODO: Replace with real JWT later
    res.json({
      success: true,
      user: {
        email,
      },
      sessionToken: crypto.randomUUID(),
    });
  });

  /**
   * Optional: Logout endpoint
   */
  app.post("/auth/logout", (_req: Request, res: Response) => {
    res.json({ success: true });
  });
}