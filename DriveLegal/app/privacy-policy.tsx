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
      lastUpdated="29 July 2026"
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
      <LegalSection number={1} title="About Drive Legal">
        Drive Legal is a New Zealand-based digital service operated under the
        Drive Legal name. In this Privacy Policy, “Drive Legal”, “we”, “us” and
        “our” refer to the operator of the Drive Legal service.
        {"\n\n"}
        This Privacy Policy explains how we collect, use, store, disclose and
        protect personal information when you use the Drive Legal website,
        mobile application and related services.
      </LegalSection>

      <LegalSection number={2} title="Information We Collect">
        We may collect information you provide when creating or managing an
        account, including your name, email address, telephone number, driver
        licence details, driver type, transport operator details and account
        credentials.
        {"\n\n"}
        We may collect vehicle information, vehicle registration numbers,
        odometer readings, work-time records, driving periods, other-work
        periods, rest periods, shift information, amendments, amendment
        reasons, notes, timestamps, reports, exports and other records
        generated through your use of Drive Legal.
        {"\n\n"}
        We may also collect technical information such as device type,
        operating system, application version, IP address, diagnostic
        information, error reports, login activity and security events.
      </LegalSection>

      <LegalSection number={3} title="Location Information">
        Drive Legal may collect location information when relevant work-time,
        shift or logbook features are being used and location permission has
        been granted on the device.
        {"\n\n"}
        Location information may be used to support record accuracy,
        auditability, security, shift records and compliance-related
        functionality.
        {"\n\n"}
        You can manage location permissions through your device settings.
        Disabling location access may prevent some Drive Legal features from
        working correctly.
      </LegalSection>

      <LegalSection number={4} title="How We Use Your Information">
        We may use personal information to provide, maintain and secure Drive
        Legal, authenticate users, manage accounts, record work time, generate
        reports and exports, display reminders and compliance indicators,
        administer subscriptions and respond to customer-support requests.
        {"\n\n"}
        We may also use information to investigate errors, maintain audit
        trails, prevent fraud or misuse, improve reliability, enforce our Terms
        of Service, comply with legal or regulatory obligations and protect the
        rights, safety and security of Drive Legal, its users and the public.
      </LegalSection>

      <LegalSection number={5} title="Sharing and Disclosure">
        We do not sell personal information.
        {"\n\n"}
        We may share personal information with trusted service providers that
        help us operate Drive Legal, including hosting, database,
        authentication, email, security, analytics, payment, subscription and
        technical-support providers.
        {"\n\n"}
        Information may be shared with an authorised transport operator
        connected to your account where you have authorised that connection or
        where the disclosure is otherwise permitted by law.
        {"\n\n"}
        We may disclose information where required or permitted by law, in
        response to a lawful request, to investigate suspected fraud or misuse,
        or where reasonably necessary to protect users, the public or the
        security and integrity of Drive Legal.
      </LegalSection>

      <LegalSection number={6} title="Overseas Storage and Processing">
        Personal information may be stored or processed by trusted cloud and
        technology service providers located in New Zealand or overseas.
        {"\n\n"}
        Where personal information is disclosed outside New Zealand, we take
        reasonable steps to ensure that it is protected by safeguards that are
        appropriate under applicable New Zealand privacy law.
      </LegalSection>

      <LegalSection number={7} title="Storage and Security">
        We use reasonable technical and organisational safeguards designed to
        protect personal information against unauthorised access, disclosure,
        alteration, loss, misuse or destruction.
        {"\n\n"}
        These safeguards may include authentication controls, access
        restrictions, secure communications, audit information and
        infrastructure security measures.
        {"\n\n"}
        No electronic transmission or storage method can be guaranteed to be
        completely secure. You are also responsible for protecting your
        password, PIN, device and account access.
      </LegalSection>

      <LegalSection number={8} title="Record Retention">
        We retain personal information and work-time records for as long as
        reasonably necessary to provide Drive Legal, maintain account and
        record integrity, resolve disputes and meet legal, regulatory,
        security, fraud-prevention and audit requirements.
        {"\n\n"}
        Drive Legal is designed to keep work-time and logbook records available
        for at least 12 months, reflecting the standard retention period
        applying to relevant driver logbook records under New Zealand land
        transport requirements.
        {"\n\n"}
        Some records may be retained after an account is closed where retention
        is required or permitted by law or reasonably necessary for regulatory,
        security, audit, fraud-prevention or dispute-resolution purposes.
      </LegalSection>

      <LegalSection number={9} title="Account Deletion and Closure">
        You may initiate deletion of your Drive Legal account through the
        account-deletion option available within the mobile application.
        {"\n\n"}
        You may also contact support@drivelegal.app for assistance with an
        account-deletion request.
        {"\n\n"}
        Cancelling a subscription or deleting the Drive Legal application from
        a device does not automatically delete your Drive Legal account or
        stored information.
        {"\n\n"}
        After any necessary identity verification, an account-deletion request
        will be completed within 14 days, except where additional time is
        reasonably required by law or where certain information must be
        retained for legal, regulatory, security, fraud-prevention, audit or
        dispute-resolution purposes.
        {"\n\n"}
        Account deletion may permanently remove access to stored records,
        reports, exports and related services. You should download any records
        you require before requesting deletion.
      </LegalSection>

      <LegalSection number={10} title="Access and Correction">
        You may request access to personal information we hold about you or ask
        us to correct information that is inaccurate or incomplete.
        {"\n\n"}
        We may need to verify your identity before responding to an access or
        correction request.
      </LegalSection>

      <LegalSection number={11} title="Children’s Privacy">
        Drive Legal is intended for commercial drivers and authorised
        transport-industry users. It is not directed to children.
        {"\n\n"}
        We do not knowingly collect personal information from children who are
        not legally permitted to use the service.
      </LegalSection>

      <LegalSection number={12} title="Changes to This Privacy Policy">
        We may update this Privacy Policy from time to time. The current version
        and its latest update date will be published on this page.
        {"\n\n"}
        Where appropriate, we may also notify users of significant changes
        through the application or by another reasonable method.
      </LegalSection>

      <LegalSection number={13} title="Privacy Questions and Complaints">
        You may contact us about a privacy question, access request, correction
        request, account-deletion request or complaint.
        {"\n\n"}
        You may also have the right to make a complaint to the New Zealand
        Office of the Privacy Commissioner.
      </LegalSection>

      <LegalSection number={14} title="Contact Us">
        Privacy enquiries and account-deletion requests can be sent to:
        {"\n\n"}
        Drive Legal
        {"\n"}
        Queenstown, New Zealand
        {"\n"}
        Email: support@drivelegal.app
      </LegalSection>
    </LegalPageLayout>
  );
}
