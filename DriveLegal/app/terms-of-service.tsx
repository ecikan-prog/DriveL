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
      lastUpdated="29 July 2026"
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
        These Terms of Service are between you and the operator of the Drive
        Legal service, trading under the name Drive Legal.
        {"\n\n"}
        In these Terms, “Drive Legal”, “we”, “us” and “our” refer to the operator
        of the Drive Legal service.
        {"\n\n"}
        These Terms govern your use of the Drive Legal website, mobile
        application and related services. By creating an account, purchasing a
        subscription or using Drive Legal, you agree to these Terms.
        {"\n\n"}
        If you do not agree to these Terms, you must not create an account or
        use the service.
      </LegalSection>

      <LegalSection number={2} title="The Drive Legal Service">
        Drive Legal provides digital tools intended to assist New Zealand
        commercial drivers and authorised transport operators with recording
        work time, driving periods, other work, rest periods, vehicle
        information, odometer readings, amendments and related logbook
        information.
        {"\n\n"}
        Drive Legal may also provide countdowns, reminders, warnings, compliance
        indicators, reports, exports, audit information, record-integrity
        features and other supporting functionality.
      </LegalSection>

      <LegalSection number={3} title="Driver and Operator Responsibilities">
        Drive Legal is a record-keeping and assistance tool. It does not replace
        the legal responsibilities of a driver, transport operator, licence
        holder, employer or other responsible person.
        {"\n\n"}
        You remain responsible for understanding and complying with all laws,
        rules, licence conditions, exemptions and contractual obligations that
        apply to your driving, work time, rest time, logbook records and
        transport activities.
        {"\n\n"}
        You are responsible for ensuring that information entered into Drive
        Legal is accurate, complete and entered at the appropriate time.
        {"\n\n"}
        You must not rely solely on alerts, countdowns, reminders, warnings,
        compliance indicators or calculations displayed by Drive Legal when
        deciding whether you are legally permitted or safe to continue working
        or driving.
        {"\n\n"}
        You must stop driving or working whenever required by law, fatigue,
        safety conditions or your own judgement, regardless of any information
        displayed by Drive Legal.
      </LegalSection>

      <LegalSection number={4} title="No NZTA Approval or Endorsement">
        Drive Legal is not represented as being operated, approved, certified or
        endorsed by Waka Kotahi New Zealand Transport Agency or any other
        government authority unless expressly confirmed in writing.
        {"\n\n"}
        References to New Zealand transport or work-time requirements are
        provided for general assistance and do not constitute legal, regulatory,
        employment, safety or professional advice.
      </LegalSection>

      <LegalSection number={5} title="Eligibility and Account Registration">
        You must be legally capable of entering into these Terms and legally
        permitted to use Drive Legal for your intended purpose.
        {"\n\n"}
        You must provide accurate, current and complete information when
        creating and maintaining your account.
        {"\n\n"}
        You must not create an account using false information or impersonate
        another person.
      </LegalSection>

      <LegalSection number={6} title="Account Security">
        You are responsible for protecting your password, PIN, device and
        account access.
        {"\n\n"}
        You must not share your account with another driver or use another
        person’s account to create or alter work-time records.
        {"\n\n"}
        You must promptly notify us if you believe your account or device has
        been accessed or used without authorisation.
      </LegalSection>

      <LegalSection number={7} title="Records, Amendments and Accuracy">
        You are responsible for reviewing your records and correcting errors as
        soon as reasonably practicable through the available amendment process.
        {"\n\n"}
        Drive Legal may preserve original entries, amendments, timestamps,
        amendment reasons, user details, device information and other audit data
        to support record integrity, accountability and lawful record keeping.
        {"\n\n"}
        You must not falsify, manipulate, conceal, destroy or intentionally
        enter misleading work-time, vehicle, odometer, rest or other records.
      </LegalSection>

      <LegalSection number={8} title="Operator Access">
        Where you connect your account to an authorised transport operator, that
        operator may be able to access records and account information made
        available through Drive Legal.
        {"\n\n"}
        You are responsible for ensuring that any operator connection is
        appropriate and authorised.
        {"\n\n"}
        An operator’s access to Drive Legal does not transfer your legal
        responsibilities to Drive Legal.
      </LegalSection>

      <LegalSection number={9} title="Free Trial and Subscription">
        Drive Legal may offer a 21-day free trial followed by an annual
        auto-renewable subscription.
        {"\n\n"}
        The applicable subscription price, trial conditions and billing period
        will be displayed in the application and App Store before purchase. The
        intended annual price at the date of these Terms is NZ$64.99.
        {"\n\n"}
        Prices and subscription availability may change. Any applicable price
        will be shown before you confirm a purchase or renewal.
        {"\n\n"}
        Payment, renewal, billing, cancellation and refund processing for an
        Apple subscription are managed through your Apple Account and are
        subject to Apple’s applicable terms and policies.
        {"\n\n"}
        A subscription may automatically renew unless cancelled through the
        relevant App Store subscription settings before the renewal date.
        {"\n\n"}
        Cancelling a subscription prevents future renewal but does not
        automatically delete your Drive Legal account or stored records.
      </LegalSection>

      <LegalSection number={10} title="Account Deletion">
        You may initiate deletion of your Drive Legal account through the
        account-deletion option available within the mobile application.
        {"\n\n"}
        You may also contact support@drivelegal.app for assistance.
        {"\n\n"}
        Deleting the application from a device or cancelling a subscription does
        not automatically delete your account.
        {"\n\n"}
        After any necessary identity verification, an account-deletion request
        will be completed within 14 days, except where additional time is
        reasonably required by law or where certain records must be retained for
        legal, regulatory, security, fraud-prevention, audit or
        dispute-resolution purposes.
        {"\n\n"}
        You should download any records you require before requesting account
        deletion.
      </LegalSection>

      <LegalSection number={11} title="Acceptable Use">
        You must not use Drive Legal to break the law, falsify records,
        misrepresent work-time information, impersonate another person, gain
        unauthorised access, interfere with the service, bypass security
        controls, distribute harmful software or infringe another person’s
        rights.
        {"\n\n"}
        You must not attempt to reverse engineer, copy, scrape, reproduce or
        exploit Drive Legal except where expressly permitted by law.
      </LegalSection>

      <LegalSection number={12} title="Intellectual Property">
        Drive Legal and its software, designs, branding, text, graphics,
        databases and other materials are protected by applicable
        intellectual-property laws.
        {"\n\n"}
        Subject to these Terms, you are granted a limited, non-exclusive,
        non-transferable and revocable right to use Drive Legal for its intended
        purpose.
      </LegalSection>

      <LegalSection number={13} title="Availability and Changes">
        We aim to provide a reliable service, but we do not guarantee that Drive
        Legal will always be available, uninterrupted, error-free, secure or
        compatible with every device or network.
        {"\n\n"}
        We may update, suspend, replace or discontinue features where reasonably
        necessary for security, maintenance, regulatory, legal, technical or
        commercial reasons.
        {"\n\n"}
        You remain responsible for keeping any legally required records and
        downloading or exporting records where appropriate.
      </LegalSection>

      <LegalSection number={14} title="Third-Party Services">
        Drive Legal may rely on or link to third-party services, including
        hosting, authentication, email, mapping, device, payment and App Store
        services.
        {"\n\n"}
        Third-party services may be governed by their own terms and privacy
        policies. We are not responsible for third-party services outside our
        reasonable control.
      </LegalSection>

      <LegalSection number={15} title="Privacy">
        Our collection, storage, use and disclosure of personal information are
        described in our Privacy Policy.
      </LegalSection>

      <LegalSection number={16} title="Disclaimers">
        To the extent permitted by law, Drive Legal is provided on an “as
        available” basis.
        {"\n\n"}
        We do not guarantee that calculations, reminders, warnings, compliance
        indicators or exported records will identify every legal obligation,
        exemption, error, fatigue risk or compliance issue.
        {"\n\n"}
        You remain responsible for checking your records and complying with all
        applicable requirements.
      </LegalSection>

      <LegalSection number={17} title="Limitation of Liability">
        To the maximum extent permitted by law, Drive Legal and its contractors
        and service providers will not be liable for indirect, incidental,
        special, consequential or economic loss arising from the use of or
        inability to use the service.
        {"\n\n"}
        This may include loss arising from inaccurate user entries, missed or
        delayed alerts, device failure, internet interruption, unauthorised
        account use, service unavailability, incomplete exports or a user’s
        failure to comply with legal obligations.
        {"\n\n"}
        Nothing in these Terms excludes, restricts or modifies any right,
        guarantee or remedy available under the Consumer Guarantees Act 1993,
        the Fair Trading Act 1986 or any other New Zealand law where that right,
        guarantee or remedy cannot lawfully be excluded, restricted or modified.
      </LegalSection>

      <LegalSection number={18} title="Indemnity">
        To the extent permitted by law, you are responsible for loss, damage or
        claims caused by your unlawful use of Drive Legal, falsification of
        records, breach of these Terms or infringement of another person’s
        rights.
      </LegalSection>

      <LegalSection number={19} title="Suspension or Termination">
        We may suspend or terminate access where we reasonably believe an
        account is being used unlawfully, fraudulently, insecurely, in breach of
        these Terms or in a way that threatens users or the integrity of Drive
        Legal.
        {"\n\n"}
        Where reasonably practicable, we may provide notice or an opportunity to
        address the issue before termination.
      </LegalSection>

      <LegalSection number={20} title="Changes to These Terms">
        We may update these Terms from time to time. The current version and its
        latest update date will be published on this page.
        {"\n\n"}
        Where appropriate, we may notify users of significant changes through
        Drive Legal or by another reasonable method.
        {"\n\n"}
        Continued use of Drive Legal after updated Terms take effect constitutes
        acceptance of the updated Terms where permitted by law.
      </LegalSection>

      <LegalSection number={21} title="Governing Law">
        These Terms are governed by the laws of New Zealand.
        {"\n\n"}
        The courts of New Zealand will have jurisdiction over disputes relating
        to these Terms or the Drive Legal service, subject to any rights that
        cannot lawfully be excluded.
      </LegalSection>

      <LegalSection number={22} title="Contact">
        Questions about these Terms can be sent to:
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
