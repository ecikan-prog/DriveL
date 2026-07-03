# DriveLegal — Source Code Handover

React Native / Expo app for NZ commercial driver logbook compliance.
NZTA Work Time and Logbooks Rule 2007.

**Bundle ID:** `app.drivelegal.mobile`  
**App Store ID:** `6782220073`  
**Apple Developer:** `e.cikan@icloud.com` / Team `K74FJVM4T6`  
**EAS Project:** `1cb6117e-85be-497d-9fc8-7c0a54e9b072`  
**Backend:** Express + tRPC + Drizzle ORM + MySQL  

---

## Project Structure

```
DriveLegal/
├── app/              # Expo Router screens
│   ├── _layout.tsx       # Root layout / navigation
│   ├── index.tsx         # Dashboard (active shift)
│   ├── history.tsx       # Shift history / logbook
│   ├── shift-detail.tsx  # Individual shift record
│   ├── log-detail.tsx    # Log entry detail
│   ├── new-entry.tsx     # Manual log entry
│   ├── reports.tsx       # PDF/Excel export
│   ├── profile.tsx       # Driver profile
│   ├── more.tsx          # Settings / more menu
│   ├── paywall.tsx       # Subscription screen
│   ├── login.tsx         # Auth screens
│   ├── register.tsx
│   ├── forgot-password.tsx
│   ├── reset-password.tsx
│   ├── verify-email.tsx
│   ├── enforcement-view.tsx  # NZTA enforcement officer view
│   ├── activity-grid.tsx     # Visual activity timeline
│   ├── privacy-policy.tsx
│   └── terms-of-service.tsx
│
├── hooks/
│   └── use-nzta-compliance.ts  # ⭐ NZTA rule evaluation (FIXED v2)
│
├── lib/
│   ├── logbook-storage.ts   # ⭐ Core shift/event storage (FIXED v2)
│   ├── shift-context.tsx    # ⭐ React context / live timers (FIXED v2)
│   ├── auth-context.tsx     # Auth state
│   ├── local-auth.ts        # Local authentication
│   ├── cloud-sync.ts        # Server sync
│   ├── integrity.ts         # Tamper-evident hash chain
│   ├── location.ts          # GPS capture
│   ├── rest-validation.ts   # 10-hour rest enforcement
│   ├── subscription.ts      # Trial / subscription logic
│   ├── amendments.ts        # Locked record amendments
│   ├── theme-provider.tsx   # Theme context
│   └── icon-symbol.tsx      # Icon component
│
├── server/
│   ├── index.ts         # Express entry point
│   ├── routers.ts       # tRPC routers
│   ├── schema.ts        # Drizzle DB schema
│   ├── db.ts            # DB connection
│   ├── auth.ts          # Auth endpoints
│   ├── email.ts         # Brevo SMTP email
│   ├── excel-export.ts  # Excel report generation
│   ├── pdf-export.ts    # PDF report generation
│   ├── export-routes.ts # Export API routes
│   ├── portal.ts        # Operator portal
│   ├── admin.ts         # Admin endpoints
│   ├── oauth.ts         # OAuth flow
│   └── trpc.ts          # tRPC setup
│
├── migrations/          # Drizzle SQL migrations
├── tests/               # Vitest test files
├── docs/                # NZTA compliance docs
└── config/              # Expo / build config files
```

---

## Bug Fixes in This Version (v2)

### 1. Driving time not accumulating across breaks — `lib/logbook-storage.ts`
**Root cause:** `computeCurrentDrivingSeconds` was resetting the entire
driving accumulator after a 30-min break. NZTA only requires the
*consecutive* segment to reset, not the total daily driving.

**Fix:** Pre-break driving stored in `committedDrivingMs`. New function
`computeConsecutiveDrivingSeconds` handles the dashboard countdown only.

### 2. Break End event not saving — `lib/logbook-storage.ts`
**Root cause:** `endBreak` had no guard to verify an unclosed break existed.

**Fix:** Guard added — only writes `break_end` if a matching unclosed
`break_start` exists. `buildDailyLog` also auto-closes unclosed breaks
at shift end so data is never lost.

### 3. Odometer distance calculating as 0 or negative — `lib/logbook-storage.ts`
**Root cause:** No validation before `endOdometer - startOdometer`.

**Fix:** Validates `endOdometer >= startOdometer`. If inverted, sets
`distanceKm = 0` and `odometerInverted = true` flag for amendment prompt.

### 4. Fortnightly hours inconsistent across screens — `lib/shift-context.tsx`
**Root cause:** Dashboard used consecutive driving for fortnightly total.

**Fix:** `tick()` now passes total `drivingSeconds` (not consecutive) to
the fortnightly calculation. Both values available in context.

---

## Development Setup

```bash
# Install dependencies
pnpm install

# Start dev server + Metro
pnpm dev

# iOS
pnpm ios

# Android
pnpm android

# Run tests
pnpm test

# Build for App Store (EAS)
eas build --platform ios --profile production
```

---

## Platform Notes

The core compliance logic (`logbook-storage.ts`, `use-nzta-compliance.ts`)
has no React dependencies and can be ported to:
- **Web** — swap AsyncStorage for localStorage/IndexedDB
- **Node.js** — direct import, no changes needed
- **Other mobile frameworks** — only storage layer needs adapting

---

## Key Credentials (keep secure)

- Apple Developer: `e.cikan@icloud.com`
- App Store Connect App ID: `6782220073`
- EAS Project ID: `1cb6117e-85be-497d-9fc8-7c0a54e9b072`
- Bundle ID: `app.drivelegal.mobile`
- Backend: `guidedlogbook-6i7vyx5h.manus.space` (to be migrated)
