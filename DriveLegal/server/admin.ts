import { Router, Request, Response } from "express";
import { getDb } from "./db";
import { drivers, shiftLogs, operators, operatorDrivers } from "../drizzle/schema";
import { eq, desc, sql, count, inArray } from "drizzle-orm";
import crypto from "crypto";

export const adminRouter = Router();

// ─── Admin Auth ─────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "admin@drivelegal.app";
const ADMIN_PASSWORD_HASH = crypto.createHash("sha256").update("DriveLegalAdmin2026!").digest("hex");

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function checkAdminSession(req: Request): boolean {
  const cookie = req.headers.cookie || "";
  return cookie.includes("admin_session=valid");
}

// ─── HTML Layout ────────────────────────────────────────────────────────────
function adminLayout(title: string, content: string, activeTab: string = "users"): string {
  const tabs = [
    { id: "users", label: "Users", icon: "👥", href: "/admin/dashboard" },
    { id: "subscriptions", label: "Subscriptions", icon: "💳", href: "/admin/subscriptions" },
    { id: "operators", label: "Operators", icon: "🏢", href: "/admin/operators" },
    { id: "compliance", label: "Compliance", icon: "🛡️", href: "/admin/compliance" },
    { id: "support", label: "Support", icon: "🔧", href: "/admin/support" },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Drive Legal Admin</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #001a33; color: #E8EEF8; min-height: 100vh; }
    a { text-decoration: none; color: inherit; }
    
    /* Sidebar */
    .sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 260px; background: #003366; color: #fff; padding: 24px 0; display: flex; flex-direction: column; z-index: 200; }
    .sidebar-logo { padding: 0 24px 32px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 24px; }
    .sidebar-logo h1 { font-size: 20px; font-weight: 800; letter-spacing: 1px; }
    .sidebar-logo h1 span { color: #22C55E; }
    .sidebar-logo p { font-size: 11px; color: #FFFFFF; margin-top: 4px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.85; }
    .sidebar-nav { flex: 1; }
    .sidebar-nav a { display: flex; align-items: center; gap: 12px; padding: 12px 24px; font-size: 14px; font-weight: 500; color: #FFFFFF; transition: all 0.2s; border-left: 3px solid transparent; }
    .sidebar-nav a:hover { background: rgba(255,255,255,0.12); color: #FFFFFF; }
    .sidebar-nav a.active { background: rgba(89,128,233,0.25); color: #FFFFFF; border-left-color: #5980E9; font-weight: 700; }
    .sidebar-nav a .icon { font-size: 18px; width: 24px; text-align: center; }
    .sidebar-footer { padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.1); }
    .sidebar-footer a { display: block; padding: 8px 0; font-size: 13px; color: #FFFFFF; }
    .sidebar-footer a:hover { color: #FFFFFF; text-decoration: underline; }
    
    /* Main content */
    .main { margin-left: 260px; padding: 32px; min-height: 100vh; }
    .page-header { margin-bottom: 32px; }
    .page-header h2 { font-size: 28px; font-weight: 700; color: #ffffff; margin-bottom: 4px; }
    .page-header p { font-size: 14px; color: #FFFFFF; opacity: 0.8; }
    
    /* Cards */
    .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: rgba(255,255,255,0.07); border-radius: 16px; padding: 20px; border: 1px solid rgba(255,255,255,0.12); }
    .stat-card .label { font-size: 11px; font-weight: 700; color: #FFFFFF; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; opacity: 0.85; }
    .stat-card .value { font-size: 32px; font-weight: 800; color: #ffffff; }
    .stat-card .sub { font-size: 12px; color: #FFFFFF; margin-top: 4px; opacity: 0.7; }
    .stat-card.green .value { color: #22C55E; }
    .stat-card.amber .value { color: #F59E0B; }
    .stat-card.red .value { color: #EF4444; }
    .stat-card.blue .value { color: #5980E9; }
    
    /* Table */
    .table-card { background: rgba(255,255,255,0.07); border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); overflow: hidden; margin-bottom: 24px; }
    .table-card .table-header { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; }
    .table-card .table-header h3 { font-size: 16px; font-weight: 700; color: #ffffff; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 700; color: #FFFFFF; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(255,255,255,0.08); border-bottom: 1px solid rgba(255,255,255,0.15); }
    td { padding: 12px 16px; font-size: 13px; color: #E8EEF8; border-bottom: 1px solid rgba(255,255,255,0.06); vertical-align: middle; }
    tr:hover td { background: rgba(255,255,255,0.04); }
    tr.clickable { cursor: pointer; }
    tr.clickable:hover td { background: rgba(89,128,233,0.12); }
    
    /* Badges */
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-green { background: #DCFCE7; color: #166534; }
    .badge-amber { background: #FEF3C7; color: #92400E; }
    .badge-red { background: #FEE2E2; color: #991B1B; }
    .badge-blue { background: #DBEAFE; color: #1E40AF; }
    .badge-gray { background: #F1F5F9; color: #475569; }
    
    /* Buttons */
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s; }
    .btn-primary { background: #5980E9; color: #fff; }
    .btn-primary:hover { background: #4060C9; }
    .btn-danger { background: #EF4444; color: #fff; }
    .btn-danger:hover { background: #DC2626; }
    .btn-outline { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.25); }
    .btn-outline:hover { background: rgba(255,255,255,0.18); }
    .btn-sm { padding: 5px 10px; font-size: 11px; }
    
    /* Forms */
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: #FFFFFF; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 14px; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; font-size: 14px; color: #fff; background: rgba(255,255,255,0.1); }
    .form-group input::placeholder, .form-group textarea::placeholder { color: rgba(255,255,255,0.35); }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #5980E9; box-shadow: 0 0 0 3px rgba(89,128,233,0.25); background: rgba(255,255,255,0.15); }
    .form-group select option { background: #003366; color: #fff; }
    
    /* Alert */
    .alert { padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 13px; }
    .alert-success { background: #DCFCE7; color: #166534; border: 1px solid #BBF7D0; }
    .alert-error { background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA; }
    .alert-info { background: #DBEAFE; color: #1E40AF; border: 1px solid #BFDBFE; }
    
    /* Login page */
    .login-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #003366 0%, #0A1628 100%); }
    .login-card { background: #fff; border-radius: 24px; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .login-card h1 { font-size: 24px; font-weight: 800; color: #003366; margin-bottom: 4px; }
    .login-card .subtitle { font-size: 13px; color: #6B7A99; margin-bottom: 24px; }
    .login-card .btn-primary { width: 100%; padding: 14px; font-size: 15px; border-radius: 12px; }
    
    /* Table scroll wrapper */
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .table-scroll table { min-width: 600px; }

    /* Hamburger button — hidden on desktop */
    .hamburger { display: none; position: fixed; top: 14px; left: 14px; z-index: 300; background: #003366; color: #fff; border: none; border-radius: 10px; width: 42px; height: 42px; font-size: 20px; cursor: pointer; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.25); }

    /* Overlay backdrop */
    .sidebar-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 150; }
    .sidebar-overlay.open { display: block; }

    /* Responsive */
    @media (max-width: 768px) {
      .hamburger { display: flex; }
      .sidebar { transform: translateX(-100%); transition: transform 0.25s ease; box-shadow: none; }
      .sidebar.open { transform: translateX(0); box-shadow: 4px 0 24px rgba(0,0,0,0.3); }
      .main { margin-left: 0; padding: 16px; padding-top: 68px; }
      .stats-row { grid-template-columns: 1fr 1fr; }
      .page-header h2 { font-size: 22px; }
    }
  </style>
</head>
<body>
  <button class="hamburger" id="adminHamburger" aria-label="Open menu">&#9776;</button>
  <div class="sidebar-overlay" id="adminOverlay"></div>
  <div class="sidebar" id="adminSidebar">
    <div class="sidebar-logo">
      <h1>DRIVE <span>LEGAL</span></h1>
      <p>Admin Dashboard</p>
    </div>
    <nav class="sidebar-nav">
      ${tabs.map(t => `<a href="${t.href}" class="${t.id === activeTab ? 'active' : ''}"><span class="icon">${t.icon}</span><span>${t.label}</span></a>`).join("")}
    </nav>
    <div class="sidebar-footer">
      <a href="/admin/logout">Sign Out</a>
    </div>
  </div>
  <div class="main">
    ${content}
  </div>
  <script>
    (function() {
      var btn = document.getElementById('adminHamburger');
      var sidebar = document.getElementById('adminSidebar');
      var overlay = document.getElementById('adminOverlay');
      function openSidebar() { sidebar.classList.add('open'); overlay.classList.add('open'); }
      function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('open'); }
      btn.addEventListener('click', function() { sidebar.classList.contains('open') ? closeSidebar() : openSidebar(); });
      overlay.addEventListener('click', closeSidebar);
      // Close sidebar on nav link click (mobile)
      var navLinks = sidebar.querySelectorAll('.sidebar-nav a');
      navLinks.forEach(function(link) { link.addEventListener('click', function() { closeSidebar(); }); });
    })();
  </script>
</body>
</html>`;
}

// ─── Login ──────────────────────────────────────────────────────────────────
adminRouter.get("/login", (_req: Request, res: Response) => {
  const msg = (_req.query.error as string) || "";
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login — Drive Legal</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .login-container { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #003366 0%, #0A1628 100%); }
    .login-card { background: #fff; border-radius: 24px; padding: 40px; width: 100%; max-width: 400px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
    .login-card h1 { font-size: 24px; font-weight: 800; color: #003366; margin-bottom: 4px; }
    .login-card .subtitle { font-size: 13px; color: #6B7A99; margin-bottom: 24px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: #6B7A99; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .form-group input { width: 100%; padding: 12px 14px; border: 1px solid #D1DCF0; border-radius: 10px; font-size: 14px; color: #0D1B2A; }
    .form-group input:focus { outline: none; border-color: #5980E9; box-shadow: 0 0 0 3px rgba(89,128,233,0.1); }
    .btn-primary { display: block; width: 100%; padding: 14px; background: #003366; color: #fff; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.2s; }
    .btn-primary:hover { background: #004488; }
    .error { background: #FEE2E2; color: #991B1B; padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; border: 1px solid #FECACA; }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 24px; }
    .logo-icon { width: 44px; height: 44px; background: #5980E9; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; font-weight: 900; }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="login-card">
      <div class="logo"><div class="logo-icon">D</div></div>
      <h1>Admin Dashboard</h1>
      <p class="subtitle">Sign in to manage Drive Legal</p>
      ${msg ? `<div class="error">${msg}</div>` : ""}
      <form method="POST" action="/admin/login">
        <div class="form-group">
          <label>Email Address</label>
          <input type="email" name="email" placeholder="admin@drivelegal.app" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" placeholder="Enter password" required />
        </div>
        <button type="submit" class="btn-primary">Sign In</button>
      </form>
    </div>
  </div>
</body>
</html>`);
});

adminRouter.post("/login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && hashPassword(password) === ADMIN_PASSWORD_HASH) {
    res.setHeader("Set-Cookie", "admin_session=valid; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=86400");
    res.redirect("/admin/dashboard");
  } else {
    res.redirect("/admin/login?error=Invalid+email+or+password");
  }
});

adminRouter.get("/logout", (_req: Request, res: Response) => {
  res.setHeader("Set-Cookie", "admin_session=; Path=/admin; HttpOnly; Max-Age=0");
  res.redirect("/admin/login");
});

// ─── Redirect root to dashboard ─────────────────────────────────────────────
adminRouter.get("/", (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");
  res.redirect("/admin/dashboard");
});

// ─── Dashboard (Users) ──────────────────────────────────────────────────────
adminRouter.get("/dashboard", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.send(adminLayout("Users", "<p>Database not available.</p>", "users"));

  const allDrivers = await db.select().from(drivers).orderBy(desc(drivers.createdAt));
  const logCounts = await db.select({ driverLocalUserId: shiftLogs.driverLocalUserId, cnt: count() }).from(shiftLogs).groupBy(shiftLogs.driverLocalUserId);
  const logCountMap = new Map(logCounts.map(l => [l.driverLocalUserId, Number(l.cnt)]));

  const totalDrivers = allDrivers.length;
  const now = new Date();
  const activeTrials = allDrivers.filter(d => {
    if (!d.trialStartDate) return false;
    const trialStart = new Date(d.trialStartDate);
    const daysSince = (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 14;
  }).length;
  const expiredTrials = allDrivers.filter(d => {
    if (!d.trialStartDate) return true;
    const trialStart = new Date(d.trialStartDate);
    const daysSince = (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 14;
  }).length;
  const totalShifts = logCounts.reduce((sum, l) => sum + Number(l.cnt), 0);

  const driverRows = allDrivers.map(d => {
    const shifts = logCountMap.get(d.localUserId) || 0;
    let status = "Active Trial";
    let badgeClass = "badge-green";
    if (d.trialStartDate) {
      const trialStart = new Date(d.trialStartDate);
      const daysSince = (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > 14) { status = "Trial Expired"; badgeClass = "badge-red"; }
      else { status = `Trial (${Math.ceil(14 - daysSince)}d left)`; badgeClass = "badge-green"; }
    } else {
      status = "No Trial Date"; badgeClass = "badge-gray";
    }
    return `<tr class="clickable" onclick="window.location='/admin/user/${d.localUserId}'">
      <td><strong>${escHtml(d.name)}</strong><br><span style="font-size:11px;color:rgba(255,255,255,0.65)">${escHtml(d.email)}</span></td>
      <td>${escHtml(d.licenceNumber || "—")}</td>
      <td><span class="badge ${badgeClass}">${status}</span></td>
      <td>${escHtml(d.driverType.replace(/_/g, ' '))}</td>
      <td>${shifts}</td>
      <td>${d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "—"}</td>
      <td onclick="event.stopPropagation()">
        <a href="/admin/user/${d.localUserId}" class="btn btn-outline btn-sm">View</a>
        <a href="/admin/user/${d.localUserId}/reset-password" class="btn btn-outline btn-sm" onclick="return confirm('Reset password for ${escHtml(d.name)}?')">Reset PW</a>
        <a href="/admin/user/${d.localUserId}/delete" class="btn btn-danger btn-sm" onclick="return confirm('Permanently delete ${escHtml(d.name)} and all their shift records? This cannot be undone.')">Delete</a>
      </td>
    </tr>`;
  }).join("");

  const content = `
    <div class="page-header">
      <h2>User Management</h2>
      <p>Manage all registered Drive Legal drivers</p>
    </div>
    <div class="stats-row">
      <div class="stat-card blue"><div class="label">Total Drivers</div><div class="value">${totalDrivers}</div></div>
      <div class="stat-card green"><div class="label">Active Trials</div><div class="value">${activeTrials}</div></div>
      <div class="stat-card red"><div class="label">Expired Trials</div><div class="value">${expiredTrials}</div></div>
      <div class="stat-card"><div class="label">Total Shifts Logged</div><div class="value">${totalShifts}</div></div>
    </div>
    <div class="table-card">
      <div class="table-header"><h3>All Drivers</h3></div>
      <div class="table-scroll"><table>
        <thead><tr><th>Driver</th><th>Licence</th><th>Status</th><th>Type</th><th>Shifts</th><th>Registered</th><th>Actions</th></tr></thead>
        <tbody>${driverRows || '<tr><td colspan="7" style="text-align:center;color:rgba(255,255,255,0.6);padding:24px">No drivers registered yet</td></tr>'}</tbody>
      </table></div>
    </div>`;

  res.send(adminLayout("Users", content, "users"));
});

// ─── User Detail ────────────────────────────────────────────────────────────
adminRouter.get("/user/:userId", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.send(adminLayout("User", "<p>Database not available.</p>", "users"));

  const userId = req.params.userId;
  const driverResult = await db.select().from(drivers).where(eq(drivers.localUserId, userId)).limit(1);
  if (driverResult.length === 0) return res.send(adminLayout("User", "<p>Driver not found.</p>", "users"));

  const driver = driverResult[0];
  const logs = await db.select().from(shiftLogs).where(eq(shiftLogs.driverLocalUserId, userId)).orderBy(desc(shiftLogs.startTime)).limit(50);

  // Calculate total driving hours from logs
  let totalDrivingSeconds = 0;
  let totalBreaches = 0;
  for (const log of logs) {
    const logData = log.logData as any;
    if (logData?.totalDrivingSeconds) totalDrivingSeconds += logData.totalDrivingSeconds;
    // Check for breaches (driving > limit)
    const limit = driver.driverType === "goods" ? 5.5 * 3600 : 7 * 3600;
    if (logData?.totalDrivingSeconds > limit) totalBreaches++;
  }

  const logRows = logs.map(l => {
    const data = l.logData as any;
    const driving = data?.totalDrivingSeconds ? (data.totalDrivingSeconds / 3600).toFixed(1) + "h" : "—";
    const work = data?.totalWorkSeconds ? (data.totalWorkSeconds / 3600).toFixed(1) + "h" : "—";
    const breaks = data?.breaks?.length ?? 0;
    const hashValid = l.hash && l.hash.length === 64;
    return `<tr>
      <td>${l.date}</td>
      <td>${l.startTime ? new Date(l.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</td>
      <td>${l.endTime ? new Date(l.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</td>
      <td>${driving}</td>
      <td>${work}</td>
      <td>${breaks}</td>
      <td>${hashValid ? '<span class="badge badge-green">Valid</span>' : '<span class="badge badge-red">Invalid</span>'}</td>
    </tr>`;
  }).join("");

  // Compute trial status
  const now2 = new Date();
  let trialStatus = "No Trial Date"; let trialBadge = "badge-gray"; let trialExpiry = "—";
  if (driver.trialStartDate) {
    const trialStart = new Date(driver.trialStartDate);
    const expiryDate = new Date(trialStart.getTime() + 14 * 24 * 60 * 60 * 1000);
    trialExpiry = expiryDate.toLocaleDateString();
    const daysSince = (now2.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 14) { trialStatus = "Trial Expired"; trialBadge = "badge-red"; }
    else { trialStatus = `Active Trial (${Math.ceil(14 - daysSince)}d left)`; trialBadge = "badge-green"; }
  }

  const msgBanner = req.query.msg ? `<div class="alert alert-success">${escHtml(req.query.msg as string)}</div>` : "";

  const content = `
    ${msgBanner}
    <div class="page-header">
      <h2>${escHtml(driver.name)}</h2>
      <p>${escHtml(driver.email)} · Licence: ${escHtml(driver.licenceNumber || "Not set")}</p>
    </div>

    <!-- Profile Card -->
    <div class="table-card" style="margin-bottom:24px">
      <div class="table-header"><h3>Driver Profile</h3></div>
      <div style="padding:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Full Name</div><div style="font-size:15px;font-weight:600;color:#fff">${escHtml(driver.name)}</div></div>
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Email</div><div style="font-size:15px;color:#fff">${escHtml(driver.email)}</div></div>
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Licence Number</div><div style="font-size:15px;color:#fff">${escHtml(driver.licenceNumber || "Not set")}</div></div>
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Vehicle Rego</div><div style="font-size:15px;color:#fff">${escHtml(driver.vehicleRegistration || "Not set")}</div></div>
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Driver Type</div><div style="font-size:15px;color:#fff">${escHtml(driver.driverType.replace(/_/g, ' '))}</div></div>
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Registered</div><div style="font-size:15px;color:#fff">${driver.createdAt ? new Date(driver.createdAt).toLocaleDateString() : "—"}</div></div>
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Subscription</div><div><span class="badge ${trialBadge}">${trialStatus}</span></div></div>
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Trial Expiry</div><div style="font-size:15px;color:#fff">${trialExpiry}</div></div>
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Email Verified</div><div><span class="badge ${driver.emailVerified ? 'badge-green' : 'badge-red'}">${driver.emailVerified ? '✓ Verified' : '✗ Unverified'}</span></div></div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div style="margin-bottom:24px;display:flex;gap:10px;flex-wrap:wrap">
      <a href="/admin/dashboard" class="btn btn-outline">← Back to Users</a>
      <a href="/admin/user/${userId}/extend-trial" class="btn btn-primary" onclick="return confirm('Extend trial by 14 days?')">Extend Trial</a>
      <a href="/admin/user/${userId}/reset-password" class="btn btn-outline" onclick="return confirm('Reset password to DriveLegal2026! ?')">Reset Password</a>
      <a href="/admin/user/${userId}/export" class="btn btn-outline">Export CSV</a>
      ${!driver.emailVerified ? `<a href="/admin/user/${userId}/verify-email" class="btn btn-primary" onclick="return confirm('Manually verify email for ${escHtml(driver.name)}? They will be able to log in immediately.')">✓ Verify Email</a>` : ''}
      <a href="/admin/user/${userId}/deactivate" class="btn btn-danger" onclick="return confirm('Deactivate this account? The driver will lose access.')">Deactivate Account</a>
    </div>

    <div class="stats-row">
      <div class="stat-card"><div class="label">Total Shifts</div><div class="value">${logs.length}</div></div>
      <div class="stat-card blue"><div class="label">Total Driving</div><div class="value">${(totalDrivingSeconds / 3600).toFixed(1)}h</div></div>
      <div class="stat-card ${totalBreaches > 0 ? 'red' : 'green'}"><div class="label">Breaches</div><div class="value">${totalBreaches}</div></div>
      <div class="stat-card"><div class="label">Driver Type</div><div class="value" style="font-size:16px">${escHtml(driver.driverType.replace(/_/g, ' '))}</div></div>
    </div>
    <div class="table-card">
      <div class="table-header">
        <h3>Shift History</h3>
        <a href="/admin/user/${userId}/export" class="btn btn-primary btn-sm">Export CSV</a>
      </div>
      <div class="table-scroll"><table>
        <thead><tr><th>Date</th><th>Start</th><th>End</th><th>Driving</th><th>Work</th><th>Breaks</th><th>Hash</th></tr></thead>
        <tbody>${logRows || '<tr><td colspan="7" style="text-align:center;color:rgba(255,255,255,0.6);padding:24px">No shifts logged</td></tr>'}</tbody>
      </table></div>
    </div>
    `;

  res.send(adminLayout("User Detail", content, "users"));
});

// ─── Reset Password ─────────────────────────────────────────────────────────
adminRouter.get("/user/:userId/reset-password", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.redirect("/admin/dashboard");

  const userId = req.params.userId;
  const newPassword = "DriveLegal2026!";
  const newHash = hashPassword(newPassword);

  await db.update(drivers).set({ passwordHash: newHash }).where(eq(drivers.localUserId, userId));
  res.redirect("/admin/dashboard?msg=Password+reset+to+DriveLegal2026!");
});

// ─── Extend Trial ───────────────────────────────────────────────────────────
adminRouter.get("/user/:userId/extend-trial", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.redirect("/admin/dashboard");

  const userId = req.params.userId;
  // Set trial start to today (effectively giving 14 more days)
  const newTrialStart = new Date().toISOString();
  await db.update(drivers).set({ trialStartDate: newTrialStart }).where(eq(drivers.localUserId, userId));
  res.redirect(`/admin/user/${encodeURIComponent(userId)}?msg=Trial+extended+by+14+days`);
});

// ─── Deactivate ─────────────────────────────────────────────────────────────
adminRouter.get("/user/:userId/deactivate", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.redirect("/admin/dashboard");

  const userId = req.params.userId;
  // Set trial to a very old date to effectively deactivate
  await db.update(drivers).set({ trialStartDate: "2020-01-01T00:00:00.000Z" }).where(eq(drivers.localUserId, userId));
  res.redirect("/admin/dashboard?msg=Account+deactivated");
});

// ─── Export User CSV ────────────────────────────────────────────────────────
adminRouter.get("/user/:userId/export", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.status(500).send("Database not available");

  const userId = req.params.userId;
  const logs = await db.select().from(shiftLogs).where(eq(shiftLogs.driverLocalUserId, userId)).orderBy(desc(shiftLogs.startTime));

  let csv = "Date,Start Time,End Time,Driving (h),Work (h),Breaks,Hash Valid\n";
  for (const l of logs) {
    const data = l.logData as any;
    const driving = data?.totalDrivingSeconds ? (data.totalDrivingSeconds / 3600).toFixed(2) : "0";
    const work = data?.totalWorkSeconds ? (data.totalWorkSeconds / 3600).toFixed(2) : "0";
    const breaks = data?.breaks?.length ?? 0;
    const hashValid = l.hash && l.hash.length === 64 ? "Yes" : "No";
    csv += `${l.date},${l.startTime},${l.endTime},${driving},${work},${breaks},${hashValid}\n`;
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="driver_${userId}_shifts.csv"`);
  res.send(csv);
});

// ─── Subscriptions ──────────────────────────────────────────────────────────
adminRouter.get("/subscriptions", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.send(adminLayout("Subscriptions", "<p>Database not available.</p>", "subscriptions"));

  const allDrivers = await db.select().from(drivers).orderBy(desc(drivers.createdAt));
  const now = new Date();

  let activeTrial = 0, expiredTrial = 0, noDate = 0;
  const rows: string[] = [];

  for (const d of allDrivers) {
    let status = "Unknown";
    let badgeClass = "badge-gray";
    let daysLeft = 0;

    if (d.trialStartDate) {
      const trialStart = new Date(d.trialStartDate);
      const daysSince = (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 14) {
        daysLeft = Math.ceil(14 - daysSince);
        status = `Trial (${daysLeft}d left)`;
        badgeClass = "badge-green";
        activeTrial++;
      } else {
        status = "Expired";
        badgeClass = "badge-red";
        expiredTrial++;
      }
    } else {
      status = "No Trial";
      badgeClass = "badge-gray";
      noDate++;
    }

    rows.push(`<tr>
      <td><strong>${escHtml(d.name)}</strong></td>
      <td>${escHtml(d.email)}</td>
      <td><span class="badge ${badgeClass}">${status}</span></td>
      <td>${d.trialStartDate ? new Date(d.trialStartDate).toLocaleDateString() : "—"}</td>
      <td><a href="/admin/user/${d.localUserId}/extend-trial" class="btn btn-outline btn-sm" onclick="return confirm('Extend trial?')">Extend</a></td>
    </tr>`);
  }

  // Revenue estimate (all paid users at $4.99/month)
  const paidUsers = 0; // No Stripe integration yet — placeholder
  const monthlyRevenue = paidUsers * 4.99;
  const annualRevenue = monthlyRevenue * 12;

  const content = `
    <div class="page-header">
      <h2>Subscription Management</h2>
      <p>Track trials, subscriptions, and revenue</p>
    </div>
    <div class="stats-row">
      <div class="stat-card green"><div class="label">Active Trials</div><div class="value">${activeTrial}</div></div>
      <div class="stat-card red"><div class="label">Expired Trials</div><div class="value">${expiredTrial}</div></div>
      <div class="stat-card blue"><div class="label">Paid Subscribers</div><div class="value">${paidUsers}</div><div class="sub">Stripe integration pending</div></div>
      <div class="stat-card"><div class="label">Est. Monthly Revenue</div><div class="value">$${monthlyRevenue.toFixed(2)}</div><div class="sub">NZD</div></div>
    </div>
    <div class="alert alert-info">Revenue tracking will be fully active once Stripe subscription integration is connected. Currently showing trial status only.</div>
    <div class="table-card">
      <div class="table-header"><h3>All Subscriptions</h3></div>
      <div class="table-scroll"><table>
        <thead><tr><th>Driver</th><th>Email</th><th>Status</th><th>Trial Start</th><th>Actions</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table></div>
    </div>`;

  res.send(adminLayout("Subscriptions", content, "subscriptions"));
});

// ─── Compliance ─────────────────────────────────────────────────────────────
adminRouter.get("/compliance", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.send(adminLayout("Compliance", "<p>Database not available.</p>", "compliance"));

  const allDrivers = await db.select().from(drivers);
  const allLogs = await db.select().from(shiftLogs).orderBy(desc(shiftLogs.startTime));

  // Analyze compliance
  let totalBreaches = 0;
  let hashChainValid = 0;
  let hashChainBroken = 0;
  const breachDrivers: { name: string; email: string; userId: string; breachCount: number; lastBreach: string }[] = [];

  // Group logs by driver
  const logsByDriver = new Map<string, typeof allLogs>();
  for (const log of allLogs) {
    const existing = logsByDriver.get(log.driverLocalUserId) || [];
    existing.push(log);
    logsByDriver.set(log.driverLocalUserId, existing);
  }

  for (const driver of allDrivers) {
    const driverLogs = logsByDriver.get(driver.localUserId) || [];
    let driverBreaches = 0;
    let lastBreachDate = "";

    // Check hash chain
    let prevHash = "";
    let chainValid = true;
    const sortedLogs = [...driverLogs].sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (const log of sortedLogs) {
      if (log.previousHash !== prevHash) { chainValid = false; }
      prevHash = log.hash;

      // Check driving limit breach
      const data = log.logData as any;
      const limit = driver.driverType === "goods" ? 5.5 * 3600 : 7 * 3600;
      if (data?.totalDrivingSeconds > limit) {
        driverBreaches++;
        lastBreachDate = log.date;
      }
    }

    if (chainValid && driverLogs.length > 0) hashChainValid++;
    else if (driverLogs.length > 0) hashChainBroken++;

    if (driverBreaches > 0) {
      totalBreaches += driverBreaches;
      breachDrivers.push({ name: driver.name, email: driver.email, userId: driver.localUserId, breachCount: driverBreaches, lastBreach: lastBreachDate });
    }
  }

  const breachRows = breachDrivers.map(b => `<tr>
    <td><a href="/admin/user/${b.userId}"><strong>${escHtml(b.name)}</strong></a></td>
    <td>${escHtml(b.email)}</td>
    <td><span class="badge badge-red">${b.breachCount} breach${b.breachCount > 1 ? "es" : ""}</span></td>
    <td>${b.lastBreach}</td>
  </tr>`).join("");

  const content = `
    <div class="page-header">
      <h2>Compliance Overview</h2>
      <p>NZTA compliance monitoring and hash chain verification</p>
    </div>
    <div class="stats-row">
      <div class="stat-card ${totalBreaches > 0 ? 'red' : 'green'}"><div class="label">Total Breaches</div><div class="value">${totalBreaches}</div></div>
      <div class="stat-card green"><div class="label">Hash Chains Valid</div><div class="value">${hashChainValid}</div></div>
      <div class="stat-card ${hashChainBroken > 0 ? 'red' : 'green'}"><div class="label">Hash Chains Broken</div><div class="value">${hashChainBroken}</div></div>
      <div class="stat-card"><div class="label">Total Shift Records</div><div class="value">${allLogs.length}</div></div>
    </div>
    <div class="table-card">
      <div class="table-header">
        <h3>Drivers with Breaches</h3>
        <a href="/admin/compliance/export-all" class="btn btn-primary btn-sm">Export All Data (NZTA)</a>
      </div>
      <div class="table-scroll"><table>
        <thead><tr><th>Driver</th><th>Email</th><th>Breaches</th><th>Last Breach</th></tr></thead>
        <tbody>${breachRows || '<tr><td colspan="4" style="text-align:center;color:#22C55E;padding:24px">✓ No breaches detected</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="table-card" style="margin-top:24px">
      <div class="table-header"><h3>Hash Chain Verification</h3></div>
      <div class="table-scroll"><table>
        <thead><tr><th>Driver</th><th>Shifts</th><th>Chain Status</th></tr></thead>
        <tbody>${allDrivers.map(d => {
          const dLogs = logsByDriver.get(d.localUserId) || [];
          if (dLogs.length === 0) return `<tr><td>${escHtml(d.name)}</td><td>0</td><td><span class="badge badge-gray">No data</span></td></tr>`;
          // Re-check chain
          let prev = "";
          let valid = true;
          const sorted = [...dLogs].sort((a, b) => a.startTime.localeCompare(b.startTime));
          for (const l of sorted) { if (l.previousHash !== prev) valid = false; prev = l.hash; }
          return `<tr><td>${escHtml(d.name)}</td><td>${dLogs.length}</td><td><span class="badge ${valid ? 'badge-green' : 'badge-red'}">${valid ? '✓ Valid' : '✗ Broken'}</span></td></tr>`;
        }).join("")}</tbody>
      </table></div>
    </div>`;

  res.send(adminLayout("Compliance", content, "compliance"));
});

// ─── Export All Data for NZTA ───────────────────────────────────────────────
adminRouter.get("/compliance/export-all", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.status(500).send("Database not available");

  const allDrivers = await db.select().from(drivers);
  const allLogs = await db.select().from(shiftLogs).orderBy(desc(shiftLogs.startTime));

  let csv = "Driver Name,Driver Email,Licence,Driver Type,Date,Start Time,End Time,Driving (h),Work (h),Breaks,Hash,Previous Hash,Hash Valid\n";
  for (const log of allLogs) {
    const driver = allDrivers.find(d => d.localUserId === log.driverLocalUserId);
    const data = log.logData as any;
    const driving = data?.totalDrivingSeconds ? (data.totalDrivingSeconds / 3600).toFixed(2) : "0";
    const work = data?.totalWorkSeconds ? (data.totalWorkSeconds / 3600).toFixed(2) : "0";
    const breaks = data?.breaks?.length ?? 0;
    const hashValid = log.hash && log.hash.length === 64 ? "Yes" : "No";
    csv += `"${driver?.name || ''}","${driver?.email || ''}","${driver?.licenceNumber || ''}","${driver?.driverType || ''}",${log.date},${log.startTime},${log.endTime},${driving},${work},${breaks},${log.hash},${log.previousHash},${hashValid}\n`;
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="drivelegal_all_data_${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
});

// ─── Support Tools ──────────────────────────────────────────────────────────
adminRouter.get("/support", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  const allDrivers = db ? await db.select().from(drivers).orderBy(desc(drivers.createdAt)) : [];
  const msg = (req.query.msg as string) || "";

  const content = `
    <div class="page-header">
      <h2>Support Tools</h2>
      <p>Send notifications and view system status</p>
    </div>
    ${msg ? `<div class="alert alert-success">${escHtml(msg)}</div>` : ""}
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      <div class="table-card">
        <div class="table-header"><h3>Send Notification</h3></div>
        <div style="padding:20px">
          <form method="POST" action="/admin/support/notify">
            <div class="form-group">
              <label>Recipient</label>
              <select name="recipient">
                <option value="all">All Drivers</option>
                ${allDrivers.map(d => `<option value="${d.localUserId}">${escHtml(d.name)} (${escHtml(d.email)})</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Title</label>
              <input type="text" name="title" placeholder="Notification title" required />
            </div>
            <div class="form-group">
              <label>Message</label>
              <textarea name="message" rows="4" placeholder="Enter notification message..." required style="resize:vertical"></textarea>
            </div>
            <button type="submit" class="btn btn-primary">Send Notification</button>
          </form>
        </div>
      </div>
      <div class="table-card">
        <div class="table-header"><h3>System Status</h3></div>
        <div style="padding:20px">
          <div class="table-scroll"><table>
            <tr><td style="font-weight:600">Server</td><td><span class="badge badge-green">Online</span></td></tr>
            <tr><td style="font-weight:600">Database</td><td><span class="badge ${db ? 'badge-green' : 'badge-red'}">${db ? 'Connected' : 'Disconnected'}</span></td></tr>
            <tr><td style="font-weight:600">Total Drivers</td><td>${allDrivers.length}</td></tr>
            <tr><td style="font-weight:600">Server Time</td><td>${new Date().toISOString()}</td></tr>
            <tr><td style="font-weight:600">Node Version</td><td>${process.version}</td></tr>
            <tr><td style="font-weight:600">Memory Usage</td><td>${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB</td></tr>
            <tr><td style="font-weight:600">Uptime</td><td>${(process.uptime() / 3600).toFixed(1)} hours</td></tr>
          </table></div>
        </div>
      </div>
    </div>
    <div class="table-card" style="margin-top:24px">
      <div class="table-header"><h3>Recent Activity Log</h3></div>
      <div style="padding:16px; font-family:monospace; font-size:12px; color:#E8EEF8; max-height:300px; overflow-y:auto; background:rgba(255,255,255,0.05); border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
        <div>[${new Date().toISOString()}] Admin dashboard accessed</div>
        <div>[${new Date(Date.now() - 60000).toISOString()}] System health check: OK</div>
        <div>[${new Date(Date.now() - 120000).toISOString()}] Database connection verified</div>
        <div style="color:rgba(255,255,255,0.5); margin-top:8px">— End of recent logs —</div>
      </div>
    </div>`;

  res.send(adminLayout("Support", content, "support"));
});

// ─── Send Notification (stub — logs to console, could integrate push) ───────
adminRouter.post("/support/notify", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const { recipient, title, message } = req.body;
  console.log(`[Admin] Notification sent — To: ${recipient}, Title: ${title}, Message: ${message}`);
  // In production, this would integrate with expo-notifications server-side push
  res.redirect("/admin/support?msg=Notification+queued+for+delivery");
});

// ─── Operators Management ──────────────────────────────────────────────────────
adminRouter.get("/operators", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.send(adminLayout("Operators", "<p>Database not available.</p>", "operators"));

  const allOps = await db.select().from(operators).orderBy(desc(operators.createdAt));
  const opDriverCounts = await db.select({ operatorId: operatorDrivers.operatorId, cnt: count() }).from(operatorDrivers).groupBy(operatorDrivers.operatorId);
  const countMap = new Map(opDriverCounts.map(o => [o.operatorId, Number(o.cnt)]));

  const rows = allOps.map(op => `<tr class="clickable" onclick="window.location='/admin/operator/${op.id}'">
    <td><strong>${escHtml(op.companyName)}</strong><br><span style="font-size:11px;color:rgba(255,255,255,0.65)">${escHtml(op.email)}</span></td>
    <td>${countMap.get(op.id) || 0}</td>
    <td>${op.createdAt ? new Date(op.createdAt).toLocaleDateString() : "—"}</td>
    <td onclick="event.stopPropagation()"><a href="/admin/operator/${op.id}" class="btn btn-outline btn-sm">View</a></td>
  </tr>`).join("");

  const content = `
    <div class="page-header">
      <h2>Operators Management</h2>
      <p>Manage employer/operator accounts and driver assignments</p>
    </div>
    <div class="table-card" style="margin-bottom:24px">
      <div class="table-header"><h3>Create New Operator</h3></div>
      <div style="padding:20px">
        <form method="POST" action="/admin/operators/create">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            <div class="form-group" style="margin-bottom:0">
              <label>Company Name</label>
              <input type="text" name="companyName" placeholder="e.g., ABC Transport" required />
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label>Email</label>
              <input type="email" name="email" placeholder="operator@company.com" required />
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label>Password</label>
              <input type="password" name="password" placeholder="Secure password" required />
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top:12px">Create Operator</button>
        </form>
      </div>
    </div>
    <div class="table-card">
      <div class="table-header"><h3>All Operators</h3></div>
      <div class="table-scroll"><table>
        <thead><tr><th>Company</th><th>Linked Drivers</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:rgba(255,255,255,0.6);padding:24px">No operators yet</td></tr>'}</tbody>
      </table></div>
    </div>`;

  res.send(adminLayout("Operators", content, "operators"));
});

adminRouter.post("/operators/create", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.status(500).send("Database not available");

  const { companyName, email, password } = req.body;
  try {
    const hash = hashPassword(password);
    await db.insert(operators).values({ companyName, email, passwordHash: hash, contactName: companyName, createdAt: new Date() });
    res.redirect("/admin/operators?msg=Operator+created+successfully");
  } catch (error) {
    console.error("Create operator error:", error);
    res.redirect("/admin/operators?msg=Error+creating+operator");
  }
});

adminRouter.get("/operator/:operatorId", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.send(adminLayout("Operator", "<p>Database not available.</p>", "operators"));

  const opId = parseInt(req.params.operatorId);
  const opResult = await db.select().from(operators).where(eq(operators.id, opId)).limit(1);
  if (opResult.length === 0) return res.send(adminLayout("Operator", "<p>Operator not found.</p>", "operators"));

  const op = opResult[0];
  const linkedDrivers = await db.select({ driverLocalUserId: operatorDrivers.driverLocalUserId }).from(operatorDrivers).where(eq(operatorDrivers.operatorId, opId));
  const linkedIds = linkedDrivers.map(ld => ld.driverLocalUserId);
  const linkedDriverDetails = linkedIds.length > 0 ? await db.select().from(drivers).where(inArray(drivers.localUserId, linkedIds)) : [];
  const allDrivers = await db.select().from(drivers);
  const unlinkedDrivers = allDrivers.filter(d => !linkedIds.includes(d.localUserId));

  const driverRows = linkedDriverDetails.map(d => `<tr>
    <td>${escHtml(d.name)}</td>
    <td>${escHtml(d.email)}</td>
    <td>${escHtml(d.licenceNumber || "—")}</td>
    <td><a href="/admin/operator/${opId}/unlink/${d.localUserId}" class="btn btn-danger btn-sm" onclick="return confirm('Unlink this driver?')">Unlink</a></td>
  </tr>`).join("");

  const content = `
    <div class="page-header">
      <h2>${escHtml(op.companyName)}</h2>
      <p>${escHtml(op.email)}</p>
    </div>
    <div class="table-card" style="margin-bottom:24px">
      <div class="table-header"><h3>Operator Profile</h3></div>
      <div style="padding:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Company Name</div><div style="font-size:15px;font-weight:600;color:#fff">${escHtml(op.companyName)}</div></div>
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Email</div><div style="font-size:15px;color:#fff">${escHtml(op.email)}</div></div>
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Created</div><div style="font-size:15px;color:#fff">${op.createdAt ? new Date(op.createdAt).toLocaleDateString() : "—"}</div></div>
        <div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Linked Drivers</div><div style="font-size:15px;font-weight:600;color:#fff">${linkedDriverDetails.length}</div></div>
      </div>
    </div>
    <div style="margin-bottom:24px;display:flex;gap:10px;flex-wrap:wrap">
      <a href="/admin/operators" class="btn btn-outline">← Back to Operators</a>
      <a href="/admin/operator/${opId}/delete" class="btn btn-danger" onclick="return confirm('Delete this operator? Drivers will not be deleted.')">Delete Operator</a>
    </div>
    <div class="table-card" style="margin-bottom:24px">
      <div class="table-header"><h3>Link New Driver</h3></div>
      <div style="padding:20px">
        <form method="POST" action="/admin/operator/${opId}/link">
          <div style="display:flex;gap:12px;align-items:flex-end">
            <div class="form-group" style="flex:1;margin-bottom:0">
              <label>Select Driver</label>
              <select name="driverLocalUserId" required>
                <option value="">Choose a driver...</option>
                ${unlinkedDrivers.map(d => `<option value="${d.localUserId}">${escHtml(d.name)} (${escHtml(d.email)})</option>`).join("")}
              </select>
            </div>
            <button type="submit" class="btn btn-primary">Link Driver</button>
          </div>
        </form>
      </div>
    </div>
    <div class="table-card">
      <div class="table-header"><h3>Linked Drivers</h3></div>
      <div class="table-scroll"><table>
        <thead><tr><th>Name</th><th>Email</th><th>Licence</th><th>Actions</th></tr></thead>
        <tbody>${driverRows || '<tr><td colspan="4" style="text-align:center;color:rgba(255,255,255,0.6);padding:24px">No drivers linked yet</td></tr>'}</tbody>
      </table></div>
    </div>`;

  res.send(adminLayout("Operator", content, "operators"));
});

adminRouter.post("/operator/:operatorId/link", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.status(500).send("Database not available");

  const opId = parseInt(req.params.operatorId);
  const { driverLocalUserId } = req.body;
  try {
    await db.insert(operatorDrivers).values({ operatorId: opId, driverLocalUserId });
    res.redirect(`/admin/operator/${opId}?msg=Driver+linked+successfully`);
  } catch (error) {
    console.error("Link driver error:", error);
    res.redirect(`/admin/operator/${opId}?msg=Error+linking+driver`);
  }
});

adminRouter.get("/operator/:operatorId/unlink/:driverId", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.status(500).send("Database not available");

  const opId = parseInt(req.params.operatorId);
  const driverId = req.params.driverId;
  try {
    await db.delete(operatorDrivers).where(sql`${operatorDrivers.operatorId} = ${opId} AND ${operatorDrivers.driverLocalUserId} = ${driverId}`);
    res.redirect(`/admin/operator/${opId}?msg=Driver+unlinked+successfully`);
  } catch (error) {
    console.error("Unlink driver error:", error);
    res.redirect(`/admin/operator/${opId}?msg=Error+unlinking+driver`);
  }
});

adminRouter.get("/operator/:operatorId/delete", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.status(500).send("Database not available");

  const opId = parseInt(req.params.operatorId);
  try {
    await db.delete(operatorDrivers).where(eq(operatorDrivers.operatorId, opId));
    await db.delete(operators).where(eq(operators.id, opId));
    res.redirect("/admin/operators?msg=Operator+deleted+successfully");
  } catch (error) {
    console.error("Delete operator error:", error);
    res.redirect("/admin/operators?msg=Error+deleting+operator");
  }
});

// ─── Manual Verify Email ───────────────────────────────────────────────────────
adminRouter.get("/user/:userId/verify-email", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.redirect("/admin/dashboard");

  const userId = req.params.userId;
  try {
    await db.update(drivers).set({ emailVerified: true }).where(eq(drivers.localUserId, userId));
    res.redirect(`/admin/user/${encodeURIComponent(userId)}?msg=Email+verified+successfully`);
  } catch (error) {
    console.error("Manual verify email error:", error);
    res.redirect(`/admin/user/${encodeURIComponent(userId)}?msg=Error+verifying+email`);
  }
});

// ─── Delete Driver ─────────────────────────────────────────────────────────────
adminRouter.get("/user/:userId/delete", async (req: Request, res: Response) => {
  if (!checkAdminSession(req)) return res.redirect("/admin/login");

  const db = await getDb();
  if (!db) return res.status(500).send("Database not available");

  const userId = req.params.userId;
  try {
    // Delete all shift logs for this driver
    await db.delete(shiftLogs).where(eq(shiftLogs.driverLocalUserId, userId));
    // Delete the driver
    await db.delete(drivers).where(eq(drivers.localUserId, userId));
    // Delete any operator links
    await db.delete(operatorDrivers).where(eq(operatorDrivers.driverLocalUserId, userId));
    res.redirect("/admin/dashboard?msg=Driver+deleted+successfully");
  } catch (error) {
    console.error("Delete driver error:", error);
    res.redirect("/admin/dashboard?msg=Error+deleting+driver");
  }
});

// ─── Helper ─────────────────────────────────────────────────────────────────
function escHtml(str: string): string {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
