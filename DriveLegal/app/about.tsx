import React from "react";

import {
  LegalPageLayout,
  LegalSection,
} from "@/components/legal-page-layout";

export default function AboutScreen() {
  return (
    <LegalPageLayout
      title="About Drive Legal"
      subtitle="Digital Work-Time Logbook"
      lastUpdated="Build 61"
      icon="info"
      summaryPoints={[
        {
          icon: "verified",
          text: "NZ Commercial Driver Logbook",
        },
        {
          icon: "support-agent",
          text: "New Zealand Support",
        },
        {
          icon: "security",
          text: "Secure Electronic Records",
        },
        {
          icon: "gavel",
          text: "Built for NZ Work-Time Recording",
        },
      ]}
    >
      <LegalSection number={1} title="Application">
        Drive Legal is a digital work-time and logbook application designed to
        assist commercial drivers operating in New Zealand with recording
        shifts, work time, driving periods, breaks, vehicles and related
        logbook information.
      </LegalSection>

      <LegalSection number={2} title="Version">
        Version 1.0.0{"\n"}
        Build 61
      </LegalSection>

      <LegalSection number={3} title="Service">
        Drive Legal
      </LegalSection>

      <LegalSection number={4} title="Location">
        Queenstown{"\n"}
        New Zealand
      </LegalSection>

      <LegalSection number={5} title="Support">
        Email: support@drivelegal.app{"\n"}
        Website: https://drivelegal.app
      </LegalSection>

      <LegalSection number={6} title="Important Information">
        Drive Legal is a record-keeping and compliance-support tool. It is not
        represented as being approved, certified or endorsed by Waka Kotahi New
        Zealand Transport Agency unless expressly confirmed in writing.
        {"\n\n"}
        Drivers and transport operators remain responsible for understanding
        and complying with all applicable legal requirements.
      </LegalSection>

      <LegalSection number={7} title="Copyright">
        © 2026 Drive Legal{"\n"}
        All rights reserved.
      </LegalSection>
    </LegalPageLayout>
  );
}
