# NZTA eLog Application — Submission Email

**To:** DriverandOperator@nzta.govt.nz
**CC:** Donna.Ashby@nzta.govt.nz
**Subject:** Drive Legal eLog Application — Electronic Logbook Approval (formerly RoadLog)
**From:** [YOUR NAME] <support@drivelegal.app>

---

Kia ora Donna,

Thank you for your prompt response and for providing the minimum specifications and application form. Please find our completed application package attached.

We are applying for approval of **Drive Legal** (formerly submitted as RoadLog) as an alternative means of recording matters relevant to the monitoring of work time under section 30ZG of the Land Transport Act 1998. Since our initial correspondence, we have rebranded the product to Drive Legal and have made significant technical enhancements including GPS location capture, odometer input, driver-type selection (Goods Service / Passenger Service), cloud synchronisation with SHA-256 hash chain integrity, and a dedicated enforcement view with PDF export.

---

## System Access for Testing

The following credentials provide permanent, no-cost access to the Drive Legal eLog system for Waka Kotahi approvers. This access will remain available indefinitely.

| Field | Value |
|---|---|
| **App URL** | https://app.drivelegal.app |
| **User Name (Driver)** | nzta.demo@roadlog.nz |
| **Password** | NZTAReview2026! |
| **Transport Operator Access** | Same credentials as above |

The demo account is pre-loaded with **ten sample shifts** across a two-week period in the Queenstown region, including GPS start/end locations, odometer readings, rest breaks, and compliance events. This provides a realistic populated logbook for assessment without requiring any data entry. Simply log in and the data is ready to review.

---

## Attached Documents

1. **NZTA_Application_Form_Completed.pdf** — Completed application form (Sections 1–5)
2. **NZTA_Compliance_Specification_v2.pdf** — Completed Waka Kotahi Minimum Specifications self-assessment
3. **NZTA_Gap_Analysis_v2.pdf** — Detailed gap analysis against all 73 specification requirements
4. **Drivers_Guide.pdf** — User documentation for drivers

The application form includes our compliance narrative addressing the five requirements specified in Clause 3.4(3) of the Rule: data collected, data transfer and integrity, driver identification, tamper prevention, and enforcement officer access.

---

## Key Technical Points

**Data integrity:** Drive Legal implements a SHA-256 cryptographic hash chain. Every completed shift record is hashed and chained to the previous record. Any alteration to any historical record breaks the chain, which is immediately visible in the enforcement view and PDF exports.

**Enforcement access:** The enforcement view and PDF export include all required fields: driver name and licence number, vehicle registration, odometer readings, GPS locations (suburb/city), shift start/end times, rest breaks, cumulative daily and fortnightly hours, and hash chain verification status. PDFs can be shared by email at the roadside in under 30 seconds.

**Cloud sync:** Completed shifts are automatically pushed to a secure cloud database (MySQL/TiDB) over HTTPS. Drivers can log in from any device and pull their full shift history. Data is retained indefinitely.

**Platform:** Drive Legal is a web-based Progressive Web App accessible at https://app.drivelegal.app on any iOS or Android device. Native app submissions to the Apple App Store and Google Play Store are in progress.

---

## Gap Analysis Summary

Of the 73 individual requirements in the minimum specifications, **50 are fully implemented (68%)**, **13 are partially implemented (18%)**, and **10 are not yet implemented (14%)**. The unimplemented items are primarily the transport operator/employer portal (sections 3.3.x), the audit/change log for system settings (3.1.5–3.1.6), the 10-hour and 24-hour rest break warnings (3.4.5–3.4.6), and the Microsoft Excel export format (6.1.2). These are all planned for Drive Legal v1.1 within 60 days of application submission.

---

Please do not hesitate to contact us at support@drivelegal.app if you require any additional information or if you would like to arrange a demonstration of the system.

Ngā mihi,

**[YOUR FULL NAME — TO BE COMPLETED]**
Drive Legal — Driver Compliance
support@drivelegal.app
https://app.drivelegal.app
[YOUR NZ PHONE NUMBER — TO BE COMPLETED]

---

*Items in [brackets] require your personal details before sending.*
