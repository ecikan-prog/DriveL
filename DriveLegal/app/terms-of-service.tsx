import React from "react";

import {
  LegalPageLayout,
  LegalSection,
} from "@/components/legal-page-layout";

export default function TermsOfServiceScreen() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="Using Drive Legal"
      lastUpdated="14 June 2026"
      icon="description"
      summaryPoints={[
        {
          icon: "check-circle-outline",
          text: "Acceptance of these terms",
        },
        {
          icon: "assignment-outlined",
          text: "Your responsibilities",
        },
        {
          icon: "payment",
          text: "Subscriptions and payments",
        },
        {
          icon: "verified-user",
          text: "Record integrity and security",
        },
        {
          icon: "gavel",
          text: "New Zealand governing law",
        },
      ]}
    >
      <LegalSection number={1} title="Acceptance of Terms">
        By downloading, installing, or using Drive Legal ("the App"), you agree
        to be bound by these Terms of Service ("Terms"). If you do not agree to
        these Terms, do not use the App. Drive Legal is operated by Guided NZ
        Rentals ("we", "us", "our"), registered in Queenstown, New Zealand.
      </LegalSection>

      <LegalSection number={2} title="Service Description">
        Drive Legal is an electronic driver logbook application designed to
        help commercial drivers in New Zealand record their work time, driving
        time, and rest periods in compliance with the Land Transport Rule: Work
        Time and Logbooks 2007. The App provides:{"\n\n"}
        • Shift and break time recording{"\n"}
        • Real-time compliance monitoring and fatigue warnings{"\n"}
        • Historical log storage and retrieval{"\n"}
        • PDF and CSV export for enforcement and employer reporting{"\n"}
        • Tamper-evident record keeping with hash verification
      </LegalSection>

      <LegalSection number={3} title="User Responsibilities">
        As a user of Drive Legal, you are responsible for:{"\n\n"}
        • Providing accurate personal information during registration{"\n"}
        • Recording all work time, driving time, and rest periods truthfully and
        completely{"\n"}
        • Starting and ending shifts at the correct times{"\n"}
        • Presenting your logbook records to enforcement officers when requested
        {"\n"}
        • Supplying copies of your logbook to your TSL holder within the
        required timeframe{"\n"}
        • Maintaining your device in working order to preserve logbook records
        {"\n"}
        • Complying with all applicable New Zealand transport laws and
        regulations{"\n\n"}
        Drive Legal is a recording and compliance-support tool. It does not
        replace your legal obligation to comply with work-time rules. You remain
        responsible for ensuring your driving and work hours comply with the
        law.
      </LegalSection>

      <LegalSection number={4} title="Subscription and Payment">
        Drive Legal may offer a free trial. The current trial duration,
        subscription options, prices, renewal period, and applicable taxes will
        be displayed before you confirm a subscription.{"\n\n"}
        Subscriptions purchased through an app store are billed through the
        payment method connected to your store account and are managed under
        that store&apos;s subscription rules. Other authorised payment methods
        may be offered where permitted.{"\n\n"}
        Unless cancelled before renewal, subscriptions may renew automatically.
        You can manage or cancel an app-store subscription through your Apple
        App Store or Google Play account settings.{"\n\n"}
        Even if your subscription ends, existing logbook records will remain
        accessible and exportable where required for compliance and legal
        record-retention purposes.
      </LegalSection>

      <LegalSection number={5} title="Data Integrity and Immutability">
        To support record integrity and compliance requirements:{"\n\n"}
        • Completed shift records are protected against unauthorised alteration
        {"\n"}
        • Records may use SHA-256 cryptographic hash-chain verification{"\n"}
        • Detected integrity problems may be flagged within the App or exported
        report{"\n"}
        • Exported records may include verification information for
        authenticity{"\n\n"}
        These measures are intended to improve the reliability and
        trustworthiness of electronic logbook records.
      </LegalSection>

      <LegalSection number={6} title="Limitation of Liability">
        To the maximum extent permitted by New Zealand law:{"\n\n"}
        • Drive Legal is provided on an "as available" basis{"\n"}
        • We do not guarantee uninterrupted or error-free operation{"\n"}
        • We are not responsible for fines, penalties, or legal consequences
        arising from inaccurate entries or failure to comply with work-time
        rules{"\n"}
        • We are not responsible for data loss caused by device failure, theft,
        damage, unauthorised access, or failure to maintain appropriate backups
        {"\n"}
        • Where legally permitted, our total liability is limited to the amount
        you paid for Drive Legal during the preceding 12 months{"\n\n"}
        Nothing in these Terms excludes rights or remedies that cannot legally
        be excluded, including applicable rights under the Consumer Guarantees
        Act 1993.
      </LegalSection>

      <LegalSection number={7} title="Regulatory Approval Status">
        Drive Legal is designed to support compliance with New Zealand
        work-time and logbook requirements. Any regulatory approval or
        recognition status applicable to the App will be displayed within the
        App or in official Drive Legal documentation.{"\n\n"}
        You should verify the current approval status before relying on Drive
        Legal as your sole legally required logbook.
      </LegalSection>

      <LegalSection number={8} title="Account Suspension or Termination">
        We may suspend or terminate an account where:{"\n\n"}
        • These Terms are materially breached{"\n"}
        • The App is used for unlawful or fraudulent purposes{"\n"}
        • A user attempts to tamper with records or circumvent integrity
        controls{"\n"}
        • Suspension is reasonably necessary to protect the App, its users, or
        stored information{"\n\n"}
        Where legally required, users will be given a reasonable opportunity to
        access or export existing compliance records.
      </LegalSection>

      <LegalSection number={9} title="Intellectual Property">
        All intellectual property associated with Drive Legal, including its
        software, design, branding, content, and documentation, is owned by or
        licensed to Guided NZ Rentals.{"\n\n"}
        You are granted a limited, personal, non-exclusive, non-transferable,
        and revocable licence to use the App for its intended purpose.
      </LegalSection>

      <LegalSection number={10} title="Governing Law">
        These Terms are governed by the laws of New Zealand. Any dispute arising
        from these Terms or your use of the App will be subject to the
        jurisdiction of the New Zealand courts, except where applicable law
        provides otherwise.
      </LegalSection>

      <LegalSection number={11} title="Changes to These Terms">
        We may update these Terms from time to time. Where a change is material,
        we will provide reasonable notice through the App, by email, or by
        another appropriate method.{"\n\n"}
        Continued use of Drive Legal after updated Terms take effect constitutes
        acceptance of those updated Terms.
      </LegalSection>

      <LegalSection number={12} title="Drive Legal Support">
        For questions about these Terms or the Drive Legal service:{"\n\n"}
        Drive Legal (Guided NZ Rentals){"\n"}
        2/27 Glenda Drive{"\n"}
        Frankton{"\n"}
        Queenstown 9300{"\n"}
        New Zealand{"\n\n"}
        Email: support@drivelegal.app{"\n"}
        WhatsApp Support: +64 27 705 0258
      </LegalSection>
    </LegalPageLayout>
  );
}
