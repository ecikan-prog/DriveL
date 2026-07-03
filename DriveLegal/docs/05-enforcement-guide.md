# Drive Legal — Enforcement Officer Guide

## Roadside Inspection Procedures for CVIU and Police Officers

**Version 1.0 — June 2026**

---

## Overview

Drive Legal is a Waka Kotahi-approved electronic logbook application used by commercial drivers in New Zealand. This guide explains how enforcement officers (CVIU and NZ Police) can access and interpret logbook records during roadside inspections.

---

## 1. Accessing the Enforcement View

### 1.1 Requesting Access

During a roadside inspection, ask the driver to present their electronic logbook. The driver should:

1. Open the Drive Legal application on their mobile device
2. Navigate to the **Enforcement View** from the app menu
3. Hand the device to you for inspection

### 1.2 What You Will See

The Enforcement View is a dedicated **read-only** screen that presents all relevant logbook information in a clear, structured format. You cannot accidentally modify any records — the view has no edit controls.

The Enforcement View displays:

| Section | Information Shown |
|---|---|
| **Driver ID** | Full name, licence number, TSL number and type, employer |
| **Current Shift** | Start time, current activity, elapsed driving time |
| **Today's Record** | Complete activity breakdown for the current day |
| **14-Day History** | Summary of all shifts in the past 14 days |
| **Activity Grid** | Visual 24-hour timeline for each day |
| **Breaches** | Any work time violations highlighted in red |
| **Amendments** | Any modified records marked with asterisk (*) |

---

## 2. Reading the Activity Grid

The Activity Grid is a visual timeline showing the driver's work/rest pattern for each day. Each row represents one calendar day (midnight to midnight), divided into 24 hours.

### 2.1 Colour Key

| Colour | Activity | Meaning |
|---|---|---|
| **Navy** (#003366) | Driving | Time spent operating the vehicle |
| **Blue** (#5980E9) | Other Work | Non-driving work (loading, inspections, etc.) |
| **Green** (#22C55E) | Rest Break | Qualifying rest periods |
| **Grey** (#94A3B8) | Off Duty | Not working |

### 2.2 Interpreting the Grid

The width of each coloured block is proportional to the duration of that activity. Hour markers at 0, 6, 12, 18, and 24 help you identify approximate times.

**What to look for:**

- **Continuous navy blocks exceeding 5.5 hours** may indicate a continuous driving violation
- **Absence of green blocks** during a long work period may indicate missing rest breaks
- **Very short green blocks** (less than 30 minutes) do not count as qualifying breaks
- **Gaps or inconsistencies** between days may indicate missing records

---

## 3. Checking Compliance

### 3.1 Key Limits to Verify

| Rule | Limit | What to Check |
|---|---|---|
| Continuous driving | 5 hours 30 minutes maximum | No unbroken driving block exceeds 5h 30m |
| Qualifying break | Minimum 30 minutes | At least one green block ≥ 30 min before 5h 30m driving |
| Work day | 13 hours maximum | Total navy + blue blocks do not exceed 13 hours |
| Daily rest | Minimum 10 hours | Gap between shifts is at least 10 hours |
| Cumulative Work Period | 70 hours maximum | Total work across the period does not exceed 70 hours |
| CWP reset | 24 hours continuous rest | A full 24-hour off-duty period resets the CWP |

### 3.2 Breach Indicators

Drive Legal automatically highlights breaches in the Enforcement View:

- **Red warning icons** appear next to any shift that contains a violation
- **Breach details** are shown below the shift summary explaining what limit was exceeded
- **Cumulative totals** are displayed showing hours worked vs. limits

### 3.3 Amendment Indicators

If any record has been amended after completion:

- An **asterisk (*)** appears next to the amended entry
- Tapping the asterisk (or scrolling to the amendments section) shows:
  - The original recorded value
  - The amended value
  - The reason provided by the driver
  - The date and time the amendment was made

Frequent or suspicious amendments may warrant further investigation.

---

## 4. Verifying Data Integrity

### 4.1 Hash Chain Verification

Drive Legal uses SHA-256 cryptographic hashing to ensure records have not been tampered with. Each entry's hash depends on the previous entry, creating an unbreakable chain.

In the Enforcement View, the integrity status is displayed:

| Status | Meaning |
|---|---|
| **✓ Verified** (green) | Hash chain is intact — records have not been tampered with |
| **✗ Invalid** (red) | Hash chain is broken — possible tampering detected |

If the hash chain shows as invalid, this indicates that records may have been modified outside the normal amendment process. This should be treated as a serious compliance concern.

### 4.2 Locked Records

All completed shifts in Drive Legal are **hard-locked** after the shift ends. The "LOCKED" badge confirms that the record cannot be edited without going through the formal amendment process. This ensures the integrity of historical records.

---

## 5. Requesting Exported Records

### 5.1 On-the-Spot PDF

If you require a physical or electronic copy of the records:

1. Ask the driver to generate a PDF export from the app
2. The driver can email the PDF to your official email address
3. The PDF includes all shift data plus the Activity Grid visual timeline

### 5.2 Extended Records Request

For records beyond the 14-day display, or for formal investigation purposes, contact the driver's employer/operator. Operators have access to the full record history through the Operator Portal.

---

## 6. Operator Portal Access

For fleet-level investigations, operators/employers can provide access to the web-based Operator Portal. The portal shows:

- All drivers linked to the operator
- Complete shift history for each driver
- Activity Grids and compliance status
- Breach alerts and warnings

The portal is strictly read-only — operators cannot modify driver records.

---

## 7. Common Scenarios

### 7.1 Driver Claims App Malfunction

If a driver claims the app was not working and records are incomplete:

- Check the device's app storage — Drive Legal stores data locally even without internet
- Ask to see the History tab for any partial records
- Note that Drive Legal functions fully offline; internet is not required for recording
- If genuinely no records exist, treat as per standard procedures for missing logbook entries

### 7.2 Multiple Vehicles in One Day

If the driver used multiple vehicles:

- The shift detail view shows all vehicle changes with timestamps
- Each vehicle change records: new registration, odometer reading, and time of change
- Verify that the current vehicle matches the most recent vehicle change entry

### 7.3 Driver Recently Changed TSL Type

The TSL type is displayed in the driver identification section. If the driver recently changed their TSL type, the historical records will show the type that was active at the time of each shift.

---

## 8. Quick Reference Card

**To inspect a driver using Drive Legal:**

1. Ask driver to open Enforcement View
2. Check driver identification matches licence
3. Review Activity Grid for obvious violations
4. Check breach indicators (red warnings)
5. Verify hash chain integrity (green ✓)
6. Check for amendments (asterisk *)
7. If needed, request PDF export via email

**Key violations to look for:**

- Continuous driving > 5h 30m without 30-min break
- Total work day > 13 hours
- Less than 10h rest between shifts
- Cumulative work > 70 hours without 24h reset
- Broken hash chain (possible tampering)
- Excessive or suspicious amendments

---

## Contact Information

For technical queries about the Drive Legal system:

- **Support Email:** support@drivelegal.app
- **Response Time:** Within 4 hours for enforcement-related queries

For regulatory queries:

- **Waka Kotahi:** DriverandOperator@nzta.govt.nz

---

*This guide is provided for the use of authorised enforcement officers conducting roadside inspections under the Land Transport Rule: Work Time and Logbooks 2007.*
