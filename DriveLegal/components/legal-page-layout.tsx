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
      containerClassName="bg-[#3156D3]"
      safeAreaClassName="bg-[#3156D3]"
    >
      {/* Branded header */}
      <View
        style={{
          backgroundColor: "#12386E",
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 28,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.8}
            style={{
              minHeight: 42,
              paddingHorizontal: 14,
              borderRadius: 21,
              borderWidth: 1,
              borderColor: "#5276A9",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <MaterialIcons
              name="arrow-back-ios-new"
              size={16}
              color="#FFFFFF"
            />

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: "700",
                marginLeft: 6,
              }}
            >
              Back
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: "800",
            }}
          >
            {title}
          </Text>

          <View style={{ width: 72 }} />
        </View>

        {/* Drive Legal branding */}
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 27,
            fontWeight: "900",
            letterSpacing: 0.7,
          }}
        >
          DRIVE{" "}
          <Text style={{ color: "#65E58A" }}>
            LEGAL
          </Text>
        </Text>

        <Text
          style={{
            color: "#CAD6FF",
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 2.4,
            marginTop: 5,
          }}
        >
          DRIVER LOGBOOK
        </Text>

        <View
          style={{
            width: 42,
            height: 3,
            borderRadius: 2,
            backgroundColor: "#65E58A",
            marginTop: 20,
            marginBottom: 18,
          }}
        />

        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 21,
            fontWeight: "800",
            marginBottom: 6,
          }}
        >
          {subtitle}
        </Text>

        <Text
          style={{
            color: "#C5D4EC",
            fontSize: 13,
            lineHeight: 19,
            marginBottom: 18,
          }}
        >
          Clear information about your rights,
          responsibilities and use of Drive Legal.
        </Text>

        {/* Summary points */}
        <View>
          {summaryPoints.map((point, index) => (
            <View
              key={`${point.text}-${index}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom:
                  index === summaryPoints.length - 1
                    ? 0
                    : 12,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: "rgba(101,229,138,0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 11,
                }}
              >
                <MaterialIcons
                  name={point.icon}
                  size={19}
                  color="#65E58A"
                />
              </View>

              <Text
                style={{
                  color: "#E7EEF9",
                  fontSize: 13,
                  lineHeight: 18,
                  flex: 1,
                  fontWeight: "600",
                }}
              >
                {point.text}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Legal document */}
      <View
        style={{
          flex: 1,
          backgroundColor: "#F3F6FC",
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          marginTop: -1,
          overflow: "hidden",
        }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: 22,
            paddingBottom: 60,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Document heading card */}
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: 18,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "#E2E8F3",
              shadowColor: "#102A4C",
              shadowOffset: {
                width: 0,
                height: 5,
              },
              shadowOpacity: 0.07,
              shadowRadius: 12,
              elevation: 3,
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
                  backgroundColor: "#EDF3FF",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                <MaterialIcons
                  name={icon}
                  size={28}
                  color="#3156D3"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "#12386E",
                    fontSize: 23,
                    fontWeight: "900",
                  }}
                >
                  {title}
                </Text>

                <Text
                  style={{
                    color: "#71809F",
                    fontSize: 12,
                    fontWeight: "600",
                    marginTop: 5,
                  }}
                >
                  Last updated: {lastUpdated}
                </Text>
              </View>
            </View>
          </View>

          {children}
        </ScrollView>
      </View>
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
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#E2E8F3",
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
          marginBottom: 14,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "#3156D3",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 11,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: "900",
            }}
          >
            {number}
          </Text>
        </View>

        <Text
          style={{
            color: "#12386E",
            fontSize: 17,
            fontWeight: "800",
            flex: 1,
          }}
        >
          {title}
        </Text>
      </View>

      <Text
        style={{
          color: "#4A5872",
          fontSize: 14,
          lineHeight: 22,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
