import React from "react";

import {
  LegalPageLayout,
  LegalSection,
} from "@/components/legal-page-layout";

export default function PrivacyPolicyScreen() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="Protecting Your Privacy"
      lastUpdated="14 June 2026"
      icon="shield"
      summaryPoints={[
        {
          icon: "person-outline",
          text: "Information we collect",
        },
        {
          icon: "security",
          text: "How your data is protected",
        },
        {
          icon: "storage",
          text: "Data storage and retention",
        },
        {
          icon: "verified-user",
          text: "Your privacy rights",
        },
        {
          icon: "mail-outline",
          text: "Contact information",
        },
      ]}
    >
      <LegalSection number={1} title="Introduction">
        Drive Legal ("we", "us", "our") is committed to protecting the privacy
        of our users ("you", "driver"). This Privacy Policy explains how we
        collect, use, store, and share your personal information in compliance
        with the New Zealand Privacy Act 2020 and the Information Privacy
        Principles (IPPs).
      </LegalSection>

      <LegalSection number={2} title="Information We Collect">
        We collect the following personal information when you register and use
        Drive Legal:{"\n\n"}
        • Full name{"\n"}
        • Email address{"\n"}
        • NZ driver licence number{"\n"}
        • Vehicle registration number{"\n"}
        • Vehicle type{"\n"}
        • Shift start/end times and dates{"\n"}
        • Break start/end times and durations{"\n"}
        • Cumulative driving and work hours{"\n"}
        • Device information (for app functionality only)
      </LegalSection>

      <LegalSection number={3} title="Purpose of Collection">
        Your information is collected for the following purposes:{"\n\n"}
        • To maintain an electronic driver logbook designed to meet NZTA work
        time requirements{"\n"}
        • To calculate and enforce work time limits under the Land Transport
        Rule: Work Time and Logbooks 2007{"\n"}
        • To generate work time reports for enforcement agencies{"\n"}
        • To provide fatigue management warnings and alerts{"\n"}
        • To enable you to export records for your employer (TSL holder){"\n"}
        • To manage your subscription and account
      </LegalSection>

      <LegalSection number={4} title="Data Storage and Security">
        Your logbook data is stored locally on your device using encrypted
        storage. We implement the following security measures:{"\n\n"}
        • SHA-256 hash chain verification on all completed shift records to
        detect tampering{"\n"}
        • Immutable log entries — once a shift is ended, it cannot be edited or
        deleted{"\n"}
        • Local device encryption via the operating system's secure storage
        {"\n"}
        • No third-party access to your raw logbook data without your explicit
        consent{"\n\n"}
        Data is retained on your device for a minimum of 12 months as required
        by the Land Transport Rule: Work Time and Logbooks 2007. We recommend
        retaining records for 6 years to comply with employment law
        requirements.
      </LegalSection>

      <LegalSection number={5} title="Who Can Access Your Data">
        Your logbook data may be accessed by:{"\n\n"}
        • You (the driver) — full access at all times{"\n"}
        • NZ Transport Agency enforcement officers — upon request during
        roadside inspections, you are required to present your logbook records
        {"\n"}
        • NZ Police — as part of a lawful enforcement action{"\n"}
        • Your employer / TSL holder — you are required to supply copies within
        14 days of recording a shift{"\n\n"}
        We do not sell, rent, or share your personal information with any third
        parties for marketing or commercial purposes.
      </LegalSection>

      <LegalSection number={6} title="Data Retention">
        • Active logbook records: Retained indefinitely on your device while
        the app is installed{"\n"}
        • Minimum retention: 12 months from the date of each shift entry (NZTA
        requirement){"\n"}
        • Recommended retention: 6 years (employment law best practice){"\n"}
        • Account deletion: You may request deletion of your account and all
        associated data by contacting us at support@drivelegal.app. We will
        process deletion requests within 20 working days as required by the
        Privacy Act 2020.
      </LegalSection>

      <LegalSection
        number={7}
        title="Your Rights Under the Privacy Act 2020"
      >
        Under the New Zealand Privacy Act 2020, you have the right to:{"\n\n"}
        • Access your personal information held by us{"\n"}
        • Request correction of inaccurate information{"\n"}
        • Request deletion of your personal information (subject to legal
        retention requirements){"\n"}
        • Complain to the Office of the Privacy Commissioner if you believe
        your privacy has been breached{"\n\n"}
        To exercise these rights, contact us at support@drivelegal.app.
      </LegalSection>

      <LegalSection number={8} title="Third-Party Services">
        Drive Legal uses the following third-party services:{"\n\n"}
        • Stripe — for subscription payment processing (Stripe's privacy policy
        applies to payment data){"\n"}
        • Apple App Store / Google Play Store — for app distribution{"\n\n"}
        We do not use analytics tracking, advertising networks, or social media
        trackers.
      </LegalSection>

      <LegalSection number={9} title="Changes to This Policy">
        We may update this Privacy Policy from time to time. We will notify you
        of any material changes via in-app notification or email. Continued use
        of Drive Legal after changes constitutes acceptance of the updated
        policy.
      </LegalSection>

      <LegalSection number={10} title="Drive Legal Support">
  If you have questions about this Privacy Policy or your personal information:

  {"\n\n"}

  Drive Legal (Guided NZ Rentals)
  {"\n"}
  2/27 Glenda Drive
  {"\n"}
  Frankton
  {"\n"}
  Queenstown 9300
  {"\n\n"}

  Email: support@drivelegal.app
  {"\n"}
  WhatsApp Support: +64 27 705 0258
</LegalSection>
          </LegalPageLayout>
  );
}
