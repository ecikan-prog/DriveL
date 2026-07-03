# Guided NZ Logbook — TODO

## Phase 1: Foundation
- [x] Project scaffold initialized
- [x] Design document created
- [x] Brand colors configured (Navy #003366, Action Blue #5980E9)
- [x] App name/branding updated in app.config.ts

## Phase 2: Authentication
- [x] Local auth storage layer (AsyncStorage)
- [x] Register screen (name, email, password, licence, vehicle)
- [x] Login screen (email + password)
- [x] Auth context/provider
- [x] Route protection (redirect to login if not authenticated)

## Phase 3: Dashboard
- [x] Shift state management (start/stop/break)
- [x] Real-time driving timer (HH:MM:SS)
- [x] Real-time work timer
- [x] Break timer
- [x] Start Shift / End Shift button
- [x] Start Break / End Break button
- [x] Today's summary display
- [x] Keep screen awake during active shift

## Phase 4: NZTA Compliance
- [x] 7-hour driving warning: "Take a 30-minute break now!"
- [x] 13-hour work warning: "10-hour break required!"
- [x] 70-hour fortnightly limit tracking and warning
- [x] In-app alert banners for warnings
- [x] Push notification support for warnings

## Phase 5: History & Export
- [x] Log storage (save completed shifts to AsyncStorage)
- [x] History screen with date-grouped log cards
- [x] Log detail screen (full event timeline)
- [x] CSV export functionality
- [x] Fortnightly hours summary

## Phase 6: Profile & Polish
- [x] Profile screen (driver info, vehicle, trial status)
- [x] Edit profile
- [x] 14-day trial countdown display
- [x] Logout
- [x] App icon/logo generated and applied
- [x] Navigation finalized (tabs + auth stack)

## Phase 7: Testing & Delivery
- [x] Unit tests for NZTA compliance logic (42 tests passing)
- [x] Unit tests for timer/shift logic
- [x] Checkpoint saved
- [x] App delivered to user

## Phase 8: UI Polish & Refinement
- [x] History screen redesign (polished cards, icons, colour coding, filter tabs)
- [x] Profile screen redesign (stats cards, icons, NZTA rules numbered list)
- [x] Vehicle type picker (Rideshare/Taxi, Van, Truck, Bus, Heavy Vehicle, Other)
- [x] Updated registration screen with vehicle type picker
- [x] Checkpoint saved with UI improvements

## Phase 9: Rebranding to RoadLog
- [x] App renamed from "Guided NZ Logbook" to "RoadLog"
- [x] Tagline changed to "DRIVE LEGAL"
- [x] ROADLOG branding (ROAD white, LOG green) across all screens
- [x] Road icon logo used in all screen headers (Dashboard, History, Profile)
- [x] Login screen updated with logo image and ROADLOG branding
- [x] Register screen updated with logo image and ROADLOG branding
- [x] app.config.ts updated with appName: "RoadLog"
- [x] All icon assets updated with road icon
- [x] Checkpoint saved and deployed to production

## Phase 10: Stripe Subscription Paywall
- [x] Subscription storage layer (trial status, subscription state)
- [x] Paywall screen with subscription options (Monthly NZD $9.99 / Annual NZD $79.99)
- [x] Block shift logging when trial expired and no active subscription
- [x] Stripe checkout integration (simulated for MVP, ready for real Stripe)
- [x] Subscription status check on app load
- [x] "Subscribe" button on profile page wired to paywall

## Phase 11: PDF Export
- [x] PDF generation with RoadLog branding (logo, colours)
- [x] Driver details section (name, licence, vehicle rego, vehicle type)
- [x] Full shift table (dates, start/end times, driving hours, breaks, work time)
- [x] Share/download PDF functionality (native share sheet + web print)
- [x] PDF and CSV export buttons in history screen
- [x] NZTA compliance rules reference in PDF footer

## Phase 12: Pricing Update & NZTA Compliance Document
- [x] Update monthly price from NZD $9.99 to NZD $4.99
- [x] Update annual price from NZD $79.99 to NZD $39.99
- [x] Update savings percentage (33% for annual)
- [x] Research NZTA Work Time & Logbooks 2007 requirements
- [x] Research electronic logbook approval criteria
- [x] Write comprehensive NZTA compliance specification document
- [x] Include gap analysis with recommended fixes
- [x] Include roadmap to NZTA approval
- [x] Checkpoint saved and deployed to production

## Phase 13: NZTA Approval Readiness
- [x] Privacy Policy screen accessible from Profile
- [x] Terms of Service screen accessible from Profile
- [x] Tamper-proofing: SHA-256 hash chain on shift logs
- [x] "Verified" indicator on exported records
- [x] Enforcement View / "Show to Officer" button in History
- [x] Clean read-only enforcement display for roadside inspections
- [x] NZTA Compliance Specification document (formal PDF-ready)
- [x] Driver's Guide document (2-page how-to)
- [x] Confirm pricing: NZD $4.99/month, NZD $39.99/year
- [x] Checkpoint saved and deployed to production

## Phase 14: Critical NZTA Compliance Features
- [x] GPS location capture at shift events (start, break, end)
- [x] Reverse geocoding to display suburb/city name
- [x] Odometer input at start and end of shift
- [x] Distance calculation (end - start odometer)
- [x] Driver-type selection in Profile (Goods Service / Passenger Service)
- [x] Dynamic compliance limits (5.5h driving for Goods, 7h for Passenger)
- [x] Update NZTA Compliance Specification to reflect new features
- [x] Checkpoint saved and deployed to production

## Phase 15: Registration Screen & PDF Export Enhancements
- [x] Add driver-type selection to Registration screen (Goods Service / Passenger Service)
- [x] Add GPS location columns to PDF export shift table
- [x] Add odometer/distance columns to PDF export shift table
- [x] Pass driverType to PDF export for dynamic compliance label
- [x] Regenerate NZTA Compliance Specification PDF with all gaps resolved
- [x] Regenerate Driver's Guide PDF
- [x] TypeScript verification clean
- [x] All 43 tests passing
- [x] Save checkpoint and deploy to production

## Phase 16: NZTA Demo Account & Sample Data
- [x] Build /demo-seed screen to create NZTA demo account in AsyncStorage
- [x] Pre-populate 10 sample shifts (13 days) with GPS locations, odometer readings, breaks
- [x] Demo credentials: nzta.demo@roadlog.nz / NZTAReview2026!
- [x] TypeScript verification clean
- [x] All tests passing
- [x] Checkpoint saved and deployed to production

## Phase 17: Major UI Overhaul - Drive Legal Rebrand
- [x] Rebrand app from "RoadLog" to "Drive Legal" in app.config.ts
- [x] Redesign dashboard with circular countdown timer, status card, stats row
- [x] New header with DRIVE LEGAL logo (D icon in blue) and notification bell
- [x] Navy dark background for driving status area, white for stats section
- [x] Green countdown ring showing hours remaining until rest break
- [x] Stats row: TODAY / THIS WEEK / FORTNIGHTLY with progress bars
- [x] Red END SHIFT button matching mockup
- [x] Restructure to 5-tab navigation: Dashboard, Logbook, New Entry (+), Reports, More
- [x] Create New Entry tab screen with shift action buttons
- [x] Create Reports tab with PDF export, enforcement view, compliance status
- [x] Create More tab with profile, subscription, support, legal links
- [x] Generate new Drive Legal app icon (blue D with road motif)
- [x] All existing functionality preserved (GPS, odometer, driver-type, compliance, PDF, history, enforcement)
- [x] TypeScript clean, 43 tests passing
- [x] Checkpoint saved and deployed to production

## Phase 18: Cloud Synchronization
- [x] Database schema: drivers and shift_logs tables created
- [x] Server-side tRPC routes: driverAuth.login, driverAuth.register, sync.pushLogs, sync.pullLogs
- [x] Client-side cloud-sync.ts: push/pull service with hash chain integrity
- [x] Auth context integration: cloud register on signup, cloud login on cross-device, auto-push on shift end
- [x] NZTA demo account seeded in cloud DB (nzta.demo@roadlog.nz / NZTAReview2026!)
- [x] 10 sample shifts with hash chain seeded in cloud DB
- [x] TypeScript clean, 43 tests passing
- [x] Checkpoint saved and deployed to production

## Phase 19: Activity Grid (NZTA Specs 3.2.10 & 5.1.2)
- [x] ActivityGrid component with colored timeline blocks (driving/rest/off-duty)
- [x] Day rows showing 24-hour timeline per CWD
- [x] Legend with color-coded activity types
- [x] Time axis header (00:00 to 24:00)
- [x] Scrollable for entire CWP duration
- [x] Integrated into Logbook tab (full-size)
- [x] Integrated into Enforcement View (compact mode)
- [x] TypeScript clean, 43 tests passing
- [x] Checkpoint saved and deployed to production

## Phase 20: Remaining NZTA Compliance Features
- [x] Other Work activity type (loading, paperwork, inspections)
- [x] Other Work renders as light blue in Activity Grid
- [x] Excel (.xlsx) export with password protection
- [x] Audit trail with asterisk (*) for amended entries
- [x] Shift detail screen with amendment history view
- [x] Tap-to-inspect tooltip on Activity Grid blocks
- [x] 70-hour CWP warning at 15 min and 5 min prior (NZTA spec 3.4.3)
- [x] Updated NZTA test account (Username: NZTA, Licence: ZY987654)
- [x] Two full CWPs of demo data (25 shifts, ~120h total driving)
- [x] Cloud database seeded with updated demo data
- [x] TypeScript clean, 43 tests passing
- [x] Checkpoint saved and deployed to production

## Phase 21: Must-Have NZTA Compliance Features
- [x] Expand TSL type selection from 2 to 4 types (Goods, Large Passenger, Small Passenger, Vehicle Recovery)
- [x] Add "Sole use" notice to logbook screen
- [x] Hard lock on completed shifts (read-only after end, amendment-only editing)
- [x] Vehicle change mid-shift (Change Vehicle button with rego, odometer, timestamp)
- [x] Rest period validation (10h daily, 24h CWP reset) before allowing new shift
- [x] Activity Grid rendering in PDF export
- [x] Operator/Employer Portal with test account
- [x] Verify TypeScript, run tests
- [x] Save checkpoint and deploy to production
- [x] Update Dashboard break timer: 30-min countdown (orange ring) when ON BREAK, green "Ready to Resume" when break completes

## Phase 22: Bug Fixes
- [x] Fix Sign Out button on More tab (and Profile tab) — explicitly await logout() then router.replace("/login")
- [x] Fix Sign Out button on web: Alert.alert is no-op on Expo web, replaced with window.confirm() + window.location.href hard redirect
- [x] Fix login to try cloud DB first (so clearing browser data doesn't force re-registration), fall back to local only if cloud unavailable/offline
- [x] Fix PDF export on web: replaced popup window (blocked by Safari) with Blob + <a download> trigger
- [x] Fix Excel export on web: added Platform.OS === "web" path using XLSX binary array + Blob download; bypasses expo-file-system/expo-sharing which are no-ops on web
- [x] Fix Bulk Export (Protected) on web: server-side xlsx-populate encryption + download stream
- [x] Fix Start Shift button on web/Safari (Alert.alert is no-op on web)

## Phase 23: Admin Dashboard & Operators Management
- [x] Admin dashboard at /admin with login (admin@drivelegal.app)
- [x] Admin: User management (view all, activate/deactivate, reset password, view history)
- [x] Admin: Subscription management (trial vs paid, extend trials, revenue overview)
- [x] Admin: Compliance overview (breaches, hash chain verification, NZTA export)
- [x] Admin: Support tools (notifications, error logs)
- [x] Admin: Operators management (list, create, detail, link/unlink drivers)

## Phase 24: Bug Fixes — Operator Portal & Linked Drivers
- [x] Fix linked drivers showing 0 on operator detail page (broken inArray query, now uses Drizzle inArray())
- [x] Fix portal login for admin-created operators (SHA-256 vs simpleHash mismatch — unified to SHA-256)
- [x] Update old seed operator account (operator@drivelegal.app) to SHA-256 hash in DB

## Phase 25: TSL Number & Portal Login Fix
- [x] Add tslNumber column to drivers table in schema.ts
- [x] Run DB migration to add tslNumber column
- [x] Add TSL Number field to registration screen (between NZTA Classification and Driver Details)
- [x] Store tslNumber in cloud sync (upsertDriver)
- [x] Fix portal login: ensure SHA-256 is used end-to-end (admin create + portal login)
- [x] End-to-end test: create operator via admin, login via portal
- [x] Deploy with public visibility (Phase 25)

## Phase 26: Mobile Responsive Admin & Portal
- [x] Admin dashboard: hamburger menu button on mobile, overlay sidebar
- [x] Admin dashboard: horizontal table scroll on small screens
- [x] Admin dashboard: stats cards stack in 2 columns on mobile
- [x] Operator portal: hamburger menu button on mobile, overlay sidebar
- [x] Operator portal: horizontal table scroll on small screens
- [x] Operator portal: stats cards stack in 2 columns on mobile
- [x] Deploy with public visibility

## Phase 27: Forgot Password Feature
- [x] Add password_reset_tokens table to schema and run migration
- [x] Add DB functions: createResetToken, getResetToken, deleteResetToken, updateDriverPassword, updateOperatorPassword
- [x] Build Brevo SMTP email sending utility with branded HTML template
- [x] Add BREVO_SMTP_KEY and BREVO_SMTP_LOGIN environment variables/secrets
- [x] Add forgot password routes for operator portal (/portal/forgot-password, /portal/reset-password)
- [x] Add forgot password tRPC endpoints for drivers (driverAuth.forgotPassword, driverAuth.resetPassword)
- [x] Add "Forgot Password?" link to operator portal login page
- [x] Add "Forgot Password?" link to driver app login screen
- [x] Create driver app forgot-password screen (/forgot-password)
- [x] Create driver app reset-password screen (/reset-password)
- [x] Test end-to-end flow locally (operator portal forgot password works)
- [x] Deploy with public visibility

## Phase 28: Terms & Conditions Checkbox
- [x] Copy DriveLegalTC.pdf and DriveLegalPrivacy.pdf to server/public/
- [x] Add /terms and /privacy routes to serve PDFs inline
- [x] Add termsAccepted state to registration form
- [x] Add T&C checkbox with clickable Terms & Conditions and Privacy Policy links
- [x] Disable Create Account button until checkbox is ticked (greyed out when unticked)
- [x] Deploy with public visibility

## Phase 29: Registration Form Updates
- [x] Remove default "Van" from vehicle type — start blank with placeholder
- [x] Filter vehicle type options based on NZTA driver classification selected
- [x] Fix TSL number placeholder to "e.g. 0342026" (no TSL- prefix)
- [x] Remove any TSL- prefix validation regex
- [x] Add helper text under TSL field: "This is your operator's TSL number..."
- [x] Add Driver Licence Class field (1, 2, 4, P, etc.)
- [x] Add Licence Expiry Date field
- [x] Add Operator/Company Name field
- [x] Add new columns to DB schema (licenceClass, licenceExpiry, operatorName)
- [x] Propagate new fields through local-auth, cloud-sync, auth-context, routers, db
- [x] Deploy with public visibility

## Phase 30a: NativeWind + expo-location iOS Fix
- [x] Add `import "../global.css"` to app/_layout.tsx (NativeWind white screen fix)
- [x] Downgrade expo-location from ^19.0.8 to ~18.0.10 (SDK 54 compatibility)
- [x] Remove stray console.log from theme-provider.tsx
- [x] Verify TypeScript 0 errors
- [x] Save checkpoint for rebuild

## Phase 31: Password Minimum + Email Verification
- [x] Update password minimum from 6 to 10 characters (register.tsx, reset-password.tsx, local-auth.ts, server/portal.ts)
- [x] Add emailVerified column to drivers table
- [x] Create email_verification_tokens table
- [x] Send verification email on registration via Brevo API
- [x] Block login for unverified users (redirect to verify-email screen)
- [x] Create verify-email.tsx screen (pending/verifying/success/error states)
- [x] Add resend verification email functionality
- [x] Add server-side GET /verify-email endpoint for email link handling
- [x] Mark all existing drivers as verified (migration backfill)
- [x] TypeScript: 0 errors
- [x] Save checkpoint

## Phase 32: SMTP Email Fix + Build Fix
- [x] Switch email.ts from Brevo HTTP API to nodemailer SMTP (smtp-relay.brevo.com:587)
- [x] Install nodemailer ^9.0.1 and @types/nodemailer
- [x] Verified SMTP connection OK and test email delivered successfully
- [x] Confirmed Metro build succeeds locally (expo export --platform web --clear)
- [x] TypeScript: 0 errors

## Phase 34: iOS Tab Crash Fix + Build Restructure
- [x] Lazy-import expo-file-system/next, expo-sharing, pdf-export in history.tsx (Logbook tab)
- [x] Lazy-import pdf-export, excel-export in reports.tsx (Reports tab)
- [x] Lazy-import expo-mail-composer in more.tsx (More tab)
- [x] Lazy-import expo-mail-composer in profile.tsx (Profile tab)
- [x] Defensive require() for expo-notifications in shift-context.tsx
- [x] Defensive require() for expo-location in lib/location.ts with null checks
- [x] Restructure build: new build-all.mjs script (server always builds, Metro optional)
- [x] Fallback HTML page if Metro fails in Docker
- [x] TypeScript: 0 errors
- [x] Build tested locally: both server and web export succeed

## Phase 35: Admin/Portal Dark Theme + Email DNS Diagnosis
- [x] Update admin.ts body background to #001a33 (dark navy) with white text throughout
- [x] Update admin.ts stat cards, table cards, forms to dark glass-morphism style
- [x] Update portal.ts dashboard and driver detail pages to dark navy theme with white text
- [x] Diagnose Gmail delivery issue: SPF record exists (secureserver.net) but missing Brevo SPF include and DKIM record
- [x] Verify TypeScript 0 errors

## Phase 36: Fix Native API URL + Admin Verify Email
- [x] Set EXPO_PUBLIC_API_URL=https://guidedlogbook-6i7vyx5h.manus.space
- [x] Add LIVE_BACKEND fallback chain in cloud-sync.ts (env var → expo-constants → hardcoded URL)
- [x] Bake apiUrl into app.config.ts extra section for native builds
- [x] Add emailVerified badge to admin driver detail page
- [x] Add "✓ Verify Email" button on admin driver detail page (manual override)
- [x] Add /admin/user/:userId/verify-email route
- [x] Build: 159.5KB, 20ms, TypeScript 0 errors

## Phase 37: Hardcode Production API URL (Critical Fix)
- [x] Remove expo-constants import from cloud-sync.ts
- [x] Remove EXPO_PUBLIC_API_URL env var lookup from cloud-sync.ts
- [x] Replace resolveApiBase() function with simple inline ternary constant
- [x] Native iOS/Android: always uses hardcoded https://guidedlogbook-6i7vyx5h.manus.space/api/trpc
- [x] Web: derives from window.location.origin (works in web preview)
- [x] TypeScript: 0 errors
- [x] DB check: erman_elif@yahoo.co.nz NOT in drivers table (confirms v1.0.9 still used old code)

## Phase 38: Full API URL Audit & Fix
- [x] Traced full registration code path: register.tsx → auth-context.tsx → cloud-sync.ts → trpcCall → fetch
- [x] Identified root cause: trpcCall uses API_BASE (now fixed), but auth-context baseUrl and cloud-sync forgotPassword/resendVerification still used process.env.EXPO_PUBLIC_API_URL
- [x] Fixed auth-context.tsx line 151: baseUrl now uses window.location.origin on web, hardcoded live URL on native
- [x] Fixed cloud-sync.ts forgotPasswordRequest: baseUrl uses LIVE_BACKEND constant on native
- [x] Fixed cloud-sync.ts resendVerificationEmail: baseUrl uses LIVE_BACKEND constant on native
- [x] Fixed register.tsx BASE_URL: removed env var, now plain string literal
- [x] Fixed constants/oauth.ts getApiBaseUrl(): hardcoded live backend as final fallback (was returning empty string)
- [x] Added guard for "undefined" string in API_BASE_URL check
- [x] TypeScript: 0 errors

## Phase 39: Verification Success Page Deep Link Fix
- [x] Replaced /login href on "Open Drive Legal" button with manusguidednzlogbook://login deep link
- [x] Added JS fallback: if app not installed after 2.5s, redirect to App Store
- [x] Added "download from App Store" fallback link below button
- [x] APP_SCHEME derived from bundle ID com.app.guidednzlogbook → manusguidednzlogbook
- [x] TypeScript: 0 errors

## Phase 40: Bundle ID Update + Branded Deep Link Scheme
- [x] Updated bundle ID in app.config.ts from com.app.guidednzlogbook to app.drivelegal.mobile
- [x] Added "drivelegal" as primary URL scheme (alongside auto-generated manusmobile as secondary)
- [x] scheme in ExpoConfig set to ["drivelegal", "manusmobile"] array
- [x] Android intentFilter uses primary "drivelegal" scheme
- [x] Updated server/_core/index.ts verification success page: APP_SCHEME = "drivelegal"
- [x] Deep link button now uses drivelegal://login
- [x] TypeScript: 0 errors

## Phase 41: Revert Bundle ID, Keep drivelegal Scheme
- [x] Reverted bundle ID back to com.app.guidednzlogbook (EAS credentials registered under this ID)
- [x] Kept drivelegal as secondary URL scheme alongside manusguidednzlogbook
- [x] Updated verification page APP_SCHEME back to manusguidednzlogbook (matches current EAS builds)
- [x] TypeScript: 0 errors

## Phase 42: Remove premature NZTA Compliant certification claims
- [x] reports.tsx — PDF subtitle and Compliant stat label
- [x] more.tsx — version footer
- [x] log-detail.tsx — compliance badge
- [x] paywall.tsx — trial expired message and features list
- [x] privacy-policy.tsx — purpose of collection section
- [x] lib/excel-export.ts — summary sheet footer
- [x] lib/pdf-export.ts — PDF report footer
- [x] server/_core/index.ts — email footer and server root page
- [x] server/email.ts — both email footers and header taglines
- [x] server/excel-protected.ts — summary sheet footer

## Phase 43: 10-hour rest override — unavoidable delay or emergency
- [ ] Extend DailyLog type with restOverrideNote and restOverrideFlagged fields
- [ ] Extend ActiveShift type with restOverrideNote field
- [ ] Update startShift in logbook-storage.ts to accept and store restOverrideNote
- [ ] Update startShift in shift-context.tsx to accept and pass restOverrideNote
- [ ] Update buildDailyLog to carry restOverrideNote and set restOverrideFlagged
- [ ] Update new-entry.tsx: add override modal with mandatory text input (min 10 chars)
- [ ] Update new-entry.tsx: on native, replace Alert.alert rest block with modal
- [ ] Update log-detail.tsx: show red/amber override badge and note
- [ ] Update enforcement-view.tsx: show override flag and note per shift card
- [ ] Update pdf-export.ts: include override note in PDF report
- [ ] Update excel-export.ts: include override note in Excel export
- [ ] Update excel-protected.ts (server): include override note in protected Excel

## Phase 43: 10-hour rest override (unavoidable delay/emergency)
- [x] Extend DailyLog type with restOverrideFlagged and restOverrideNote fields
- [x] Update startShift in shift-context.tsx to accept and pass restOverrideNote
- [x] Add override modal in new-entry.tsx with mandatory text field (min 10 chars)
- [x] Hard-block 24-hour CWP reset (no override permitted)
- [x] Show amber override badge on active shift card in new-entry.tsx
- [x] Show amber override card in log-detail.tsx
- [x] Show override flag and note in enforcement-view.tsx shift cards
- [x] Add override row (amber) in PDF export (pdf-export.ts)
- [x] Add Rest Override Note column in Excel export (excel-export.ts, excel-protected.ts)

## Phase 44: Off-duty rest break screen
- [x] Add rest break countdown state to dashboard (ON REST BREAK, Rest Complete, Ready to Drive)
- [x] Brand new account shows "READY TO DRIVE" (no rest break shown)
- [x] OFF DUTY after shift shows "ON REST BREAK" with amber ring counting down from 10 hrs (or 24 hrs for CWP reset)
- [x] Ring hits zero → "REST COMPLETE" green state with "Ready to start your next shift" message
- [x] CountdownRing updated with context="rest" for correct labels (TIME REMAINING / ON REST BREAK)
- [x] Live refresh: restValidation polled every 60s while off-duty so countdown ticks
- [x] Rest break start time shown below ring (hotel icon, amber)
- [x] Rest complete info shown below ring (check-circle, green)
- [x] 24-hr CWP rest correctly detected and labeled separately

## Phase 45: Lazy native module imports — prevent iOS crash on tab load
- [x] lib/excel-export.ts: remove top-level FileSystem/Sharing imports, lazy require() inside native branch
- [x] lib/pdf-export.ts: remove top-level Print/Sharing imports, lazy require() inside native branch
- [x] app/(tabs)/history.tsx: wrap expo-file-system/next and expo-sharing dynamic imports in try/catch
- [x] app/(tabs)/more.tsx: add Linking import, MailComposer lazy require() with mailto fallback
- [x] app/(tabs)/profile.tsx: add Linking import, MailComposer lazy require() with mailto fallback

## Phase 46: Fix iOS crashes — async dynamic import() + override modal keyboard fix
- [x] lib/excel-export.ts: replace lazy require() with await import() for FileSystem/Sharing
- [x] lib/pdf-export.ts: replace lazy require() with await import() for Print/Sharing
- [x] app/(tabs)/history.tsx: simplify to clean await import() pattern
- [x] app/(tabs)/more.tsx: replace require() with await import() for MailComposer
- [x] app/(tabs)/profile.tsx: replace require() with await import() for MailComposer
- [x] app/(tabs)/new-entry.tsx: wrap override modal in KeyboardAvoidingView + ScrollView

## Phase 47: Remove banned native modules — server-side exports
- [x] metro.config.js: blockList for expo-print, expo-sharing, expo-file-system, expo-mail-composer
- [x] server/export-routes.ts: POST /api/export/pdf endpoint (HTML upload to S3)
- [x] server/export-routes.ts: POST /api/export/excel endpoint (xlsx-populate, upload to S3)
- [x] server/export-routes.ts: POST /api/export/csv endpoint (CSV string, upload to S3)
- [x] Register export routes in server/_core/index.ts
- [x] lib/pdf-export.ts: rewrite — remove expo-print/expo-sharing, native uses server endpoint + Linking.openURL
- [x] lib/excel-export.ts: rewrite — remove expo-file-system/expo-sharing, native uses server endpoint + Linking.openURL
- [x] app/(tabs)/history.tsx: CSV export native path uses server endpoint + Linking.openURL
- [x] app/(tabs)/more.tsx: Contact Support uses Linking.openURL('mailto:...')
- [x] app/(tabs)/profile.tsx: Contact Support uses Linking.openURL('mailto:...')
- [x] Verified zero imports of banned modules in app/ and lib/ directories
- [x] TypeScript: 0 errors

## Phase 47b: Fix /api/export/pdf crash — 'Cannot read properties of undefined (reading length)'
- [x] Root cause: incoming log objects may have undefined breaks/events arrays (serialized from AsyncStorage without defaults)
- [x] Added normalizeLogs() function to ensure breaks, events, amendments, vehicleChanges are always arrays
- [x] Applied normalizeLogs() to all 3 endpoints (pdf, excel, csv)
- [x] Added default fallbacks for driverName, licenceNumber, vehicleRegistration, vehicleType, driverType
- [x] Tested with complete data (returns URL) and with missing breaks/events (returns URL — no crash)
- [x] TypeScript: 0 errors

## Phase 48: Critical bug fixes (8 bugs)
- [x] BUG 1: Logbook loading — auth hydration already has null guard in loadLogs; user.name populated from registration
- [x] BUG 2: Registration fields — all fields already present (vehicle reg, vehicle type picker, driver type picker, password)
- [x] BUG 3: Reports NZTA limits — removed weekly row, fixed to fortnightly 70h, uses getDrivingLimitSeconds(driverType)
- [x] BUG 4: buildDailyLog — replaced with correct implementation (driving = elapsed - breaks - other work), added totalOtherWorkSeconds/otherWorkPeriods to DailyLog type
- [x] BUG 5: Compliance check — uses getDrivingLimitSeconds(driverType) in history.tsx, log-detail.tsx, reports.tsx
- [x] BUG 6: Excel export — normalizeLogs already applied with otherWorkPeriods/totalOtherWorkSeconds defaults
- [x] BUG 7: Colour scheme — restored #003366/#F0F4FF across all screens (dashboard, history, more, new-entry, shift-detail, log-detail)
- [x] BUG 8: Dashboard off-duty — rest countdown already working with restValidation (amber ring + green REST COMPLETE)
- [x] Auth types: added operatorName/licenceClass/licenceExpiry to Driver type and all persistence functions
- [x] TypeScript: 0 errors

## Phase 49: Fix break reset logic (NZTA driving limit)
- [x] computeCurrentDrivingSeconds: After a completed break >= 30 min, reset drivingMs to 0 (new driving period)
- [x] Distinguishes break_start from other_work_start (only rest breaks reset the driving accumulator)
- [x] Short breaks (< 30 min) do NOT reset — pre-break driving carries forward correctly
- [x] TypeScript: 0 errors

## Phase 50: Fix driving countdown display after 30-min break
- [x] Root cause: break_complete UI was showing pre-break remainingDrivingSeconds instead of full limit
- [x] Fix: When break >= 30 min and still open (break_complete mode), display drivingLimitSeconds (full 7:00 or 5:30)
- [x] computeCurrentDrivingSeconds function was already correct (unit tests all pass)
- [x] Updated old tests to match NZTA reset behavior
- [x] All 51 tests pass, TypeScript 0 errors
