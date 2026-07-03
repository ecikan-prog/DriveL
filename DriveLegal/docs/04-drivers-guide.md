# Drive Legal — Driver's Guide

## Electronic Logbook User Manual

**Version 1.0 — June 2026**

---

## Welcome to Drive Legal

Drive Legal is an NZTA-compliant electronic logbook application for New Zealand commercial drivers. This guide explains how to use all features of the application to maintain accurate, compliant logbook records.

> **Important:** This logbook is for the sole use of the registered driver. Do not share your login credentials or allow another person to use your logbook account.

---

## 1. Getting Started

### 1.1 Creating Your Account

When you first open Drive Legal, you will be presented with the registration screen. You need to provide the following information:

| Field | What to Enter |
|---|---|
| Full Name | Your full legal name as it appears on your driver licence |
| Email | Your email address (used for login and password recovery) |
| Password | A secure password (minimum 6 characters) |
| Driver Licence Number | Your NZ driver licence number |
| TSL Number | Your Transport Service Licence number |
| TSL Type | Select your licence type (see below) |
| Employer/Company | Your employer or operating company name |
| Vehicle Registration | Your primary vehicle's registration number |

### 1.2 Transport Service Licence Types

Drive Legal supports all four TSL types. Select the one that matches your Transport Service Licence:

| TSL Type | Description | Continuous Driving Limit |
|---|---|---|
| Goods Service | Transporting goods for hire or reward | 5 hours 30 minutes |
| Large Passenger Service | Vehicles with 13+ seats | 5 hours 30 minutes |
| Small Passenger Service | Vehicles with 12 or fewer seats | 5 hours 30 minutes |
| Vehicle Recovery Service | Towing and vehicle recovery | 5 hours 30 minutes |

### 1.3 Logging In

After registration, log in with your email and password. Your logbook data is stored securely on your device and backed up to the cloud.

---

## 2. The Dashboard

The Dashboard is your main screen when using Drive Legal. It shows your current status and key information at a glance.

### 2.1 Status Indicator

At the top of the Dashboard, you will see your current status:

| Status | Colour | Meaning |
|---|---|---|
| **DRIVING** | Green | You are currently recording driving time |
| **ON BREAK** | Amber/Orange | You are currently on a rest break |
| **OFF DUTY** | Grey | No active shift |

### 2.2 The Countdown Timer

The large circular timer in the centre of the Dashboard changes based on your current activity:

**When Driving (Green Ring):**
The timer shows your remaining driving hours before a mandatory rest break is required. The format is `H:MM` (hours and minutes). When you have less than 30 minutes remaining, the ring turns red as a warning.

**When On Break (Orange Ring):**
The timer switches to a 30-minute countdown showing `M:SS` (minutes and seconds) counting down from 30:00 to 0:00. The label reads "BREAK TIME REMAINING". This helps you ensure you take a qualifying 30-minute rest break.

**When Break is Complete (Green Ring):**
Once your 30-minute break is complete, the ring turns green and displays "READY TO RESUME DRIVING" with your remaining available driving hours shown. You can now safely resume driving.

### 2.3 Statistics Cards

Below the timer, three statistics cards show:

| Card | What It Shows |
|---|---|
| Today | Driving hours used today vs. daily limit |
| Weekly | Approximate weekly driving hours vs. 60-hour limit |
| Fortnightly | Cumulative driving hours vs. 70-hour limit |

Each card includes a progress bar that turns amber at 75% and red at 90%.

### 2.4 Compliance Warnings

If you are approaching or exceeding a work time limit, warning banners will appear at the top of the Dashboard. These are colour-coded:

- **Yellow/Amber:** Warning — you are approaching a limit
- **Red:** Critical — you are at or exceeding a limit

You will also receive push notifications for these warnings even if the app is in the background.

---

## 3. Starting and Ending Shifts

### 3.1 Starting a Shift

To start a new shift:

1. Tap the green **"Start Shift"** button on the Dashboard
2. Enter your starting **odometer reading** when prompted
3. Tap **"Start"** to confirm

The system will automatically record the start time and capture your GPS location. Your status will change to "DRIVING" and the countdown timer will begin.

**Rest Period Check:** Before allowing you to start a shift, Drive Legal checks that you have completed the required rest period. If you have not had at least 10 hours of continuous rest since your last shift (or 24 hours for a CWP reset), you will see a warning message. You should not start driving until the required rest period is complete.

### 3.2 Taking a Break

To record a rest break:

1. Tap the **"Break"** button on the shift action screen
2. The timer will switch to the 30-minute break countdown (orange ring)
3. Take your break — the timer counts down automatically
4. When ready to resume, tap **"Resume Driving"**

The system records the exact start and end time of your break. For a break to count as a qualifying rest break under the Rule, it must be at least 30 minutes of continuous rest.

### 3.3 Recording Other Work

If you are performing non-driving work (loading, vehicle inspections, paperwork, etc.):

1. Tap the **"Other Work"** button
2. Optionally enter a note describing the work
3. When finished, tap **"Resume Driving"** or **"Break"**

Other Work time counts toward your total work time but not your driving time.

### 3.4 Changing Vehicles

If you need to switch to a different vehicle during your shift:

1. Tap the **"Change Vehicle"** button on the shift action screen
2. Enter the new vehicle's **registration number**
3. Enter the new vehicle's **odometer reading**
4. Optionally enter a reason for the change
5. Tap **"Confirm Change"**

The vehicle change is recorded with a timestamp. You can change vehicles multiple times during a single shift.

### 3.5 Ending a Shift

To end your shift:

1. Tap the red **"End Shift"** button
2. Enter your ending **odometer reading** when prompted
3. Confirm by tapping **"End Shift"**

The system will record the end time, capture your GPS location, and calculate all totals for the shift. A summary will be displayed showing your driving time, work time, and number of breaks taken.

---

## 4. Viewing Your History

### 4.1 History Tab

The History tab shows all your completed shifts in chronological order (most recent first). Each entry shows:

- Date and day of the week
- Start and end times
- Total driving time
- Number of breaks taken
- Compliance status (green checkmark or red warning)

Tap any entry to view the full shift detail.

### 4.2 Shift Detail View

The shift detail view shows complete information for a completed shift:

- All activity entries with times and durations
- Vehicle information (including any mid-shift changes)
- Odometer readings
- Location data
- Amendment history (if any)

**Locked Shifts:** Completed shifts display a "LOCKED" badge. This means the record cannot be edited directly. If you need to correct an error, you must use the Amendment process (see Section 5).

### 4.3 Activity Grid

The Activity Grid provides a visual 24-hour timeline for each day. It uses colour-coded blocks to show your work/rest pattern at a glance:

| Colour | Meaning |
|---|---|
| Navy | Driving |
| Blue | Other Work |
| Green | Rest Break |
| Grey | Off Duty |

The grid includes hour markers (0, 6, 12, 18, 24) for easy time reference.

### 4.4 Sole Use Notice

At the top of the History screen, you will see a blue notice banner confirming: "This logbook is for the sole use of [YOUR NAME] — Licence [YOUR LICENCE NUMBER]". This is a regulatory requirement.

---

## 5. Amendments

### 5.1 When to Amend

You may need to amend a completed record if you made an error during recording (e.g., forgot to tap "Break" when you actually took a break, or recorded the wrong odometer reading).

### 5.2 How to Amend

1. Navigate to the shift you need to amend (History tab → tap the shift)
2. Tap the **"Request Amendment"** button
3. Select the field you wish to amend
4. Enter the correct value
5. **You must provide a reason** for the amendment (this is mandatory)
6. Tap **"Submit Amendment"**

### 5.3 Amendment Records

All amendments are permanently recorded in your logbook:

- The original value is preserved
- The new value is recorded alongside it
- Your reason for the change is stored
- The amendment is timestamped
- An asterisk (*) is displayed next to amended entries

Enforcement officers can see the full amendment history during inspections.

---

## 6. Exporting Records

### 6.1 PDF Export

To export your records as a PDF:

1. Go to the History tab
2. Select the shift(s) you want to export
3. Tap the **"Export PDF"** option
4. The PDF will be generated including the Activity Grid
5. Share via email, save to files, or print

### 6.2 Excel Export

To export as a password-protected Excel file:

1. Go to the History tab
2. Tap the **"Export"** option
3. Select **"Excel (.xlsx)"**
4. Set a password for the file
5. The protected file will be generated for sharing

---

## 7. Enforcement View

### 7.1 What Is the Enforcement View?

The Enforcement View is a special read-only screen designed for roadside inspections by CVIU officers or Police. It presents your logbook records in a clear format that enforcement officers are trained to read.

### 7.2 How to Access

If asked to present your logbook during a roadside inspection:

1. Open Drive Legal
2. Navigate to the **Enforcement View** (accessible from the main menu)
3. Hand your device to the officer

The Enforcement View shows:

- Your driver identification
- Current day's records
- Previous 14 days of shift history
- Activity Grid for visual pattern assessment
- Any breaches or warnings highlighted
- Amendment history

The officer cannot modify any records from this view — it is strictly read-only.

---

## 8. Compliance Alerts

### 8.1 Warning Types

Drive Legal monitors your work time and provides the following alerts:

| Alert | Trigger | Action Required |
|---|---|---|
| Driving time warning | 15 minutes before continuous driving limit | Plan to stop soon |
| Driving time critical | 5 minutes before continuous driving limit | Stop driving immediately |
| CWP warning | Approaching 70-hour cumulative limit | Plan extended rest |
| Rest period insufficient | Less than 10h rest before new shift | Do not start driving |
| CWP reset required | Less than 24h rest for CWP reset | Take 24-hour rest |

### 8.2 Push Notifications

Compliance warnings are also delivered as push notifications, so you will be alerted even if the app is in the background. Ensure notifications are enabled for Drive Legal in your device settings.

---

## 9. Settings and Profile

### 9.1 Updating Your Details

If your details change (new vehicle, new employer, etc.), update them in the Settings screen. Changes to your profile information take effect for future shifts and do not modify historical records.

### 9.2 Changing Your Vehicle

If you permanently change to a new vehicle, update your default vehicle registration in Settings. For temporary vehicle changes during a shift, use the "Change Vehicle" button instead.

---

## 10. Troubleshooting

| Issue | Solution |
|---|---|
| GPS not working | Ensure location permissions are granted. Use manual location entry if in an area with poor reception. |
| Timer not updating | The app may have been backgrounded. Bring it to the foreground — times are calculated from stored timestamps and will be correct. |
| Cannot start shift | Check if you have completed the required rest period. The app will show you how much rest time remains. |
| Forgot to end shift | End the shift as soon as you remember. The system will record the actual end time. If needed, amend the record with the correct end time. |
| Data not syncing | Check your internet connection. Data will sync automatically when connectivity is restored. |

---

## 11. Legal Requirements

As a commercial driver in New Zealand, you are required to:

1. Maintain accurate logbook records for every working day
2. Record all driving time, other work time, and rest breaks
3. Take a minimum 30-minute break after 5.5 hours of continuous driving
4. Not exceed 13 hours of work in any cumulative work day
5. Take a minimum 10-hour continuous rest between work periods
6. Not exceed 70 hours of work in any cumulative work period
7. Present your logbook for inspection when requested by an enforcement officer
8. Retain records for a minimum of 12 months

Drive Legal helps you comply with all of these requirements, but it is ultimately your responsibility as the driver to ensure compliance.

---

## Support

If you need help with Drive Legal:

- **Email:** support@drivelegal.app
- **Response Time:** Within 24 hours

---

*Drive Legal — Keeping New Zealand's commercial drivers compliant and safe.*
