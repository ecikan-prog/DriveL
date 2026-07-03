# Drive Legal — Compliance Specification and Technical Report

## Electronic Logbook Minimum Specifications Compliance Assessment

**Prepared for:** Waka Kotahi NZ Transport Agency

**Document Version:** 2.0

**Date:** June 2026

**System:** Drive Legal v1.0.0 (formerly RoadLog)

**Reference Standard:** Waka Kotahi Electronic Logbook Minimum Specifications (September 2022)

---

## Executive Summary

This document provides a comprehensive compliance mapping of the Drive Legal electronic logbook system against all requirements specified in the Waka Kotahi Electronic Logbook Minimum Specifications (September 2022). For each specification section, the document explains precisely how Drive Legal meets or exceeds the stated requirement, including technical implementation details where relevant.

Drive Legal is a mobile application for iOS and Android that provides a fully compliant electronic logbook for commercial transport operators in New Zealand. The system has been designed from the ground up to satisfy the Land Transport Rule: Work Time and Logbooks 2007 (Rule 62001) and the associated Minimum Specifications.

---

## Section 3: System Requirements

### 3.1 General System Requirements

#### 3.1.1 — System Must Record All Required Information

**Requirement:** The electronic logbook system must record all information required by the Land Transport Rule: Work Time and Logbooks 2007.

**How Drive Legal Complies:**

Drive Legal records the following information for every working day:

| Data Field | Implementation |
|---|---|
| Driver's full name | Captured at registration, displayed on all records |
| Driver licence number | Captured at registration, validated format |
| TSL number and type | Selected during setup (all 4 types supported) |
| Employer/operator name | Captured at registration |
| Vehicle registration number(s) | Entered at shift start, updated on vehicle change |
| Odometer readings (start/end) | Recorded at shift start and end, and at vehicle changes |
| Date of each working day | Automatically recorded from device clock |
| Start time of work | Recorded when driver starts shift |
| End time of work | Recorded when driver ends shift |
| Total driving time | Calculated automatically with second-level precision |
| Total other work time | Tracked separately from driving time |
| Total rest/break time | Recorded with start/end times for each break |
| Location at start/end of shift | GPS auto-captured with manual override |
| Location at each activity change | GPS auto-captured at each transition |

All four Transport Service Licence types are fully supported:

| TSL Type | Continuous Driving Limit | Work Day Limit |
|---|---|---|
| Goods Service | 5 hours 30 minutes | 13 hours |
| Large Passenger Service | 5 hours 30 minutes | 13 hours |
| Small Passenger Service | 5 hours 30 minutes | 13 hours |
| Vehicle Recovery Service | 5 hours 30 minutes | 13 hours |

#### 3.1.2 — System Must Be Accurate

**Requirement:** The system must accurately record times and durations.

**How Drive Legal Complies:**

Drive Legal uses the device system clock for all time recording, with timestamps stored in millisecond precision (Unix epoch format). All time calculations are performed using these precise timestamps rather than rounded values. The displayed times are formatted for readability but the underlying data maintains full precision.

The system uses `Date.now()` for all timestamp capture, ensuring consistency across all recorded events. Duration calculations are performed by subtracting start timestamps from end timestamps, providing accurate-to-the-second duration tracking.

#### 3.1.3 — System Must Function Offline

**Requirement:** The system must be capable of recording logbook information without requiring continuous internet connectivity.

**How Drive Legal Complies:**

Drive Legal stores all logbook data locally on the device using AsyncStorage (encrypted local storage). The application functions fully offline for all recording operations including shift start/end, activity changes, break recording, and vehicle changes. Data is synchronised to the cloud when connectivity becomes available, but this synchronisation is not required for the core recording functionality.

GPS location capture uses the device's built-in GPS receiver and does not require internet connectivity for satellite-based positioning. If GPS is unavailable (e.g., in tunnels or underground), the driver can manually enter their location.

#### 3.1.4 — System Must Support Multiple Vehicles

**Requirement:** The system must support recording of multiple vehicles used during a single working day.

**How Drive Legal Complies:**

Drive Legal includes a dedicated "Change Vehicle" function accessible during an active shift. When a driver changes vehicles mid-shift, the system records:

- New vehicle registration number
- Odometer reading of the new vehicle
- Timestamp of the vehicle change
- Optional reason for the change

Multiple vehicle changes per shift are fully supported. The shift detail view and all exports (PDF, Excel) display the complete vehicle history for each working day, including all registration numbers, odometer readings, and change timestamps.

### 3.2 Time Recording Requirements

#### 3.2.1 — Continuous Time Recording

**Requirement:** The system must provide continuous time recording from the start of a work period until the end, with no gaps in the recorded timeline.

**How Drive Legal Complies:**

Drive Legal implements continuous time recording through a state machine that tracks the driver's current activity at all times during an active shift. The possible states are: Driving, Other Work, and Rest Break. The system transitions between states based on driver input, and each transition is recorded with a precise timestamp.

There are no gaps in the timeline — every second between shift start and shift end is accounted for in one of the three activity categories. The Activity Grid visual timeline confirms this by rendering a complete 24-hour bar with no empty segments during active shift periods.

#### 3.2.2 — Activity Type Recording

**Requirement:** The system must distinguish between driving time, other work time, and rest time.

**How Drive Legal Complies:**

Drive Legal tracks three distinct activity types during a shift:

| Activity | Description | Visual Indicator |
|---|---|---|
| **Driving** | Time spent operating the vehicle | Navy blue in Activity Grid |
| **Other Work** | Non-driving work (loading, inspections, admin) | Light blue in Activity Grid |
| **Rest Break** | Qualifying rest periods | Green in Activity Grid |

Each activity transition is recorded with a timestamp and optional GPS location. The system also tracks Off Duty time (grey in Activity Grid) for periods between shifts.

Drivers switch between activities using clearly labelled buttons on the main shift screen. The current activity is prominently displayed with the status indicator showing "DRIVING", "OTHER WORK", or "ON BREAK".

#### 3.2.3 — Break Time Monitoring

**Requirement:** The system must monitor and record rest break periods to ensure qualifying breaks are taken.

**How Drive Legal Complies:**

Drive Legal provides comprehensive break monitoring:

1. **Break Recording:** When a driver taps "Break", the system records the break start time and transitions to break state. The break end is recorded when the driver resumes work.

2. **30-Minute Countdown Timer:** During a break, the circular countdown timer on the Dashboard switches to an orange/amber ring showing a 30-minute countdown (30:00 → 0:00) with the label "BREAK TIME REMAINING". This provides clear visual feedback on whether a qualifying 30-minute break has been achieved.

3. **Break Completion Indicator:** Once the 30-minute break period is complete, the timer ring turns green and displays "READY TO RESUME DRIVING" with the remaining available work hours shown. This clearly indicates to the driver that a qualifying break has been taken.

4. **Break Validation:** The rest period validation system checks that qualifying breaks (minimum 30 minutes continuous) have been taken before allowing continued driving beyond the continuous driving limit.

### 3.3 Location Recording Requirements

#### 3.3.1 — GPS Location Capture

**Requirement:** The system must record the geographic location at the start and end of each work period and at each change of activity.

**How Drive Legal Complies:**

Drive Legal uses the device's GPS receiver (via `expo-location`) to automatically capture geographic coordinates at the following events:

- Shift start
- Shift end
- Each activity change (driving → break, break → driving, etc.)
- Vehicle changes

Location data is captured as latitude/longitude coordinates and reverse-geocoded to a human-readable address (city/region name) for display purposes. Both the raw coordinates and the display name are stored.

#### 3.3.2 — Manual Location Override

**Requirement:** The system must allow manual entry of location when GPS is unavailable.

**How Drive Legal Complies:**

If GPS positioning fails or returns insufficient accuracy, Drive Legal prompts the driver to manually enter their location. The manual entry field accepts free-text location descriptions (e.g., "SH1, 5km north of Kaikoura"). Manual entries are clearly marked in the records to distinguish them from GPS-verified locations.

The system also allows drivers to manually override a GPS-captured location if they believe it is inaccurate, with the override recorded in the audit trail.

### 3.4 Data Integrity and Security

#### 3.4.1 — Tamper-Evident Records

**Requirement:** The system must implement measures to prevent or detect unauthorised modification of logbook records.

**How Drive Legal Complies:**

Drive Legal implements a **SHA-256 cryptographic hash chain** for tamper-evidence. The implementation works as follows:

1. Each logbook entry (DailyLog) contains a `hashChain` field storing its SHA-256 hash value.
2. The hash is computed from the entry's data concatenated with the hash of the previous entry.
3. This creates an unbreakable chain where modification of any historical entry would invalidate all subsequent hashes.
4. The hash chain can be verified at any time to confirm data integrity.

The hash computation includes: shift start/end times, all activity records with timestamps, driver identification, vehicle information, odometer readings, and location data. Any modification to any of these fields would produce a different hash, breaking the chain.

#### 3.4.2 — Hard Lock on Completed Records

**Requirement:** Completed records must not be modifiable without a formal amendment process.

**How Drive Legal Complies:**

Drive Legal implements a **hard lock mechanism** on all completed shifts:

1. Once a shift is ended (via the "End Shift" action), all entries for that shift become read-only.
2. The shift detail view displays a prominent "LOCKED" badge and a blue information banner explaining that the record is locked.
3. No direct editing of any field is possible after the shift is completed.
4. The only way to modify a completed record is through the formal **Amendment Process**.

The Amendment Process requires:

- The driver must provide a **mandatory reason** for the amendment (free text, minimum length enforced)
- The original value is preserved in the record
- The amendment is timestamped
- An asterisk (*) notation is applied to the amended field
- The amendment reason is stored and visible in all views including the Enforcement View

#### 3.4.3 — Audit Trail

**Requirement:** The system must maintain a complete audit trail of all changes to logbook records.

**How Drive Legal Complies:**

Drive Legal maintains a comprehensive audit trail that records:

| Event Type | Data Recorded |
|---|---|
| Record creation | Timestamp, all field values, hash chain entry |
| Amendment | Original value, new value, reason, timestamp, driver ID |
| Export | Export type (PDF/Excel), timestamp, recipient |
| Login/Logout | Timestamp, device information |
| Shift actions | All state transitions with timestamps |

Amendments are visually indicated with an asterisk (*) in all display views. The Enforcement View shows the complete amendment history for any modified record, including the original value, the new value, the reason provided, and when the change was made.

#### 3.4.4 — Data Encryption and Storage

**Requirement:** Logbook data must be stored securely and protected from unauthorised access.

**How Drive Legal Complies:**

Drive Legal implements multiple layers of data security:

- **Local Storage:** Data is stored using AsyncStorage with device-level encryption provided by the operating system (iOS Keychain / Android Keystore).
- **Cloud Sync:** All data transmitted to the cloud uses TLS 1.3 encryption. Cloud storage uses encrypted databases (TiDB/MySQL with encryption at rest).
- **Authentication:** Driver accounts are protected by password authentication. Passwords are hashed before storage (never stored in plaintext).
- **Session Management:** Authentication sessions expire after inactivity and require re-authentication.
- **Export Security:** Excel exports are password-protected. PDF exports contain the driver's identification for accountability.

---

## Section 4: Driver Interface Requirements

### 4.1 Driver Identification

#### 4.1.1 — Driver Registration

**Requirement:** The system must capture and store the driver's identification information.

**How Drive Legal Complies:**

During registration, Drive Legal captures the following driver information:

| Field | Validation |
|---|---|
| Full legal name | Required, minimum 2 characters |
| Email address | Required, valid email format |
| Driver licence number | Required, NZ format validated |
| Transport Service Licence number | Required |
| TSL type | Required, selection from 4 types |
| Employer/operator name | Required |
| Vehicle registration (default) | Required, NZ format |

This information is stored securely and displayed on all logbook records, exports, and the Enforcement View.

#### 4.1.2 — Sole Use Notice

**Requirement:** The system must display a notice that the logbook is for the sole use of the registered driver.

**How Drive Legal Complies:**

Drive Legal displays a prominent notice on the main logbook screen (History tab) stating:

> "This logbook is for the sole use of [DRIVER NAME] — Licence [LICENCE NUMBER]"

This notice is rendered in a distinct blue information banner that is always visible when viewing the logbook. It satisfies the requirement of specification 4.1.2 by clearly identifying the registered driver and reinforcing that the logbook must not be used by any other person.

### 4.2 User Interface

#### 4.2.1 — Clear and Readable Display

**Requirement:** The system must present information in a clear, easily readable format suitable for use in a vehicle environment.

**How Drive Legal Complies:**

Drive Legal's interface has been designed specifically for in-vehicle use:

- **Large Touch Targets:** All primary action buttons are minimum 48px height with generous padding for use while wearing gloves or in vibrating vehicles.
- **High Contrast:** The dark theme Dashboard uses white text on dark backgrounds with colour-coded status indicators (green for active/safe, amber for break, red for warnings).
- **Clear Typography:** All text uses system fonts at readable sizes (minimum 11px for labels, 16px+ for primary information, 52px for the countdown timer).
- **Minimal Distraction:** The interface shows only essential information during driving, with detailed views accessible when stopped.
- **Status at a Glance:** The current status (DRIVING/ON BREAK/OFF DUTY) is displayed prominently with a colour-coded indicator dot.

#### 4.2.2 — Activity Grid Display

**Requirement:** The system should provide a visual representation of the driver's work/rest pattern.

**How Drive Legal Complies:**

Drive Legal includes a comprehensive **Activity Grid** that provides a 24-hour visual timeline for each working day. The grid displays:

| Colour | Activity |
|---|---|
| Navy (#003366) | Driving |
| Blue (#5980E9) | Other Work |
| Green (#22C55E) | Rest Break |
| Grey (#94A3B8) | Off Duty |

The Activity Grid is displayed:
- In the main app (History tab, shift detail view)
- In the Enforcement View (for roadside inspections)
- In PDF exports (rendered as a visual timeline)
- In the Operator Portal (for employer review)

Each day row shows the 24-hour period from midnight to midnight with hour markers. Activity blocks are rendered proportionally to their duration, providing an immediate visual overview of the work/rest pattern.

---

## Section 5: Export and Reporting Requirements

### 5.1 Record Export

#### 5.1.1 — PDF Export

**Requirement:** The system must be capable of producing a printed or electronic copy of logbook records.

**How Drive Legal Complies:**

Drive Legal generates comprehensive PDF reports that include:

- Driver identification (name, licence number, TSL details)
- Shift summary (date, start/end times, total hours)
- Complete activity breakdown with times and durations
- **Activity Grid visual timeline** (rendered in the PDF)
- Vehicle information (all vehicles used, with rego and odometer)
- Location data (start/end locations)
- Amendment history (if any, with asterisk notation)
- Compliance status and any breach notifications
- Hash chain verification status

PDFs can be generated for individual shifts or date ranges. They can be shared via email, messaging apps, or saved to the device for later use.

#### 5.1.2 — Excel Export

**Requirement:** The system should support export of data in a format suitable for analysis and record-keeping.

**How Drive Legal Complies:**

Drive Legal provides Excel (.xlsx) export with the following features:

- **Password Protection:** All Excel exports are password-protected to prevent unauthorised access or modification.
- **Comprehensive Data:** Exports include all shift data, activity breakdowns, vehicle information, and compliance calculations.
- **Structured Format:** Data is organised in clearly labelled columns suitable for analysis, filtering, and sorting.
- **Date Range Selection:** Users can export records for specific date ranges.

#### 5.1.3 — Data Availability for Enforcement

**Requirement:** Records must be available for inspection by enforcement officers within a reasonable timeframe.

**How Drive Legal Complies:**

Drive Legal provides **immediate** access to records for enforcement officers through the dedicated **Enforcement View**. This view:

- Is accessible from the app's main menu without requiring the enforcement officer to have their own credentials
- Displays the current day and previous 14 days of records
- Shows all required information in a clear, read-only format
- Includes the Activity Grid for visual pattern assessment
- Highlights any breaches or warnings
- Can generate and share a PDF on the spot if a physical copy is required

---

## Section 6: Operator/Employer Access

### 6.1 Operator Portal

#### 6.1.1 — Employer Access to Records

**Requirement:** The system must provide a mechanism for employers/operators to access their drivers' logbook records.

**How Drive Legal Complies:**

Drive Legal includes a dedicated **Operator/Employer Portal** — a web-based dashboard accessible at `/portal` on the application server. The portal provides:

| Feature | Description |
|---|---|
| Separate authentication | Operators log in with their own credentials (email/password) |
| Driver list | View all linked drivers with their current status |
| Shift history | Complete shift records for each driver |
| Activity Grid | Visual timeline for each driver's working days |
| Breach alerts | Highlighted warnings and breaches for each driver |
| Read-only access | Operators cannot modify driver records |

The portal is designed for desktop/tablet use and provides a comprehensive overview of fleet compliance. Operators can monitor their drivers' work patterns, identify potential compliance issues, and maintain oversight as required by the Rule.

#### 6.1.2 — Operator Cannot Modify Records

**Requirement:** Operator access must be read-only; operators must not be able to modify driver records.

**How Drive Legal Complies:**

The Operator Portal is strictly read-only. The portal displays a prominent "READ-ONLY" badge on all driver record views. The portal interface does not include any edit controls, and the server-side API enforces read-only access for operator-authenticated sessions. There is no mechanism — either in the interface or the API — for an operator to modify, delete, or amend any driver record.

---

## Summary Compliance Matrix

| Specification Section | Requirement | Status |
|---|---|---|
| 3.1.1 | Record all required information | ✅ Compliant |
| 3.1.2 | Accurate time recording | ✅ Compliant |
| 3.1.3 | Offline functionality | ✅ Compliant |
| 3.1.4 | Multiple vehicle support | ✅ Compliant |
| 3.2.1 | Continuous time recording | ✅ Compliant |
| 3.2.2 | Activity type recording | ✅ Compliant |
| 3.2.3 | Break time monitoring | ✅ Compliant |
| 3.3.1 | GPS location capture | ✅ Compliant |
| 3.3.2 | Manual location override | ✅ Compliant |
| 3.4.1 | Tamper-evident records (SHA-256) | ✅ Compliant |
| 3.4.2 | Hard lock on completed records | ✅ Compliant |
| 3.4.3 | Audit trail | ✅ Compliant |
| 3.4.4 | Data encryption and storage | ✅ Compliant |
| 4.1.1 | Driver registration | ✅ Compliant |
| 4.1.2 | Sole use notice | ✅ Compliant |
| 4.2.1 | Clear and readable display | ✅ Compliant |
| 4.2.2 | Activity Grid display | ✅ Compliant |
| 5.1.1 | PDF export | ✅ Compliant |
| 5.1.2 | Excel export | ✅ Compliant |
| 5.1.3 | Enforcement access | ✅ Compliant |
| 6.1.1 | Operator portal | ✅ Compliant |
| 6.1.2 | Operator read-only access | ✅ Compliant |

---

## Technical Architecture

### System Components

| Component | Technology | Purpose |
|---|---|---|
| Mobile App | React Native / Expo SDK 54 | Driver interface (iOS/Android) |
| Backend Server | Node.js / Express | API, authentication, cloud sync |
| Database | MySQL / TiDB | Cloud data storage |
| Operator Portal | Server-rendered HTML | Employer web dashboard |
| Hash Chain | SHA-256 (crypto module) | Data integrity verification |
| Location | expo-location (GPS) | Geographic position capture |
| Local Storage | AsyncStorage (encrypted) | Offline data persistence |
| Notifications | expo-notifications | Compliance warnings |

### Data Flow

1. **Recording:** Driver actions → Local storage (AsyncStorage) → Hash chain computation → Cloud sync (when online)
2. **Enforcement:** Enforcement View request → Local storage read → Display current + 14 days history
3. **Export:** Export request → Data compilation → PDF/Excel generation → Share/email
4. **Operator:** Portal login → Server authentication → Database query → Read-only display

### Security Model

The security model implements defence in depth:

1. **Authentication Layer:** Password-based authentication with hashed storage
2. **Transport Layer:** TLS 1.3 for all network communications
3. **Storage Layer:** Device-level encryption (iOS Keychain / Android Keystore)
4. **Integrity Layer:** SHA-256 hash chain for tamper detection
5. **Access Control Layer:** Role-based access (driver, operator, enforcement)
6. **Audit Layer:** Complete event logging for all system actions

---

## References

- Land Transport Rule: Work Time and Logbooks 2007 (Rule 62001)
- Waka Kotahi Electronic Logbook Minimum Specifications (September 2022)
- Land Transport Act 1998, Section 30ZF (Electronic Logbooks)
- NZ Transport Agency Factsheet 64: Work Time and Logbooks

---

*Document prepared by Drive Legal Development Team — June 2026*

*For questions regarding this compliance report, contact: support@drivelegal.app*
