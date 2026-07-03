# Cover Email

---

**To:** DriverandOperator@nzta.govt.nz

**CC:** Donna.Ashby@nzta.govt.nz

**Subject:** Electronic Logbook Approval Application — Drive Legal (formerly RoadLog)

---

Dear Waka Kotahi Electronic Logbook Assessment Team,

I am writing to submit a formal application for approval of **Drive Legal** as an electronic logbook system under the Land Transport Rule: Work Time and Logbooks 2007, Rule 62001.

## Rebrand Notice

Drive Legal was previously submitted under the name **RoadLog**. The application has been rebranded to better reflect our focus on NZTA compliance for New Zealand commercial drivers. The underlying system, architecture, and compliance features remain consistent with our prior communications, with significant enhancements detailed below.

## System Overview

Drive Legal is a mobile application (iOS and Android) that provides a fully compliant electronic logbook for commercial transport operators in New Zealand. The system is designed to meet or exceed all requirements of the Waka Kotahi Electronic Logbook Minimum Specifications (September 2022).

## Key Features

The following features have been implemented in Drive Legal:

1. **Full TSL Type Support** — Goods Service, Large Passenger Service, Small Passenger Service, and Vehicle Recovery Service, each with appropriate work time limits as defined in the Land Transport Rule.

2. **SHA-256 Hash Chain Integrity** — All logbook entries are cryptographically chained using SHA-256 hashing, providing tamper-evident audit trails that satisfy Section 3.4 requirements.

3. **GPS Auto-Capture with Manual Override** — Automatic location recording at shift start/end and activity changes, with manual override capability for areas with poor reception.

4. **Activity Grid (Visual Timeline)** — A 24-hour visual timeline displaying driving, other work, rest breaks, and off-duty periods for each day, viewable in-app and in PDF exports.

5. **Operator/Employer Portal** — A web-based read-only dashboard where operators/employers can view their drivers' shift records, activity grids, and breach/warning alerts.

6. **Rest Period Validation** — Automated enforcement of 10-hour daily rest and 24-hour Cumulative Work Period reset requirements before allowing new shift commencement.

7. **Vehicle Change Mid-Shift** — Support for multiple vehicles per working day with recorded registration, odometer, and timestamp for each change.

8. **Hard Lock on Completed Shifts** — Completed shifts become read-only with amendments only possible through a formal process requiring mandatory reason documentation.

9. **Amendment Audit Trail** — All amendments are recorded with asterisk notation, original values preserved, reason for change, and timestamp — fully visible to enforcement officers.

10. **Excel Export with Password Protection** — Exportable logbook data in password-protected Excel format for secure record keeping.

11. **PDF Export with Activity Grid** — Comprehensive PDF reports including the visual Activity Grid timeline for enforcement and record-keeping purposes.

12. **Cloud Sync Backup** — Encrypted cloud synchronisation ensuring records are preserved and recoverable.

13. **70-Hour CWP Warning System** — Progressive warnings at 15 minutes and 5 minutes before Cumulative Work Period limits are reached.

14. **30-Minute Break Countdown Timer** — Visual countdown timer during rest breaks showing remaining break time with clear "Ready to Resume" indication upon completion.

15. **Sole Use Notice** — Visible notice on the logbook screen stating "This logbook is for the sole use of the registered driver" per specification 4.1.2.

16. **Other Work Activity Type** — Separate tracking of non-driving work activities as required by the Rule.

17. **Enforcement View** — Dedicated read-only view for roadside inspections by CVIU/Police officers, accessible without driver credentials.

## Demo Access for Testing

We have prepared test accounts for your assessment team:

| Access Type | Credentials |
|---|---|
| **Driver App** | Username: `NZTA` / Licence: `ZY987654` / Password: `NZTAReview2026!` |
| **Operator Portal** | Email: `operator@drivelegal.app` / Password: `DriveLegal2026` |
| **Portal URL** | `https://guidedlogbook-6i7vyx5h.manus.space/portal/login` |

The mobile application is available for testing via Expo Go (QR code provided in the attached documentation) or can be installed directly once App Store/Google Play listings are confirmed.

## Enclosed Documents

The following documents are attached to this submission:

1. Completed Electronic Logbook Application Form
2. Compliance Specification / Technical Report (mapping all features against the Minimum Specifications)
3. Driver's Guide (user manual)
4. Enforcement Officer Guide (roadside inspection procedures)

## After-Sales Support

Ongoing technical support is available via:

- **Email:** support@drivelegal.app
- **Response Time:** Within 24 hours for standard queries, 4 hours for critical issues
- **Updates:** Regular application updates to maintain compliance with any Rule amendments

## Next Steps

We would appreciate guidance on:

1. Whether any additional documentation or demonstrations are required
2. The expected timeline for the assessment process
3. Whether an in-person or video demonstration would be beneficial
4. Any specific test scenarios you would like us to prepare

We are committed to full compliance with the Waka Kotahi Electronic Logbook Minimum Specifications and welcome any feedback or requests for clarification.

Thank you for your consideration. We look forward to hearing from you.

Kind regards,

[YOUR NAME]
[YOUR POSITION]
Drive Legal
support@drivelegal.app

---

*Enclosures: Application Form, Compliance Technical Report, Driver's Guide, Enforcement Officer Guide*
