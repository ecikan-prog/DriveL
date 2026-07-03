# Waka Kotahi NZ Transport Agency

# Electronic Logbook Application Form

**Land Transport Rule: Work Time and Logbooks 2007 (Rule 62001)**

---

## Section 1: Applicant Details

| Field | Details |
|---|---|
| **Full Name** | [TO FILL] |
| **Company Name** | [TO FILL] |
| **Company/NZBN Number** | [TO FILL] |
| **Contact Phone** | [TO FILL] |
| **Contact Email** | support@drivelegal.app |
| **Postal Address** | [TO FILL] |
| **Physical Address** | [TO FILL] |

---

## Section 2: Proposed System Details

### 2.1 System Name and Version

| Field | Details |
|---|---|
| **System Name** | Drive Legal |
| **Version** | 1.0.0 |
| **Previous Name (if applicable)** | RoadLog (rebranded to Drive Legal) |

### 2.2 System Type and Platform

| Field | Details |
|---|---|
| **System Type** | Mobile Application (App-based) |
| **Supported Platforms** | iOS (iPhone/iPad) and Android |
| **Country of Development** | New Zealand |
| **Distribution Method** | Apple App Store and Google Play Store |
| **App Store Link** | [TBC — pending approval] |
| **Google Play Link** | [TBC — pending approval] |

### 2.3 After-Sales Support

| Field | Details |
|---|---|
| **Support Email** | support@drivelegal.app |
| **Support Response Time** | Within 24 hours (standard), 4 hours (critical) |
| **User Documentation** | Provided (Driver's Guide and Enforcement Officer Guide enclosed) |
| **Software Updates** | Regular updates via App Store/Google Play to maintain compliance |
| **Data Backup** | Encrypted cloud synchronisation with automatic backup |

### 2.4 System Access for Testing

The following test accounts have been created for the Waka Kotahi assessment team:

**Driver Account (Mobile App):**

| Field | Value |
|---|---|
| Username | NZTA |
| Driver Licence Number | ZY987654 |
| Password | NZTAReview2026! |

**Operator/Employer Portal (Web Dashboard):**

| Field | Value |
|---|---|
| Portal URL | https://guidedlogbook-6i7vyx5h.manus.space/portal/login |
| Email | operator@drivelegal.app |
| Password | DriveLegal2026 |

**Mobile App Access:**

The application can be accessed via Expo Go for testing purposes. A production build will be submitted to the App Store and Google Play upon approval.

---

## Section 3: Compliance Report

### Requirement 1: Recording of Work Time

**Rule Reference:** Land Transport Rule: Work Time and Logbooks 2007, Clause 5

**How Drive Legal Meets This Requirement:**

Drive Legal provides comprehensive work time recording that captures all activities required under the Rule. When a driver starts a shift, the application automatically begins recording time in the appropriate category. The system supports four distinct activity types: Driving, Other Work, Rest Break, and Off Duty.

The application records continuous time data with second-level precision. Driving time is tracked from the moment a driver indicates they are driving until they switch to another activity or end their shift. Other Work time is separately tracked for non-driving work activities such as loading, vehicle inspections, or administrative tasks. Rest breaks are recorded with start and end times, and the system includes a 30-minute countdown timer to help drivers take qualifying breaks.

All four Transport Service Licence types are supported with their respective work time limits: Goods Service (5.5 hours continuous driving), Large Passenger Service, Small Passenger Service, and Vehicle Recovery Service (each with appropriate limits as defined in the Rule). The system automatically calculates cumulative work periods and provides progressive warnings at 15 minutes and 5 minutes before limits are reached.

Work time records include the driver's full name, driver licence number, Transport Service Licence type, vehicle registration number(s), odometer readings at start and end of shift, and GPS-verified locations. The system supports vehicle changes mid-shift, recording the new registration, odometer reading, and timestamp for each change.

### Requirement 2: Cumulative Work Period Management

**Rule Reference:** Land Transport Rule: Work Time and Logbooks 2007, Clause 6

**How Drive Legal Meets This Requirement:**

Drive Legal implements full Cumulative Work Period (CWP) management with automated validation and enforcement. The system tracks cumulative work hours across a rolling 24-hour period and a cumulative 70-hour work period.

Before allowing a driver to commence a new shift, the system validates that qualifying rest periods have been completed. A minimum 10-hour continuous rest period is required for daily reset, and a minimum 24-hour continuous rest period is required for CWP reset. If these conditions are not met, the system displays a clear warning message and blocks shift commencement (with override capability for exceptional circumstances, which is logged).

The 70-hour cumulative work period is tracked with progressive warnings. When a driver approaches the 70-hour limit, warnings are issued at 15 minutes remaining and again at 5 minutes remaining. These warnings are delivered both visually within the application and via push notifications to ensure the driver is alerted even if the app is in the background.

The Activity Grid provides a visual representation of the entire CWP, showing driving time, other work, rest breaks, and off-duty periods across multiple days. This allows both drivers and enforcement officers to quickly assess CWP compliance at a glance.

### Requirement 3: Data Integrity and Security

**Rule Reference:** Waka Kotahi Electronic Logbook Minimum Specifications, Section 3.4

**How Drive Legal Meets This Requirement:**

Drive Legal implements a SHA-256 cryptographic hash chain to ensure the integrity and tamper-evidence of all logbook records. Each entry in the logbook includes a hash value computed from the entry data combined with the hash of the previous entry, creating an unbreakable chain. Any attempt to modify a historical record would invalidate all subsequent hashes, making tampering immediately detectable.

Completed shifts are subject to a hard lock mechanism. Once a shift is ended, all entries become read-only and cannot be modified directly. Any changes to completed records must go through a formal amendment process that requires the driver to provide a mandatory reason for the change. The original data is preserved, the amendment is recorded with a timestamp and reason, and an asterisk (*) notation is applied to indicate the entry has been amended. This audit trail is visible to enforcement officers in the Enforcement View.

Data is stored locally on the device using encrypted storage and synchronised to encrypted cloud backup. The cloud sync ensures records are preserved even if the device is lost or damaged. All data transmission uses TLS encryption.

The system maintains a complete audit trail of all actions, including login/logout events, shift start/end, activity changes, amendments, and data exports.

### Requirement 4: Display and Export of Records

**Rule Reference:** Waka Kotahi Electronic Logbook Minimum Specifications, Sections 5 and 6

**How Drive Legal Meets This Requirement:**

Drive Legal provides multiple methods for displaying and exporting logbook records to satisfy both enforcement and administrative requirements.

**In-App Display:** The application provides a comprehensive History view showing all completed shifts with summary information. Each shift can be expanded to show full detail including all activities, times, locations, and any amendments. The Activity Grid provides a visual 24-hour timeline for each day.

**Enforcement View:** A dedicated read-only view is accessible for roadside inspections by CVIU and Police officers. This view presents the current day and previous 14 days of records in a clear, easily readable format without requiring driver credentials to access. It includes the Activity Grid, shift summaries, and highlights any breaches or warnings.

**PDF Export:** Complete logbook records can be exported as PDF documents that include all required information plus the Activity Grid visual timeline. These PDFs are suitable for emailing to enforcement officers or printing for physical records.

**Excel Export:** Logbook data can be exported in password-protected Excel format for secure record keeping and analysis. The Excel export includes all shift data, activity breakdowns, and compliance information.

**Operator Portal:** Employers and operators can access a web-based dashboard showing their drivers' records in read-only format. The portal displays driver names, shift history, activity grids, and breach/warning alerts.

### Requirement 5: Sole Use and Driver Identification

**Rule Reference:** Waka Kotahi Electronic Logbook Minimum Specifications, Section 4.1

**How Drive Legal Meets This Requirement:**

Drive Legal enforces sole use through multiple mechanisms. Each driver account is secured with individual credentials (email/username and password). The application displays a prominent notice on the logbook screen stating "This logbook is for the sole use of the registered driver" in compliance with specification 4.1.2.

Driver identification is comprehensive and includes: full legal name, driver licence number, Transport Service Licence number and type, and the employing operator/company name. This information is recorded with every shift and displayed in all exports and the Enforcement View.

The system does not permit multiple drivers to share a single account. Each driver must register with their own unique driver licence number, and the system validates that no duplicate licence numbers exist in the database.

---

## Section 4: Additional Information

### 4.1 Data Retention

Logbook records are retained for a minimum of 12 months on the device and indefinitely in cloud backup, exceeding the minimum retention requirements specified in the Rule.

### 4.2 System Availability

The application functions fully offline for recording purposes. Data is synchronised to the cloud when connectivity is available. This ensures drivers can maintain their logbook records regardless of cellular coverage.

### 4.3 Accessibility

The application interface has been designed with high contrast, clear typography, and large touch targets suitable for use in vehicle environments. The interface supports both light and dark modes.

---

## Section 5: Declaration

I declare that the information provided in this application is true and correct to the best of my knowledge. I understand that providing false or misleading information may result in the application being declined or approval being revoked.

I confirm that the electronic logbook system described in this application has been designed and tested to comply with the requirements of the Land Transport Rule: Work Time and Logbooks 2007 and the Waka Kotahi Electronic Logbook Minimum Specifications (September 2022).

| Field | Details |
|---|---|
| **Signature** | _________________________ |
| **Full Name** | [TO FILL] |
| **Position** | [TO FILL] |
| **Date** | ______ / ______ / 2026 |

---

*This application is submitted in accordance with the Waka Kotahi NZ Transport Agency Electronic Logbook approval process.*
