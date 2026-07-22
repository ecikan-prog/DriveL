import React from "react";
import {
  LegalPageLayout,
  LegalSection,
} from "@/components/legal-page-layout";

export default function AboutScreen() {
  return (
    <LegalPageLayout
      title="About Drive Legal"
      subtitle="Driver Logbook"
      lastUpdated="Build 41"
      icon="info"
      summaryPoints={[
        {
          icon: "verified",
          text: "NZ Commercial Driver Logbook",
        },
        {
          icon: "support-agent",
          text: "Local New Zealand Support",
        },
        {
          icon: "security",
          text: "Secure Electronic Records",
        },
        {
          icon: "gavel",
          text: "Built for NZ Compliance",
        },
      ]}
    >
      <LegalSection number={1} title="Application">
        Drive Legal is a professional electronic driver logbook designed for
        commercial drivers operating in New Zealand.
      </LegalSection>

      <LegalSection number={2} title="Version">
        Version 1.0.0{"\n"}
        Build 41
      </LegalSection>

      <LegalSection number={3} title="Developer">
        Guided NZ Rentals
      </LegalSection>

      <LegalSection number={4} title="Office">
        2/27 Glenda Drive{"\n"}
        Frankton{"\n"}
        Queenstown 9300{"\n"}
        New Zealand
      </LegalSection>

      <LegalSection number={5} title="Support">
        Email: support@drivelegal.app{"\n"}
        WhatsApp: +64 27 705 0258{"\n"}
        Website: www.drivelegal.app
      </LegalSection>

      <LegalSection number={6} title="Copyright">
        © 2026 Guided NZ Rentals{"\n"}
        All Rights Reserved.
      </LegalSection>
    </LegalPageLayout>
  );
}
