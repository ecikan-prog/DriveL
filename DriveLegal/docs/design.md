# Guided NZ Logbook — Mobile App Design

## Brand Colors
- **Navy**: `#003366` — primary brand, headers, key UI elements
- **Action Blue**: `#5980E9` — interactive elements, CTAs, active states
- **Surface Light**: `#F0F4FF` — card backgrounds, subtle fills
- **Success Green**: `#22C55E` — shift active, compliant status
- **Warning Amber**: `#F59E0B` — approaching limits
- **Error Red**: `#EF4444` — limit exceeded, critical warnings

## Screen List

1. **Splash / Onboarding** — App logo, tagline, CTA to Register or Login
2. **Register Screen** — Full name, email, password, NZ driver licence number, vehicle registration
3. **Login Screen** — Email + password, link to register
4. **Dashboard (Home)** — Active shift status, driving timer, work timer, break timer, Start/Stop Shift, Start/End Break buttons, NZTA warning banners
5. **Log History Screen** — Scrollable list of past daily logs, each showing date, start/end, driving total, work total, breaks
6. **Log Detail Screen** — Full breakdown of a single day's log with all events (shift start, breaks, shift end)
7. **Profile Screen** — Driver info, vehicle details, trial/subscription status, logout

## Primary Content and Functionality

### Dashboard
- Large circular timer showing current driving time (HH:MM:SS)
- Secondary timer for total work time
- Break timer when break is active
- "Start Shift" / "End Shift" primary action button (Navy/Action Blue)
- "Start Break" / "End Break" secondary button
- NZTA warning banners (amber/red) when thresholds are approaching or exceeded:
  - 7h driving → "Take a 30-minute break now!"
  - 13h work → "10-hour break required!"
  - 70h fortnightly → "Fortnightly limit warning!"
- Today's summary: driving hours, work hours, breaks taken

### Log History
- Grouped by date (most recent first)
- Each card: date, start–end time, driving total, work total, break count
- Tap to view detail
- Export button (CSV) for compliance sharing

### Profile
- Driver name, licence number, vehicle registration
- Trial status (14-day countdown or subscription active)
- Edit profile option
- Logout

## Key User Flows

### Start Shift
1. Open app → Dashboard
2. Tap "Start Shift" → timer begins, button changes to "End Shift"
3. Timers count up in real-time
4. At 7h driving → amber warning banner appears
5. Tap "Start Break" → driving timer pauses, break timer starts
6. Tap "End Break" → driving timer resumes
7. Tap "End Shift" → log saved, summary shown

### View History
1. Tap "History" tab
2. Scroll through past logs
3. Tap a log → detail view with full event timeline
4. Tap "Export" → share CSV file

## Navigation Structure
- **Bottom Tab Bar** (3 tabs):
  - Dashboard (house icon)
  - History (clock/list icon)
  - Profile (person icon)
- **Auth Stack** (before login):
  - Login screen
  - Register screen

## Layout Principles
- Portrait-only, one-handed usage
- Large tap targets (min 44pt)
- Clear visual hierarchy: timer is the hero element on Dashboard
- Cards with subtle shadows for log entries
- Status-colour coding (green = active, amber = warning, red = critical)
