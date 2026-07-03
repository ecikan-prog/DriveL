import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";

export default function PrivacyPolicyScreen() {
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
        <Text className="text-white text-lg font-bold">Privacy Policy</Text>
        <View style={{ width: 60 }} />
      </View>

      <View className="flex-1 bg-white rounded-t-3xl">
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-2xl font-bold text-[#003366] mb-2">Privacy Policy</Text>
          <Text className="text-xs text-[#6B7A99] mb-6">Last updated: 14 June 2026</Text>

          <Section title="1. Introduction">
            Drive Legal ("we", "us", "our") is committed to protecting the privacy of our users ("you", "driver"). This Privacy Policy explains how we collect, use, store, and share your personal information in compliance with the New Zealand Privacy Act 2020 and the Information Privacy Principles (IPPs).
          </Section>

          <Section title="2. Information We Collect">
            We collect the following personal information when you register and use Drive Legal:{"\n\n"}
            • Full name{"\n"}
            • Email address{"\n"}
            • NZ driver licence number{"\n"}
            • Vehicle registration number{"\n"}
            • Vehicle type{"\n"}
            • Shift start/end times and dates{"\n"}
            • Break start/end times and durations{"\n"}
            • Cumulative driving and work hours{"\n"}
            • Device information (for app functionality only)
          </Section>

          <Section title="3. Purpose of Collection">
            Your information is collected for the following purposes:{"\n\n"}
            • To maintain an electronic driver logbook designed to meet NZTA work time requirements{"\n"}
            • To calculate and enforce work time limits under the Land Transport Rule: Work Time and Logbooks 2007{"\n"}
            • To generate work time reports for enforcement agencies{"\n"}
            • To provide fatigue management warnings and alerts{"\n"}
            • To enable you to export records for your employer (TSL holder){"\n"}
            • To manage your subscription and account
          </Section>

          <Section title="4. Data Storage and Security">
            Your logbook data is stored locally on your device using encrypted storage. We implement the following security measures:{"\n\n"}
            • SHA-256 hash chain verification on all completed shift records to detect tampering{"\n"}
            • Immutable log entries — once a shift is ended, it cannot be edited or deleted{"\n"}
            • Local device encryption via the operating system's secure storage{"\n"}
            • No third-party access to your raw logbook data without your explicit consent{"\n\n"}
            Data is retained on your device for a minimum of 12 months as required by the Land Transport Rule: Work Time and Logbooks 2007. We recommend retaining records for 6 years to comply with employment law requirements.
          </Section>

          <Section title="5. Who Can Access Your Data">
            Your logbook data may be accessed by:{"\n\n"}
            • You (the driver) — full access at all times{"\n"}
            • NZ Transport Agency enforcement officers — upon request during roadside inspections, you are required to present your logbook records{"\n"}
            • NZ Police — as part of a lawful enforcement action{"\n"}
            • Your employer / TSL holder — you are required to supply copies within 14 days of recording a shift{"\n\n"}
            We do not sell, rent, or share your personal information with any third parties for marketing or commercial purposes.
          </Section>

          <Section title="6. Data Retention">
            • Active logbook records: Retained indefinitely on your device while the app is installed{"\n"}
            • Minimum retention: 12 months from the date of each shift entry (NZTA requirement){"\n"}
            • Recommended retention: 6 years (employment law best practice){"\n"}
            • Account deletion: You may request deletion of your account and all associated data by contacting us at support@drivelegal.app. We will process deletion requests within 20 working days as required by the Privacy Act 2020.
          </Section>

          <Section title="7. Your Rights Under the Privacy Act 2020">
            Under the New Zealand Privacy Act 2020, you have the right to:{"\n\n"}
            • Access your personal information held by us{"\n"}
            • Request correction of inaccurate information{"\n"}
            • Request deletion of your personal information (subject to legal retention requirements){"\n"}
            • Complain to the Office of the Privacy Commissioner if you believe your privacy has been breached{"\n\n"}
            To exercise these rights, contact us at support@drivelegal.app.
          </Section>

          <Section title="8. Third-Party Services">
            Drive Legal uses the following third-party services:{"\n\n"}
            • Stripe — for subscription payment processing (Stripe's privacy policy applies to payment data){"\n"}
            • Apple App Store / Google Play Store — for app distribution{"\n\n"}
            We do not use analytics tracking, advertising networks, or social media trackers.
          </Section>

          <Section title="9. Changes to This Policy">
            We may update this Privacy Policy from time to time. We will notify you of any material changes via in-app notification or email. Continued use of Drive Legal after changes constitutes acceptance of the updated policy.
          </Section>

          <Section title="10. Contact Us">
            If you have questions about this Privacy Policy or your personal information:{"\n\n"}
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
