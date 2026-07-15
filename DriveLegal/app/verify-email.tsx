/**
 * Verify Email Screen — shown after registration and when unverified users try to log in.
 *
 * Handles:
 * 1. Registration flow: check email + resend
 * 2. Verification-link flow: verify token + show success/error
 */

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import {
  resendVerificationEmail,
  verifyEmailToken,
} from "@/lib/cloud-sync";

type VerificationStatus =
  | "pending"
  | "verifying"
  | "success"
  | "error";

export default function VerifyEmailScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    token?: string | string[];
    email?: string | string[];
  }>();

  const token = Array.isArray(params.token)
    ? params.token[0]
    : params.token;

  const email = Array.isArray(params.email)
    ? params.email[0]
    : params.email;

  const [status, setStatus] =
    useState<VerificationStatus>(
      token ? "verifying" : "pending"
    );

  const [errorMessage, setErrorMessage] =
    useState("");

  const [resendLoading, setResendLoading] =
    useState(false);

  const [resendSuccess, setResendSuccess] =
    useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function verify() {
      setStatus("verifying");
      setErrorMessage("");

      try {
        const result = await verifyEmailToken(token);

        if (cancelled) return;

        if (result.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(
            result.error ||
              "Verification failed. The link may have expired."
          );
        }
      } catch {
        if (cancelled) return;

        setStatus("error");
        setErrorMessage(
          "Unable to verify your email. Please check your connection and try again."
        );
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleResend() {
    if (!email || resendLoading) return;

    setResendLoading(true);
    setResendSuccess(false);
    setErrorMessage("");

    try {
      const result = await resendVerificationEmail(
        email.trim().toLowerCase()
      );

      if (!result.success) {
        setErrorMessage(
          result.message ||
            "The verification email could not be sent. Please try again."
        );
        return;
      }

      setResendSuccess(true);
    } catch {
      setErrorMessage(
        "Unable to connect to Drive Legal. Please check your internet connection and try again."
      );
    } finally {
      setResendLoading(false);
    }
  }

  function handleGoToLogin() {
    router.replace("/login" as any);
  }

  if (status === "verifying") {
    return (
      <ScreenContainer
        edges={["top", "bottom", "left", "right"]}
        containerClassName="bg-white"
        safeAreaClassName="bg-white"
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <ActivityIndicator
            size="large"
            color="#3156D3"
          />

          <Text
            style={{
              color: "#12386E",
              fontSize: 22,
              fontWeight: "800",
              marginTop: 20,
              textAlign: "center",
            }}
          >
            Verifying your email
          </Text>

          <Text
            style={{
              color: "#71809F",
              fontSize: 14,
              lineHeight: 21,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Please wait while Drive Legal confirms your
            email address.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (status === "success") {
    return (
      <ScreenContainer
        edges={["top", "bottom", "left", "right"]}
        containerClassName="bg-white"
        safeAreaClassName="bg-white"
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: "#DCFCE7",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <MaterialIcons
              name="check-circle"
              size={52}
              color="#16A34A"
            />
          </View>

          <Text
            style={{
              color: "#12386E",
              fontSize: 28,
              fontWeight: "800",
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            Email Verified
          </Text>

          <Text
            style={{
              color: "#71809F",
              fontSize: 15,
              lineHeight: 22,
              textAlign: "center",
              marginBottom: 28,
            }}
          >
            Your email has been successfully verified.
            You can now sign in to Drive Legal.
          </Text>

          <TouchableOpacity
            onPress={handleGoToLogin}
            activeOpacity={0.85}
            style={{
              minWidth: 220,
              minHeight: 56,
              borderRadius: 15,
              backgroundColor: "#3156D3",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 24,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: "800",
              }}
            >
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (status === "error") {
    return (
      <ScreenContainer
        edges={["top", "bottom", "left", "right"]}
        containerClassName="bg-white"
        safeAreaClassName="bg-white"
      >
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: "#FEE2E2",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <MaterialIcons
              name="error-outline"
              size={52}
              color="#DC2626"
            />
          </View>

          <Text
            style={{
              color: "#12386E",
              fontSize: 28,
              fontWeight: "800",
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            Verification Failed
          </Text>

          <Text
            style={{
              color: "#B91C1C",
              fontSize: 14,
              lineHeight: 21,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            {errorMessage}
          </Text>

          {email ? (
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendLoading}
              activeOpacity={0.85}
              style={{
                minWidth: 250,
                minHeight: 56,
                borderRadius: 15,
                backgroundColor: "#3156D3",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 24,
                marginBottom: 16,
                opacity: resendLoading ? 0.7 : 1,
              }}
            >
              {resendLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontWeight: "800",
                  }}
                >
                  Resend Verification Email
                </Text>
              )}
            </TouchableOpacity>
          ) : null}

          {resendSuccess ? (
            <Text
              style={{
                color: "#15803D",
                fontSize: 13,
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              A new verification email has been sent.
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={handleGoToLogin}
            style={{ paddingVertical: 12 }}
          >
            <Text
              style={{
                color: "#3156D3",
                fontSize: 15,
                fontWeight: "700",
              }}
            >
              Back to Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      edges={["top", "bottom", "left", "right"]}
      containerClassName="bg-white"
      safeAreaClassName="bg-white"
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: "#EEF2FF",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <MaterialIcons
            name="mark-email-unread"
            size={48}
            color="#3156D3"
          />
        </View>

        <Text
          style={{
            color: "#12386E",
            fontSize: 28,
            fontWeight: "800",
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          Verify Your Email
        </Text>

        <Text
          style={{
            color: "#71809F",
            fontSize: 15,
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          We sent a verification link to:
        </Text>

        <Text
          style={{
            color: "#12386E",
            fontSize: 16,
            fontWeight: "800",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          {email || "your email address"}
        </Text>

        <Text
          style={{
            color: "#71809F",
            fontSize: 14,
            lineHeight: 21,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Check your inbox and spam folder, then tap the
          verification link. The link expires after 24
          hours.
        </Text>

        {errorMessage ? (
          <View
            style={{
              width: "100%",
              backgroundColor: "#FEF2F2",
              borderColor: "#FECACA",
              borderWidth: 1,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 18,
            }}
          >
            <Text
              style={{
                color: "#B91C1C",
                fontSize: 13,
                lineHeight: 19,
                textAlign: "center",
              }}
            >
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleResend}
          disabled={
            resendLoading ||
            resendSuccess ||
            !email
          }
          activeOpacity={0.85}
          style={{
            width: "100%",
            minHeight: 56,
            borderRadius: 15,
            backgroundColor:
              resendLoading ||
              resendSuccess ||
              !email
                ? "#AEBCE3"
                : "#3156D3",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 20,
          }}
        >
          {resendLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: "800",
              }}
            >
              {resendSuccess
                ? "Email Sent"
                : "Resend Verification Email"}
            </Text>
          )}
        </TouchableOpacity>

        {resendSuccess ? (
          <Text
            style={{
              color: "#15803D",
              fontSize: 13,
              textAlign: "center",
              marginTop: 14,
            }}
          >
            A new verification email has been sent.
          </Text>
        ) : null}

        <TouchableOpacity
          onPress={handleGoToLogin}
          style={{
            paddingVertical: 18,
            marginTop: 6,
          }}
        >
          <Text
            style={{
              color: "#3156D3",
              fontSize: 15,
              fontWeight: "700",
            }}
          >
            Back to Sign In
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
