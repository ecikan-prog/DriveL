import React from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";

type SummaryPoint = {
  icon: keyof typeof MaterialIcons.glyphMap;
  text: string;
};

type LegalPageLayoutProps = {
  title: string;
  subtitle: string;
  lastUpdated: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  summaryPoints: SummaryPoint[];
  children: React.ReactNode;
};

const COLORS = {
  navy: "#12386E",
  navyDark: "#0C2E5B",
  green: "#65D985",
  greenSoft: "#EDF9F0",
  blue: "#3156D3",
  blueSoft: "#EDF3FF",
  page: "#F5F7FB",
  white: "#FFFFFF",
  text: "#12386E",
  muted: "#71809F",
  border: "#E0E6F0",
  body: "#4A5872",
};

export function LegalPageLayout({
  title,
  subtitle,
  lastUpdated,
  icon,
  summaryPoints,
  children,
}: LegalPageLayoutProps) {
  const router = useRouter();

  return (
    <ScreenContainer
      edges={["top", "left", "right"]}
      containerClassName="bg-[#F5F7FB]"
      safeAreaClassName="bg-[#12386E]"
    >
      {/* Compact navy navigation bar */}
      <View
        style={{
          backgroundColor: COLORS.navy,
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 14,
        }}
      >
        <View
          style={{
            minHeight: 48,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              minHeight: 42,
              paddingHorizontal: 14,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: "#5276A9",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcons
              name="arrow-back-ios-new"
              size={17}
              color={COLORS.white}
            />

            <Text
              style={{
                color: COLORS.white,
                fontSize: 16,
                fontWeight: "800",
                marginLeft: 7,
              }}
            >
              Back
            </Text>
          </TouchableOpacity>

          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: COLORS.white,
              fontSize: 18,
              fontWeight: "900",
              marginLeft: 12,
            }}
          >
            {title}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{
          flex: 1,
          backgroundColor: COLORS.page,
        }}
        contentContainerStyle={{
          paddingBottom: 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* White introduction and branding area */}
        <View
          style={{
            backgroundColor: COLORS.white,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 26,
          }}
        >
          <Text
            style={{
              color: COLORS.navyDark,
              fontSize: 27,
              fontWeight: "900",
              letterSpacing: 0.5,
            }}
          >
            DRIVE{" "}
            <Text style={{ color: COLORS.green }}>
              LEGAL
            </Text>
          </Text>

          <Text
            style={{
              color: "#8494BE",
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 2.4,
              marginTop: 4,
            }}
          >
            DRIVER LOGBOOK
          </Text>

          <View
            style={{
              width: 42,
              height: 3,
              borderRadius: 2,
              backgroundColor: COLORS.green,
              marginTop: 18,
              marginBottom: 20,
            }}
          />

          <Text
            style={{
              color: COLORS.text,
              fontSize: 25,
              fontWeight: "900",
              lineHeight: 31,
            }}
          >
            {subtitle}
          </Text>

          <Text
            style={{
              color: COLORS.muted,
              fontSize: 14,
              lineHeight: 21,
              marginTop: 8,
              marginBottom: 20,
            }}
          >
            Clear information about your rights, responsibilities and use of
            Drive Legal.
          </Text>

          {/* Summary cards */}
          <View>
            {summaryPoints.map((point, index) => (
              <View
                key={`${point.text}-${index}`}
                style={{
                  minHeight: 60,
                  backgroundColor: COLORS.white,
                  borderRadius: 15,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  marginBottom:
                    index === summaryPoints.length - 1 ? 0 : 9,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: COLORS.greenSoft,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 13,
                  }}
                >
                  <MaterialIcons
                    name={point.icon}
                    size={23}
                    color="#4FCF74"
                  />
                </View>

                <Text
                  style={{
                    flex: 1,
                    color: COLORS.text,
                    fontSize: 14,
                    lineHeight: 19,
                    fontWeight: "800",
                  }}
                >
                  {point.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Legal document content */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 20,
          }}
        >
          {/* Document heading card */}
          <View
            style={{
              backgroundColor: COLORS.white,
              borderRadius: 18,
              paddingHorizontal: 18,
              paddingVertical: 17,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: COLORS.border,
              shadowColor: "#102A4C",
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.05,
              shadowRadius: 10,
              elevation: 2,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  backgroundColor: COLORS.blueSoft,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                <MaterialIcons
                  name={icon}
                  size={28}
                  color={COLORS.blue}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: COLORS.text,
                    fontSize: 21,
                    lineHeight: 26,
                    fontWeight: "900",
                  }}
                >
                  {title}
                </Text>

                <Text
                  style={{
                    color: COLORS.muted,
                    fontSize: 13,
                    fontWeight: "700",
                    marginTop: 5,
                  }}
                >
                  Last updated: {lastUpdated}
                </Text>
              </View>
            </View>
          </View>

          {children}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

type LegalSectionProps = {
  number: number;
  title: string;
  children: React.ReactNode;
};

export function LegalSection({
  number,
  title,
  children,
}: LegalSectionProps) {
  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 18,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: "#102A4C",
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.04,
        shadowRadius: 9,
        elevation: 2,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: COLORS.blue,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Text
            style={{
              color: COLORS.white,
              fontSize: 16,
              fontWeight: "900",
            }}
          >
            {number}
          </Text>
        </View>

        <Text
          style={{
            flex: 1,
            color: COLORS.text,
            fontSize: 18,
            lineHeight: 23,
            fontWeight: "900",
          }}
        >
          {title}
        </Text>
      </View>

      <Text
        style={{
          color: COLORS.body,
          fontSize: 14,
          lineHeight: 22,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
