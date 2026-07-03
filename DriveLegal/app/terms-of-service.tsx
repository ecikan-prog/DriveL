import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <ScreenContainer containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
      {/* Header */}
      <View className="px-5 pt-2 pb-4 flex-row items-center justify-between">
        <TouchableOpacity
          className="px-3 py-2 rounded-full border border-[#4A6AB0]"
          onPress={() => router.back()}
        >
          <Text className="text-white text-sm font-bold">← Back</Text>
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold">Terms of Service</Text>
        <View style={{ width: 60 }} />
      </View>

      <View className="flex-1 bg-white rounded-t-3xl">
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-2xl font-bold text-[#003366] mb-2">Terms of Service</Text>
          <Text className="text-xs text-[#6B7A99] mb-6">Last updated: 14 June 2026</Text>

          <Section title="1. Acceptance of Terms">
            By downloading, installing, or using Drive Legal ("the App"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App. Drive Legal is operated by Guided NZ Rentals ("we", "us", "our"), registered in Queenstown, New Zealand.
          </Section>

          <Section title="2. Service Description">
            Drive Legal is an electronic driver logbook application designed to help commercial drivers in New Zealand record their work time, driving time, and rest periods in compliance with the Land Transport Rule: Work Time and Logbooks 2007. The App provides:{"\n\n"}
            • Shift and break time recording{"\n"}
            • Real-time compliance monitoring and fatigue warnings{"\n"}
            • Historical log storage and retrieval{"\n"}
            • PDF and CSV export for enforcement and employer reporting{"\n"}
            • Tamper-evident record keeping with hash verification
          </Section>

          <Section title="3. User Responsibilities">
            As a user of Drive Legal, you are responsible for:{"\n\n"}
            • Providing accurate personal information during registration{"\n"}
            • Recording all work time, driving time, and rest periods truthfully and completely{"\n"}
            • Starting and ending shifts at the correct times{"\n"}
            • Presenting your logbook records to enforcement officers when requested{"\n"}
            • Supplying copies of your logbook to your TSL holder within 14 days{"\n"}
            • Maintaining your device in working order to preserve logbook records{"\n"}
            • Complying with all applicable New Zealand transport laws and regulations{"\n\n"}
            Drive Legal is a recording tool. It does not replace your legal obligation to comply with work time rules. You remain solely responsible for ensuring your driving hours comply with the law.
          </Section>

          <Section title="4. Subscription and Payment">
            Drive Legal offers a 14-day free trial with full functionality. After the trial period:{"\n\n"}
            • Monthly subscription: NZD $4.99/month{"\n"}
            • Annual subscription: NZD $39.99/year{"\n\n"}
            Subscriptions are processed through Stripe. By subscribing, you authorise recurring charges to your payment method. You may cancel at any time through the App or by contacting us.{"\n\n"}
            Important: Even if your subscription lapses, all existing logbook records remain accessible and exportable. We will never delete or restrict access to your compliance records due to payment status.
          </Section>

          <Section title="5. Data Integrity and Immutability">
            To maintain legal admissibility and compliance with NZTA requirements:{"\n\n"}
            • All completed shift records are immutable — they cannot be edited or deleted after submission{"\n"}
            • Each record is protected by a SHA-256 cryptographic hash chain{"\n"}
            • Any attempt to tamper with records will be detected and flagged{"\n"}
            • Exported records include verification checksums for authenticity{"\n\n"}
            This ensures your logbook records are admissible as evidence and trustworthy for enforcement purposes.
          </Section>

          <Section title="6. Limitation of Liability">
            To the maximum extent permitted by New Zealand law:{"\n\n"}
            • Drive Legal is provided "as is" without warranty of any kind{"\n"}
            • We do not guarantee uninterrupted or error-free operation{"\n"}
            • We are not liable for any fines, penalties, or legal consequences arising from your failure to comply with work time rules{"\n"}
            • We are not liable for data loss due to device failure, theft, or damage{"\n"}
            • Our total liability is limited to the amount you have paid for the App in the preceding 12 months{"\n\n"}
            Nothing in these Terms excludes or limits liability that cannot be excluded under New Zealand law, including liability under the Consumer Guarantees Act 1993.
          </Section>

          <Section title="7. NZTA Approval Status">
            Drive Legal is designed to meet the requirements for NZTA approval as an electronic logbook under clause 2.4 of the Land Transport Rule: Work Time and Logbooks 2007. The current approval status is displayed within the App. Users should verify the App's approval status before relying on it as their sole logbook.
          </Section>

          <Section title="8. Account Termination">
            We may suspend or terminate your account if:{"\n\n"}
            • You breach these Terms{"\n"}
            • You use the App for fraudulent purposes{"\n"}
            • You attempt to tamper with or circumvent the integrity verification system{"\n\n"}
            Upon termination, you will retain access to export your existing logbook records for a period of 30 days.
          </Section>

          <Section title="9. Intellectual Property">
            All intellectual property in the App, including but not limited to the software, design, branding, and documentation, is owned by Guided NZ Rentals. You are granted a limited, non-exclusive, non-transferable licence to use the App for its intended purpose.
          </Section>

          <Section title="10. Governing Law">
            These Terms are governed by the laws of New Zealand. Any disputes arising from these Terms or your use of the App shall be subject to the exclusive jurisdiction of the New Zealand courts.
          </Section>

          <Section title="11. Changes to Terms">
            We may update these Terms from time to time. Material changes will be notified via in-app notification or email at least 14 days before taking effect. Continued use after the effective date constitutes acceptance.
          </Section>

          <Section title="12. Contact">
            For questions about these Terms:{"\n\n"}
            Drive Legal (Guided NZ Rentals){"\n"}
            3/259 Hawthorn Drive, Frankton{"\n"}
            Queenstown 9300, New Zealand{"\n"}
            Email: support@drivelegal.app
          </Section>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-5">
      <Text className="text-base font-bold text-[#003366] mb-2">{title}</Text>
      <Text className="text-sm text-[#4A5568] leading-relaxed">{children}</Text>
    </View>
  );
}
