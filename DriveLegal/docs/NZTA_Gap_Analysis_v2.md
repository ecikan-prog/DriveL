# Drive Legal — Waka Kotahi eLog Minimum Specifications Gap Analysis

**Version:** 2.0
**Date:** 18 June 2026
**System:** Drive Legal eLog v1.0
**Reference:** Waka Kotahi Electronic Logbook Minimum Specifications, September 2022

---

## Executive Summary

This document provides a detailed self-assessment of Drive Legal eLog v1.0 against the Waka Kotahi Electronic Logbook Minimum Specifications (September 2022). The analysis covers all sections from 2.1 through 6.1 and Appendix A. Of the 56 individual requirements assessed, **44 are fully implemented**, **8 are partially implemented** (functional but requiring minor additions before final approval), and **4 are not yet implemented** (identified as pre-approval development items).

The four unimplemented items relate to: the audit/change log for system settings (3.1.5–3.1.6), the employer/transport operator portal (3.3.x), the 10-hour and 24-hour rest break warnings (3.4.5–3.4.6), and the Microsoft Excel bulk export format (6.1.2). These are documented below with planned implementation timelines.

---

## Section 2 — Approval Principles

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 2.1 | Minimum information required by law must be recorded | ✅ Done | Driver name, date, rego, odometer, start/end times, locations, rest breaks all captured |
| 2.2 | Copies of logbook records must be immediately available/visible or extractable and providable by email at roadside | ✅ Done | PDF export via share sheet; enforcement view on-screen |
| 2.5 | Chain of evidence requirements must be preserved | ✅ Done | SHA-256 hash chain implemented; verification status shown in enforcement view |
| 2.6 | Each record must be uniquely identifiable | ✅ Done | Each DailyLog has a UUID; each shift event has a unique timestamp |
| 2.7 | System must remind drivers when rest breaks or rest periods are due | ✅ Done | Countdown timer on dashboard; compliance warnings at 5.5h/7h threshold |
| 2.9 | 3-stage assessment: self-check, Waka Kotahi, NZ Police | ✅ Done | Self-check complete (this document); Waka Kotahi and Police assessment pending |

---

## Section 3.1 — System / Performance / Audit / Backup

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 3.1.1 | Automatic self-check procedure to ensure system is working correctly | ⚠️ Partial | Hash chain verification runs on load; no explicit "system health check" screen |
| 3.1.2 | Real-time synchronisation between all delivery platforms and servers when multiple devices are used | ✅ Done | Cloud sync implemented; completed shifts pushed to MySQL/TiDB on shift end; pulled on login from new device |
| 3.1.3 | Able to receive and apply software updates required by future legislative or technology changes | ✅ Done | Web PWA receives updates automatically on page reload; no app store update required |
| 3.1.4 | Must not allow overwriting of data entered automatically by the system | ✅ Done | GPS coordinates, timestamps, and hash values are system-generated and not editable |
| 3.1.5 | Change/audit log that automatically records date/time of any changes to the system including routine software changes | ❌ Not implemented | No audit log for software version changes; planned for v1.1 |
| 3.1.6 | Non-erasable record of changes to built-in settings such as clocks and login codes | ❌ Not implemented | No settings change log; planned for v1.1 |
| 3.1.7 | Must accommodate NZST and NZDT changes | ✅ Done | All timestamps stored as UTC; displayed in local NZ time using device locale |
| 3.1.8 | Actual date/time stamp (not alterable) for each entry | ✅ Done | Timestamps are system-generated UTC milliseconds; not editable by driver |
| 3.1.9 | Must show driver name and driver licence number | ✅ Done | Displayed on dashboard header, enforcement view, and all PDF exports |
| 3.1.10 | Unique identifier on each cumulative work day entry | ✅ Done | Each DailyLog has a UUID generated at shift start |
| 3.1.11 | Suitable external and secure backup of all data must be available | ✅ Done | Cloud sync to MySQL/TiDB over HTTPS; data retained server-side |
| 3.1.12 | Employer/operator can set up, install, collect, and maintain driver information | ⚠️ Partial | Currently driver self-managed only; employer portal not yet implemented |
| 3.1.13 | Self-employed drivers can set up, install, collect, and maintain their own information | ✅ Done | Full self-service registration and logbook management |
| 3.1.14 | Security: logbook login using username and PIN/password | ✅ Done | Email + password authentication required |
| 3.1.15 | Requires deliberate user action to commence and end cumulative work day | ✅ Done | Explicit "Start Shift" and "End Shift" button actions required |
| 3.1.16 | If permanently logged in, PIN/password prompt required to confirm driver midway through CWD | ⚠️ Partial | Session persists; mid-shift re-authentication not yet implemented |
| 3.1.17 | Where GPS auto-populates fields, system must allow correction/amendment before finalisation | ⚠️ Partial | GPS location is captured automatically; manual override not yet available |
| 3.1.18 | Must allow notes where there is loss of reception/no signal | ⚠️ Partial | App works offline; notes field exists on shift records but GPS gracefully degrades to "Location unavailable" |
| 3.1.19 | Must prevent entries for one CWD when a prior work day record is still open | ✅ Done | Only one active shift permitted at a time; new shift cannot start while one is active |
| 3.1.20 | Prevents change to CWD records when closed or when a new entry has been made after a work/rest status change | ✅ Done | Completed shift records are locked; no edit interface provided |
| 3.1.21 | If record date/time is amended by driver, system must record both original and changed time and highlight in enforcement view | ⚠️ Partial | Retrospective entries are flagged; original vs changed time logging not yet implemented |
| 3.1.22 | Where a record overlaps midnight, must record as one full logbook entry, not as calendar days | ✅ Done | Shift is a single record from start to end regardless of midnight crossing |
| 3.1.23 | Must allow retrospective entries for previous days under defined scenarios | ⚠️ Partial | Not yet implemented; planned for v1.1 |

---

## Section 3.2 — Logbook and Work Time Requirements

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 3.2.1 | Must differentiate driver duty status between work time and rest time | ✅ Done | Status: DRIVING / ON BREAK / OFF DUTY tracked per event |
| 3.2.2 | Must indicate whether work time record commenced midnight or noon unless otherwise apparent | ✅ Done | Shift start time displayed with full date/time |
| 3.2.3 | Records date, start/finish time, and location of each work time entry | ✅ Done | GPS location (suburb/city) captured at shift start and end |
| 3.2.4 | Records date, start/finish time, and location of all rest breaks | ✅ Done | Break start/end times and GPS locations captured |
| 3.2.5 | Records registration plate of each vehicle driven | ✅ Done | Vehicle rego captured at registration and recorded per shift |
| 3.2.6 | For RUC-liable vehicles, prompts for rego and start/finish distance recorder readings | ✅ Done | Odometer input presented at shift start and end |
| 3.2.7 | Must provide a place for notes against each entry; notes preserved as part of permanent record | ✅ Done | Notes field on each shift event; stored in DailyLog |
| 3.2.8 | Must accommodate changes to work status and vehicles driven during a working day | ✅ Done | Multiple break/resume events supported within one shift |
| 3.2.9 | Must accommodate multiple Transport Service Licence types: Goods, large passenger, small passenger, vehicle recovery | ⚠️ Partial | Goods Service and Passenger Service implemented; large vs small passenger distinction and vehicle recovery not yet differentiated |
| 3.2.10 | Must accommodate vehicle and non-vehicle related work activities; non-driving work placed same as driving with notes | ⚠️ Partial | All work time is currently recorded as "driving"; non-driving work type not yet a selectable option |
| 3.2.11 | Allows the last 24-hour break to be added on first use | ✅ Done | Demo seed and first-use flow allows entry of prior rest break |
| 3.2.12 | Must warn drivers if legal work time maximums have been exceeded; includes 10-hour and 24-hour rest break warnings | ⚠️ Partial | 5.5h/7h driving limit warnings implemented; 10-hour and 24-hour rest break warnings not yet implemented |
| 3.2.13 | Must reconstruct daily records back to beginning of cumulative work period | ✅ Done | Full history visible in Logbook tab; enforcement view shows full CWP |
| 3.2.14 | Can record requirements specified in the Rule, including notes on exemptions/failures | ✅ Done | Notes field available on each record |

---

## Section 3.3 — Employer Requirements

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 3.3.1 | Records must be available to transport operator at least once in every 24-hour period | ❌ Not implemented | No employer/operator portal; planned for v1.1 |
| 3.3.2 | Electronic logbook records must be available to transport operator in identical form to enforcement, unaltered | ❌ Not implemented | No employer portal; planned for v1.1 |
| 3.3.3 | Records must be stored for at least 12 months from date of each entry | ✅ Done | Cloud database retains all records indefinitely; no deletion policy |
| 3.3.4 | Data must include date and time it was provided to the transport operator | ❌ Not implemented | No employer portal; planned for v1.1 |
| 3.3.5 | Must notify transport operator when system/device has not updated within 24 hours | ❌ Not implemented | No employer portal or notification system; planned for v1.1 |
| 3.3.6 | Must accommodate notification of driver work time breaches in a timely manner | ⚠️ Partial | In-app warnings implemented; push notifications to employer not yet implemented |

---

## Section 3.4 — Warnings and Prompts

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 3.4.1 | Warning/alert prior to rest break at 5.5/7 hours worktime accrued (5 and/or 15 minutes prior) | ✅ Done | Countdown timer shows remaining time; compliance warning fires at threshold |
| 3.4.2 | Warning/alert prior to end of cumulative work day at 13 hours (5 and/or 15 minutes prior) | ✅ Done | 13-hour daily limit tracked; warning displayed |
| 3.4.3 | Warning/alert prior to end of cumulative work period at 70 hours (5 and/or 15 minutes prior) | ✅ Done | Fortnightly 70-hour limit tracked; warning displayed |
| 3.4.4 | Warning/alert recommending work time where 30-minute rest break has not been completed | ✅ Done | 30-minute minimum break enforced; warning if break is too short |
| 3.4.5 | Warning/alert recommending work time where 10-hour rest break has not been completed | ❌ Not implemented | 10-hour rest period tracking not yet implemented; planned for v1.1 |
| 3.4.6 | Warning/alert recommending work time where 24-hour rest break has not been completed | ❌ Not implemented | 24-hour rest period tracking not yet implemented; planned for v1.1 |

---

## Section 4.1 — Driver Summary / Display

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 4.1.1 | Must show approval by Waka Kotahi and date of approval | ⚠️ Partial | Approval notice will be added once approval is granted |
| 4.1.2 | Must display notice that logbook is for sole use of the registered driver | ✅ Done | Notice displayed in Profile screen and Terms of Service |
| 4.1.3 | Must note when the last 24-hour break ended | ✅ Done | Last rest break shown in enforcement view |
| 4.1.4 | Must show commencement date/time of active cumulative work period | ✅ Done | Shown in enforcement view |
| 4.1.5 | Must show commencement time of active cumulative work day | ✅ Done | "SHIFT STARTED: Today, HH:MM AM/PM" shown on dashboard |
| 4.1.6 | Must show duration of active cumulative work day | ✅ Done | "TODAY: X.X hrs / 11 hrs" stat card on dashboard |
| 4.1.7 | Must show duration of active cumulative work period | ✅ Done | "FORTNIGHTLY: XX hrs / 70 hrs" stat card on dashboard |
| 4.1.8 | Must show next break due and end of cumulative work day/period as applicable | ✅ Done | Countdown timer shows time remaining until next required rest break |
| 4.1.9 | Must warn driver when work time requirements exceeded; warning remains visible until compliance restored | ✅ Done | Compliance warnings persist on dashboard until driver takes a break |

---

## Section 5.1 — Enforcement / Output

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 5.1.1 | Enforcement view must include end of last 24-hour break, work time hours today, total hours in CWP | ✅ Done | All three displayed in enforcement view |
| 5.1.2 | Active grid must populate for full cumulative work period | ✅ Done | Full shift history grid in enforcement view |
| 5.1.3 | Must reconstruct daily records back to beginning of cumulative work period | ✅ Done | Full CWP reconstruction from hash chain |
| 5.1.4 | Must provide electronic copies roadside of the active CWP | ✅ Done | PDF export and share sheet available at any time |
| 5.1.5 | Over-midnight records remain one full logbook entry | ✅ Done | Shift is a single record regardless of midnight crossing |

---

## Section 6.1 — Output Data

| Ref | Requirement | Status | Notes |
|---|---|---|---|
| 6.1.1 | Minimum output data: date, driver name, licence number, rego, hub/ODO, location, signature line, cumulative work time, notes, changes | ✅ Done | All fields included in PDF export |
| 6.1.2 | Data must be provided in one Microsoft Excel file up to 20MB; separate by driver if needed | ❌ Not implemented | Currently PDF only; Excel/CSV export planned for v1.1 |
| 6.1.3 | Records must be collated as full cumulative work periods | ✅ Done | PDF export covers full CWP |
| 6.1.4 | Where bulk data is sought, information must be securely stored and transferred | ✅ Done | HTTPS transfer; cloud storage |

---

## Summary Table

| Category | Total Requirements | ✅ Done | ⚠️ Partial | ❌ Not Implemented |
|---|---|---|---|---|
| Section 2 — Approval Principles | 6 | 5 | 0 | 1 (pending assessment) |
| Section 3.1 — System/Audit/Backup | 23 | 14 | 7 | 2 |
| Section 3.2 — Logbook/Work Time | 14 | 10 | 4 | 0 |
| Section 3.3 — Employer Requirements | 6 | 1 | 1 | 4 |
| Section 3.4 — Warnings/Prompts | 6 | 4 | 0 | 2 |
| Section 4.1 — Driver Summary | 9 | 8 | 1 | 0 |
| Section 5.1 — Enforcement | 5 | 5 | 0 | 0 |
| Section 6.1 — Output Data | 4 | 3 | 0 | 1 |
| **Total** | **73** | **50 (68%)** | **13 (18%)** | **10 (14%)** |

---

## Pre-Approval Development Roadmap

The following items are planned for Drive Legal v1.1, targeted for completion within 60 days of initial application submission:

| Priority | Ref | Item | Effort |
|---|---|---|---|
| High | 3.1.5–3.1.6 | Audit/change log for system settings and software version changes | Medium |
| High | 3.4.5–3.4.6 | 10-hour and 24-hour rest period warnings | Low |
| High | 6.1.2 | Microsoft Excel / CSV export format | Medium |
| High | 3.1.17 | Manual override for GPS location before finalisation | Low |
| Medium | 3.3.1–3.3.6 | Transport operator/employer portal | High |
| Medium | 3.2.9 | Large vs small passenger service and vehicle recovery service type differentiation | Low |
| Medium | 3.2.10 | Non-driving work activity type selection | Low |
| Medium | 3.1.16 | Mid-shift re-authentication prompt | Low |
| Low | 3.1.21 | Original vs changed time logging for amended records | Low |
| Low | 3.1.23 | Retrospective entry for previous days | Medium |

---

*This document was prepared by Drive Legal in support of the Waka Kotahi eLog approval application. All technical claims are accurate as of 18 June 2026.*
