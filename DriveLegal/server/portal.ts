/**
 * Operator/Employer Portal — Server-rendered web dashboard.
 * Operators log in with separate credentials and view their drivers' shift records read-only.
 * Accessible at /portal on the API server.
 */
import { Router, Request, Response } from "express";
import { createHmac, createHash } from "crypto";
import * as db from "./db";
import { sendPasswordResetEmail } from "./email";

const portalRouter = Router();

// JWT-based sessions — survive server restarts and Cloud Run cold starts
const PORTAL_JWT_SECRET = process.env.PORTAL_JWT_SECRET || "drivelegal-portal-secret-2026";

function signSession(payload: { operatorId: number; email: string; companyName: string; contactName: string }): string {
  // Simple HMAC-signed base64 token (no external deps)
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", PORTAL_JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifySession(token: string): { operatorId: number; email: string; companyName: string; contactName: string } | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const expected = createHmac("sha256", PORTAL_JWT_SECRET).update(data).digest("base64url");
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function getSession(req: Request) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/portal_session=([^;]+)/);
  if (!match) return null;
  return verifySession(decodeURIComponent(match[1]));
}

// Password hash — SHA-256 (matches admin dashboard operator creation)
function simpleHash(str: string): string {
  return createHash("sha256").update(str).digest("hex");
}

// ─── Portal Login Page ────────────────────────────────────────────────────────

portalRouter.get("/login", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderLoginPage());
});

portalRouter.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderLoginPage("Email and password are required."));
    return;
  }

  const operator = await db.getOperatorByEmail(email);
  if (!operator) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderLoginPage("Invalid credentials."));
    return;
  }

  const passwordHash = simpleHash(password);
  if (operator.passwordHash !== passwordHash) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderLoginPage("Invalid credentials."));
    return;
  }

  const token = signSession({
    operatorId: operator.id,
    email: operator.email,
    companyName: operator.companyName,
    contactName: operator.contactName,
  });

  res.setHeader("Set-Cookie", `portal_session=${encodeURIComponent(token)}; Path=/portal; HttpOnly; SameSite=Lax; Max-Age=86400`);
  res.redirect("/portal/dashboard");
});

portalRouter.get("/logout", (_req: Request, res: Response) => {
  // JWT-based sessions: just clear the cookie (no server-side state to delete)
  res.setHeader("Set-Cookie", "portal_session=; Path=/portal; HttpOnly; Max-Age=0");
  res.redirect("/portal/login");
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

portalRouter.get("/dashboard", async (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session) { res.redirect("/portal/login"); return; }

  const drivers = await db.getOperatorDrivers(session.operatorId);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderDashboard(session, drivers));
});

// ─── Driver Detail ────────────────────────────────────────────────────────────

portalRouter.get("/driver/:driverLocalUserId", async (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session) { res.redirect("/portal/login"); return; }

  const driverLocalUserId = req.params.driverLocalUserId;
  
  // Verify operator has access to this driver
  const drivers = await db.getOperatorDrivers(session.operatorId);
  const driver = drivers.find((d) => d.localUserId === driverLocalUserId);
  if (!driver) {
    res.status(403).send("Access denied");
    return;
  }

  const logs = await db.getDriverShiftLogs(driverLocalUserId);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderDriverDetail(session, driver, logs));
});

// ─── Forgot Password ─────────────────────────────────────────────────────────

portalRouter.get("/forgot-password", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderForgotPasswordPage());
});

portalRouter.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderForgotPasswordPage("Please enter your email address."));
    return;
  }

  // Always show success message to prevent email enumeration
  const operator = await db.getOperatorByEmail(email);
  if (operator) {
    const token = await db.createResetToken(email, "operator");
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    await sendPasswordResetEmail(email, operator.contactName, token, baseUrl, "operator");
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderForgotPasswordPage(undefined, "If an account with that email exists, we've sent a password reset link. Please check your inbox."));
});

portalRouter.get("/reset-password", async (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderResetPasswordPage("", "Invalid or missing reset token."));
    return;
  }

  const resetToken = await db.getResetToken(token);
  if (!resetToken) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderResetPasswordPage("", "This reset link has expired or is invalid. Please request a new one."));
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderResetPasswordPage(token));
});

portalRouter.post("/reset-password", async (req: Request, res: Response) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderResetPasswordPage(token || "", "All fields are required."));
    return;
  }

  if (password !== confirmPassword) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderResetPasswordPage(token, "Passwords do not match."));
    return;
  }

  if (password.length < 10) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderResetPasswordPage(token, "Password must be at least 10 characters."));
    return;
  }

  const resetToken = await db.getResetToken(token);
  if (!resetToken) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderResetPasswordPage("", "This reset link has expired or is invalid. Please request a new one."));
    return;
  }

  const newHash = simpleHash(password);
  const updated = await db.updateOperatorPassword(resetToken.email, newHash);
  await db.deleteResetToken(token);

  if (updated) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderResetSuccessPage());
  } else {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(renderResetPasswordPage("", "Failed to update password. Please try again."));
  }
});

// ─── Root redirect ────────────────────────────────────────────────────────────

portalRouter.get("/", (req: Request, res: Response) => {
  const session = getSession(req);
  if (session) {
    res.redirect("/portal/dashboard");
  } else {
    res.redirect("/portal/login");
  }
});

export { portalRouter };

// ─── HTML Renderers ───────────────────────────────────────────────────────────

function renderLoginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Operator Portal — Drive Legal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F0F4FF; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .login-card { background: #FFFFFF; border-radius: 24px; padding: 40px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,51,102,0.08); }
    .brand { text-align: center; margin-bottom: 32px; }
    .brand h1 { font-size: 28px; font-weight: 800; color: #003366; letter-spacing: 2px; }
    .brand h1 span { color: #4ADE80; }
    .brand p { font-size: 13px; color: #6B7A99; margin-top: 8px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 11px; font-weight: 600; color: #6B7A99; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .form-group input { width: 100%; padding: 14px 16px; border: 1px solid #D1DCF0; border-radius: 12px; font-size: 15px; color: #003366; background: #F8FAFC; outline: none; transition: border-color 0.2s; }
    .form-group input:focus { border-color: #5980E9; background: #FFFFFF; }
    .btn { width: 100%; padding: 16px; background: #003366; color: #FFFFFF; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 8px; transition: background 0.2s; }
    .btn:hover { background: #004488; }
    .error { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #B91C1C; }
    .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #9BA8C0; }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="brand">
      <h1>DRIVE <span>LEGAL</span></h1>
      <p>Operator / Employer Portal</p>
    </div>
    ${error ? `<div class="error">${error}</div>` : ""}
    <form method="POST" action="/portal/login">
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" placeholder="operator@company.co.nz" required />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" placeholder="Enter password" required />
      </div>
      <button type="submit" class="btn">Sign In</button>
    </form>
    <div style="text-align:center;margin-top:16px;">
      <a href="/portal/forgot-password" style="font-size:13px;color:#5980E9;text-decoration:none;">Forgot Password?</a>
    </div>
    <div class="footer">
      <p>This portal is for authorised operators/employers only.</p>
      <p style="margin-top:4px;">NZTA Test Account: operator@drivelegal.app / DriveLegal2026</p>
    </div>
  </div>
</body>
</html>`;
}

function renderDashboard(session: { companyName: string; contactName: string; email: string }, drivers: any[]): string {
  const driverRows = drivers.map((d) => `
    <tr>
      <td><a href="/portal/driver/${d.localUserId}" style="color:#5980E9;font-weight:600;text-decoration:none;">${d.name}</a></td>
      <td>${d.licenceNumber || "—"}</td>
      <td>${d.vehicleRegistration || "—"}</td>
      <td><span style="background:#E0F2FE;color:#0369A1;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">${formatDriverType(d.driverType)}</span></td>
      <td><a href="/portal/driver/${d.localUserId}" style="color:#5980E9;font-size:12px;">View Records →</a></td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Operator Portal — Drive Legal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #001a33; color: #E8EEF8; }
    .header { background: #003366; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .header h1 { color: #FFFFFF; font-size: 20px; font-weight: 800; letter-spacing: 1px; }
    .header h1 span { color: #4ADE80; }
    .header-right { display: flex; align-items: center; gap: 16px; }
    .header-right span { color: rgba(255,255,255,0.6); font-size: 13px; }
    .header-right a { color: #FFFFFF; font-size: 13px; text-decoration: none; background: rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 6px; }
    .header-right a:hover { background: rgba(255,255,255,0.2); }
    .container { max-width: 1200px; margin: 0 auto; padding: 32px; }
    .welcome { margin-bottom: 32px; }
    .welcome h2 { font-size: 24px; font-weight: 700; color: #ffffff; }
    .welcome p { font-size: 14px; color: rgba(255,255,255,0.6); margin-top: 4px; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; border: 1px solid rgba(255,255,255,0.12); }
    .stat-card .value { font-size: 28px; font-weight: 800; color: #ffffff; }
    .stat-card .label { font-size: 12px; color: rgba(255,255,255,0.55); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .section-title { font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.12); }
    th { background: rgba(255,255,255,0.05); padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    td { padding: 14px 16px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 13px; color: #E8EEF8; }
    tr:hover td { background: rgba(255,255,255,0.04); }
    .empty { text-align: center; padding: 40px; color: rgba(255,255,255,0.5); font-size: 14px; }
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .table-scroll table { min-width: 500px; }
    @media (max-width: 640px) {
      .header { padding: 12px 16px; }
      .header h1 { font-size: 15px; }
      .header-right span { display: none; }
      .container { padding: 16px; }
      .welcome h2 { font-size: 20px; }
      .stats { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DRIVE <span>LEGAL</span> &nbsp;|&nbsp; Operator Portal</h1>
    <div class="header-right">
      <span>${session.companyName} (${session.contactName})</span>
      <a href="/portal/logout">Sign Out</a>
    </div>
  </div>
  <div class="container">
    <div class="welcome">
      <h2>Welcome, ${session.contactName}</h2>
      <p>${session.companyName} — Operator Dashboard</p>
    </div>
    <div class="stats">
      <div class="stat-card">
        <div class="value">${drivers.length}</div>
        <div class="label">Linked Drivers</div>
      </div>
      <div class="stat-card">
        <div class="value">—</div>
        <div class="label">Active Shifts Today</div>
      </div>
      <div class="stat-card">
        <div class="value">0</div>
        <div class="label">Breach Alerts (7 days)</div>
      </div>
    </div>
    <div class="section-title">Your Drivers</div>
    ${drivers.length > 0 ? `
    <div class="table-scroll"><table>
      <thead>
        <tr>
          <th>Driver Name</th>
          <th>Licence</th>
          <th>Vehicle Rego</th>
          <th>Type</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${driverRows}</tbody>
    </table></div>
    ` : `<div class="empty">No drivers linked to your account yet. Drivers must sync their logbook data to appear here.</div>`}
  </div>
</body>
</html>`;
}

function renderDriverDetail(session: any, driver: any, logs: any[]): string {
  // Calculate breach/warning alerts from logs
  const breachAlerts: string[] = [];
  for (const log of logs) {
    const logData = log.logData as any;
    if (!logData) continue;
    const drivingSecs = logData.totalDrivingSeconds || 0;
    const workSecs = logData.totalWorkSeconds || 0;
    const driverType = driver.driverType || "small_passenger";
    const maxDriving = (driverType === "small_passenger") ? 7 * 3600 : 5.5 * 3600;
    if (drivingSecs > maxDriving) {
      breachAlerts.push(`⚠️ ${logData.date}: Driving limit exceeded (${formatHM(drivingSecs)} / ${formatHM(maxDriving)} max)`);
    }
    if (workSecs > 13 * 3600) {
      breachAlerts.push(`🚨 ${logData.date}: Work time exceeded 13 hours (${formatHM(workSecs)})`);
    }
  }

  const logRows = logs.slice(0, 50).map((log) => {
    const d = log.logData as any;
    if (!d) return "";
    return `
      <tr>
        <td>${d.date || log.date}</td>
        <td>${formatTimeShort(d.startTime)}</td>
        <td>${formatTimeShort(d.endTime)}</td>
        <td style="font-weight:600;">${formatHM(d.totalDrivingSeconds || 0)}</td>
        <td>${formatHM(d.totalWorkSeconds || 0)}</td>
        <td>${d.breaks?.length || 0}</td>
        <td>${d.startLocation?.displayName || "—"}</td>
      </tr>
    `;
  }).join("");

  // Build activity grid HTML for this driver's logs
  const activityGridHtml = buildPortalActivityGrid(logs.slice(0, 14));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${driver.name} — Operator Portal — Drive Legal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #001a33; color: #E8EEF8; }
    .header { background: #003366; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .header h1 { color: #FFFFFF; font-size: 20px; font-weight: 800; letter-spacing: 1px; }
    .header h1 span { color: #4ADE80; }
    .header-right { display: flex; align-items: center; gap: 16px; }
    .header-right span { color: rgba(255,255,255,0.6); font-size: 13px; }
    .header-right a { color: #FFFFFF; font-size: 13px; text-decoration: none; background: rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 6px; }
    .container { max-width: 1200px; margin: 0 auto; padding: 32px; }
    .back { display: inline-flex; align-items: center; gap: 6px; color: #7BA7FF; font-size: 13px; text-decoration: none; margin-bottom: 24px; }
    .back:hover { text-decoration: underline; }
    .driver-card { background: rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; border: 1px solid rgba(255,255,255,0.12); margin-bottom: 24px; }
    .driver-card h2 { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
    .driver-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .info-item .label { font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; font-weight: 600; }
    .info-item .value { font-size: 14px; color: #E8EEF8; font-weight: 600; margin-top: 2px; }
    .alerts { margin-bottom: 24px; }
    .alert { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; font-size: 12px; color: #FCA5A5; }
    .alert.warning { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.4); color: #FCD34D; }
    .section-title { font-size: 16px; font-weight: 700; color: #ffffff; margin-bottom: 16px; margin-top: 24px; }
    .grid-container { background: rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; border: 1px solid rgba(255,255,255,0.12); margin-bottom: 24px; }
    .grid-legend { display: flex; gap: 16px; margin-bottom: 12px; }
    .grid-legend-item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: rgba(255,255,255,0.6); }
    .grid-legend-item .swatch { width: 14px; height: 14px; border-radius: 3px; }
    .grid-row { display: flex; align-items: center; margin-bottom: 3px; }
    .grid-label { width: 80px; font-size: 10px; color: rgba(255,255,255,0.55); font-weight: 500; }
    .grid-bar { flex: 1; display: flex; height: 20px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
    table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.07); border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.12); }
    th { background: rgba(255,255,255,0.05); padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.5); text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.1); }
    td { padding: 12px 14px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #E8EEF8; }
    .read-only-badge { display: inline-block; background: rgba(89,128,233,0.25); color: #93B4FF; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; margin-left: 12px; }
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .table-scroll table { min-width: 500px; }
    @media (max-width: 640px) {
      .header { padding: 12px 16px; }
      .header h1 { font-size: 15px; }
      .header-right span { display: none; }
      .header-right a { padding: 5px 8px; font-size: 12px; }
      .container { padding: 16px; }
      .driver-info { grid-template-columns: 1fr 1fr; }
      .driver-card h2 { font-size: 18px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DRIVE <span>LEGAL</span> &nbsp;|&nbsp; Operator Portal</h1>
    <div class="header-right">
      <span>${session.companyName}</span>
      <a href="/portal/dashboard">← Dashboard</a>
      <a href="/portal/logout">Sign Out</a>
    </div>
  </div>
  <div class="container">
    <a href="/portal/dashboard" class="back">← Back to Dashboard</a>
    
    <div class="driver-card">
      <h2>${driver.name} <span class="read-only-badge">READ-ONLY</span></h2>
      <div class="driver-info">
        <div class="info-item">
          <div class="label">Licence Number</div>
          <div class="value">${driver.licenceNumber || "—"}</div>
        </div>
        <div class="info-item">
          <div class="label">Vehicle Registration</div>
          <div class="value">${driver.vehicleRegistration || "—"}</div>
        </div>
        <div class="info-item">
          <div class="label">Vehicle Type</div>
          <div class="value">${driver.vehicleType || "—"}</div>
        </div>
        <div class="info-item">
          <div class="label">Driver Classification</div>
          <div class="value">${formatDriverType(driver.driverType)}</div>
        </div>
      </div>
    </div>

    ${breachAlerts.length > 0 ? `
    <div class="section-title">⚠️ Breach / Warning Alerts</div>
    <div class="alerts">
      ${breachAlerts.map((a) => `<div class="alert">${a}</div>`).join("")}
    </div>
    ` : ""}

    <div class="section-title">Activity Grid (Last 14 Days)</div>
    <div class="grid-container">
      <div class="grid-legend">
        <div class="grid-legend-item"><div class="swatch" style="background:#003366;"></div>Driving</div>
        <div class="grid-legend-item"><div class="swatch" style="background:#5980E9;"></div>Other Work</div>
        <div class="grid-legend-item"><div class="swatch" style="background:#22C55E;"></div>Rest Break</div>
        <div class="grid-legend-item"><div class="swatch" style="background:#E2E8F0;"></div>Off Duty</div>
      </div>
      ${activityGridHtml}
    </div>

    <div class="section-title">Shift History</div>
    <div class="table-scroll"><table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Start</th>
          <th>End</th>
          <th>Driving</th>
          <th>Work</th>
          <th>Breaks</th>
          <th>Location</th>
        </tr>
      </thead>
      <tbody>${logRows || '<tr><td colspan="7" style="text-align:center;color:#6B7A99;">No shift records synced yet.</td></tr>'}</tbody>
    </table></div>
  </div>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTimeShort(isoString: string): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return "—"; }
}

function formatDriverType(type: string): string {
  switch (type) {
    case "goods": return "Goods Service";
    case "large_passenger": return "Large Passenger";
    case "small_passenger": return "Small Passenger";
    case "vehicle_recovery": return "Vehicle Recovery";
    default: return type || "—";
  }
}

function buildPortalActivityGrid(logs: any[]): string {
  if (logs.length === 0) return '<div style="font-size:12px;color:#6B7A99;padding:8px;">No activity data available</div>';

  const rows: string[] = [];
  
  // Process last 14 days
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const dateLabel = date.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });

    // Find logs for this day
    const dayLogs = logs.filter((log) => {
      const logData = log.logData as any;
      return logData?.date === dateStr || log.date === dateStr;
    });

    let blocks: { type: string; widthPct: number }[] = [];

    if (dayLogs.length > 0) {
      for (const log of dayLogs) {
        const logData = log.logData as any;
        if (!logData?.events) continue;
        const events = logData.events;
        
        for (let j = 0; j < events.length - 1; j++) {
          const current = events[j];
          const next = events[j + 1];
          const startMin = getMinOfDay(current.timestamp);
          const endMin = getMinOfDay(next.timestamp);
          
          let type = "driving";
          if (current.type === "break_start") type = "rest_break";
          else if (current.type === "other_work_start") type = "other_work";
          
          const duration = endMin > startMin ? endMin - startMin : 0;
          if (duration > 0) {
            blocks.push({ type, widthPct: (duration / 1440) * 100 });
          }
        }
      }
      
      // Fill remaining as off-duty
      const usedPct = blocks.reduce((s, b) => s + b.widthPct, 0);
      if (usedPct < 100) {
        blocks.push({ type: "off_duty", widthPct: 100 - usedPct });
      }
    } else {
      blocks = [{ type: "off_duty", widthPct: 100 }];
    }

    const colors: Record<string, string> = {
      driving: "#003366",
      other_work: "#5980E9",
      rest_break: "#22C55E",
      off_duty: "#E2E8F0",
    };

    const blockHtml = blocks.map((b) => 
      `<div style="height:20px;width:${b.widthPct.toFixed(1)}%;background-color:${colors[b.type] || "#E2E8F0"};"></div>`
    ).join("");

    rows.push(`
      <div class="grid-row">
        <div class="grid-label">${dateLabel}</div>
        <div class="grid-bar">${blockHtml}</div>
      </div>
    `);
  }

  return rows.join("");
}

function getMinOfDay(isoString: string): number {
  try {
    const d = new Date(isoString);
    return d.getHours() * 60 + d.getMinutes();
  } catch { return 0; }
}

// ─── Forgot/Reset Password Page Renderers ────────────────────────────────────

function renderForgotPasswordPage(error?: string, success?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forgot Password — Operator Portal — Drive Legal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F0F4FF; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #FFFFFF; border-radius: 24px; padding: 40px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,51,102,0.08); }
    .brand { text-align: center; margin-bottom: 32px; }
    .brand h1 { font-size: 28px; font-weight: 800; color: #003366; letter-spacing: 2px; }
    .brand h1 span { color: #4ADE80; }
    .brand p { font-size: 13px; color: #6B7A99; margin-top: 8px; }
    h2 { font-size: 20px; font-weight: 700; color: #003366; margin-bottom: 8px; }
    .desc { font-size: 13px; color: #6B7A99; margin-bottom: 24px; line-height: 1.5; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 11px; font-weight: 600; color: #6B7A99; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .form-group input { width: 100%; padding: 14px 16px; border: 1px solid #D1DCF0; border-radius: 12px; font-size: 15px; color: #003366; background: #F8FAFC; outline: none; transition: border-color 0.2s; }
    .form-group input:focus { border-color: #5980E9; background: #FFFFFF; }
    .btn { width: 100%; padding: 16px; background: #003366; color: #FFFFFF; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 8px; transition: background 0.2s; }
    .btn:hover { background: #004488; }
    .error { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #B91C1C; }
    .success { background: #DCFCE7; border: 1px solid #BBF7D0; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #166534; }
    .back-link { display: block; text-align: center; margin-top: 20px; font-size: 13px; color: #5980E9; text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <h1>DRIVE <span>LEGAL</span></h1>
      <p>Operator Portal</p>
    </div>
    <h2>Forgot Password</h2>
    <p class="desc">Enter the email address associated with your operator account. We'll send you a link to reset your password.</p>
    ${error ? `<div class="error">${error}</div>` : ""}
    ${success ? `<div class="success">${success}</div>` : ""}
    ${!success ? `
    <form method="POST" action="/portal/forgot-password">
      <div class="form-group">
        <label>Email Address</label>
        <input type="email" name="email" placeholder="operator@company.co.nz" required />
      </div>
      <button type="submit" class="btn">Send Reset Link</button>
    </form>
    ` : ""}
    <a href="/portal/login" class="back-link">← Back to Sign In</a>
  </div>
</body>
</html>`;
}

function renderResetPasswordPage(token: string, error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password — Operator Portal — Drive Legal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F0F4FF; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #FFFFFF; border-radius: 24px; padding: 40px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,51,102,0.08); }
    .brand { text-align: center; margin-bottom: 32px; }
    .brand h1 { font-size: 28px; font-weight: 800; color: #003366; letter-spacing: 2px; }
    .brand h1 span { color: #4ADE80; }
    .brand p { font-size: 13px; color: #6B7A99; margin-top: 8px; }
    h2 { font-size: 20px; font-weight: 700; color: #003366; margin-bottom: 8px; }
    .desc { font-size: 13px; color: #6B7A99; margin-bottom: 24px; line-height: 1.5; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 11px; font-weight: 600; color: #6B7A99; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .form-group input { width: 100%; padding: 14px 16px; border: 1px solid #D1DCF0; border-radius: 12px; font-size: 15px; color: #003366; background: #F8FAFC; outline: none; transition: border-color 0.2s; }
    .form-group input:focus { border-color: #5980E9; background: #FFFFFF; }
    .btn { width: 100%; padding: 16px; background: #003366; color: #FFFFFF; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 8px; transition: background 0.2s; }
    .btn:hover { background: #004488; }
    .error { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #B91C1C; }
    .back-link { display: block; text-align: center; margin-top: 20px; font-size: 13px; color: #5980E9; text-decoration: none; }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">
      <h1>DRIVE <span>LEGAL</span></h1>
      <p>Operator Portal</p>
    </div>
    <h2>Reset Password</h2>
    <p class="desc">Enter your new password below.</p>
    ${error ? `<div class="error">${error}</div>` : ""}
    ${token ? `
    <form method="POST" action="/portal/reset-password">
      <input type="hidden" name="token" value="${token}" />
      <div class="form-group">
        <label>New Password</label>
        <input type="password" name="password" placeholder="Enter new password (min 10 characters)" required minlength="10" />
      </div>
      <div class="form-group">
        <label>Confirm Password</label>
        <input type="password" name="confirmPassword" placeholder="Re-enter new password" required minlength="10" />
      </div>
      <button type="submit" class="btn">Update Password</button>
    </form>
    ` : ""}
    <a href="/portal/login" class="back-link">← Back to Sign In</a>
  </div>
</body>
</html>`;
}

function renderResetSuccessPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset — Operator Portal — Drive Legal</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F0F4FF; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #FFFFFF; border-radius: 24px; padding: 40px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,51,102,0.08); text-align: center; }
    .brand h1 { font-size: 28px; font-weight: 800; color: #003366; letter-spacing: 2px; margin-bottom: 32px; }
    .brand h1 span { color: #4ADE80; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h2 { font-size: 20px; font-weight: 700; color: #003366; margin-bottom: 8px; }
    .desc { font-size: 14px; color: #6B7A99; margin-bottom: 24px; line-height: 1.5; }
    .btn { display: inline-block; padding: 14px 32px; background: #5980E9; color: #FFFFFF; border-radius: 12px; font-size: 15px; font-weight: 700; text-decoration: none; transition: background 0.2s; }
    .btn:hover { background: #4060C9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand"><h1>DRIVE <span>LEGAL</span></h1></div>
    <div class="icon">✅</div>
    <h2>Password Updated</h2>
    <p class="desc">Your password has been successfully reset. You can now sign in with your new password.</p>
    <a href="/portal/login" class="btn">Sign In</a>
  </div>
</body>
</html>`;
}
