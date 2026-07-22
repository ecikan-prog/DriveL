import { useEffect, useRef, useState } from "react";

import {

  ActivityIndicator,

  Keyboard,

  Text,

  TextInput,

  TouchableOpacity,

  View,

} from "react-native";

import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";

import {

  markPinSessionUnlocked,

  verifyPin,

} from "@/lib/pin-security";

const MAX_ATTEMPTS = 5;

export default function PinLoginScreen() {

  const router = useRouter();
  const { logout } = useAuthContext();

  const inputRef = useRef<TextInput>(null);

  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(false);

  const [attempts, setAttempts] = useState(0);

  const [error, setError] = useState("");

  useEffect(() => {

    const timer = setTimeout(() => {

      inputRef.current?.focus();

    }, 300);

    return () => clearTimeout(timer);

  }, []);

  const handleUnlock = async (enteredPin: string) => {

    if (!/^\d{4}$/.test(enteredPin)) {

      setError("Please enter your 4-digit PIN.");

      return;

    }

    setLoading(true);

    setError("");

    try {

      const valid = await verifyPin(enteredPin);

      if (valid) {

        markPinSessionUnlocked();

        setPin("");

        setAttempts(0);

        router.replace("/" as any);

        return;

      }

      const nextAttempts = attempts + 1;

      const remaining = MAX_ATTEMPTS - nextAttempts;

      setAttempts(nextAttempts);

      setPin("");

      if (nextAttempts >= MAX_ATTEMPTS) {

        setError(

          "Too many incorrect attempts. Please sign in using your email and password."

        );

        return;

      }

      setError(

        `Incorrect PIN. ${remaining} ${

          remaining === 1 ? "attempt" : "attempts"

        } remaining.`

      );

      setTimeout(() => {

        inputRef.current?.focus();

      }, 250);

    } catch (e: any) {

      setPin("");

      setError(

        e?.message ||

          "Drive Legal could not verify your PIN. Please try again."

      );

    } finally {

      setLoading(false);

    }

  };

  const handlePinChange = (value: string) => {

    if (loading || attempts >= MAX_ATTEMPTS) {

      return;

    }

    const digitsOnly = value

      .replace(/\D/g, "")

      .slice(0, 4);

    setPin(digitsOnly);

    setError("");

    if (digitsOnly.length === 4) {

      Keyboard.dismiss();

      void handleUnlock(digitsOnly);

    }

  };

  const handleEmailLogin = () => {

    setPin("");

    setAttempts(0);

    setError("");

    router.replace("/login" as any);

  };

  return (

    <ScreenContainer

      edges={["top", "bottom", "left", "right"]}

      containerClassName="bg-[#3156D3]"

      safeAreaClassName="bg-[#3156D3]"

    >

      <View style={{ flex: 1 }}>

        {/* Header */}

        <View

          style={{

            backgroundColor: "#3156D3",

            paddingHorizontal: 24,

            paddingTop: 44,

            paddingBottom: 34,

            alignItems: "center",

            borderBottomLeftRadius: 34,

            borderBottomRightRadius: 34,

          }}

        >

          <View

            style={{

              width: 82,

              height: 82,

              borderRadius: 22,

              backgroundColor: "#FFFFFF",

              alignItems: "center",

              justifyContent: "center",

              marginBottom: 18,

            }}

          >

            <MaterialIcons

              name="lock-outline"

              size={43}

              color="#3156D3"

            />

          </View>

          <Text

            style={{

              color: "#FFFFFF",

              fontSize: 30,

              fontWeight: "900",

              letterSpacing: 0.8,

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

              fontSize: 12,

              fontWeight: "700",

              letterSpacing: 2.8,

              marginTop: 6,

            }}

          >

            DRIVER LOGBOOK

          </Text>

        </View>

        {/* PIN card */}

        <View

          style={{

            flex: 1,

            backgroundColor: "#FFFFFF",

            paddingHorizontal: 25,

            paddingTop: 40,

            paddingBottom: 30,

          }}

        >

          <Text

            style={{

              color: "#12386E",

              fontSize: 30,

              fontWeight: "800",

              textAlign: "center",

            }}

          >

            Enter PIN

          </Text>

          <Text

            style={{

              color: "#71809F",

              fontSize: 15,

              lineHeight: 22,

              textAlign: "center",

              marginTop: 9,

            }}

          >

            Enter your 4-digit PIN to unlock Drive Legal.

          </Text>

          {error ? (

            <View

              style={{

                backgroundColor: "#FEF2F2",

                borderColor: "#FECACA",

                borderWidth: 1,

                borderRadius: 14,

                paddingHorizontal: 14,

                paddingVertical: 12,

                marginTop: 24,

                flexDirection: "row",

                alignItems: "flex-start",

              }}

            >

              <MaterialIcons

                name="error-outline"

                size={19}

                color="#B91C1C"

              />

              <Text

                style={{

                  color: "#B91C1C",

                  fontSize: 13,

                  lineHeight: 19,

                  marginLeft: 8,

                  flex: 1,

                }}

              >

                {error}

              </Text>

            </View>

          ) : null}

          <TouchableOpacity

            activeOpacity={1}

            onPress={() => inputRef.current?.focus()}

            style={{

              marginTop: 42,

              alignItems: "center",

            }}

          >

            <View

              style={{

                flexDirection: "row",

                justifyContent: "center",

              }}

            >

              {[0, 1, 2, 3].map((index) => {

                const completed = index < pin.length;

                return (

                  <View

                    key={`pin-dot-${index}`}

                    style={{

                      width: 24,

                      height: 24,

                      borderRadius: 12,

                      borderWidth: completed ? 0 : 2,

                      borderColor: "#B4C2DD",

                      backgroundColor: completed

                        ? "#3156D3"

                        : "#FFFFFF",

                      marginHorizontal: 12,

                    }}

                  />

                );

              })}

            </View>

            <TextInput

              ref={inputRef}

              value={pin}

              onChangeText={handlePinChange}

              keyboardType="number-pad"

              maxLength={4}

              secureTextEntry

              autoFocus

              textContentType="oneTimeCode"

              accessibilityLabel="Four digit PIN"

              style={{

                position: "absolute",

                width: 1,

                height: 1,

                opacity: 0,

              }}

            />

          </TouchableOpacity>

          <TouchableOpacity

            onPress={() => {

              if (pin.length === 4) {

                void handleUnlock(pin);

              } else {

                inputRef.current?.focus();

              }

            }}

            disabled={

              loading ||

              attempts >= MAX_ATTEMPTS

            }

            activeOpacity={0.85}

            style={{

              minHeight: 58,

              borderRadius: 15,

              backgroundColor:

                loading ||

                attempts >= MAX_ATTEMPTS

                  ? "#AEBCE3"

                  : "#3156D3",

              alignItems: "center",

              justifyContent: "center",

              flexDirection: "row",

              marginTop: 48,

            }}

          >

            {loading ? (

              <>

                <ActivityIndicator color="#FFFFFF" />

                <Text

                  style={{

                    color: "#FFFFFF",

                    fontSize: 16,

                    fontWeight: "800",

                    marginLeft: 10,

                  }}

                >

                  Checking PIN...

                </Text>

              </>

            ) : (

              <Text

                style={{

                  color: "#FFFFFF",

                  fontSize: 17,

                  fontWeight: "800",

                }}

              >

                Unlock

              </Text>

            )}

          </TouchableOpacity>

          <TouchableOpacity

            onPress={handleEmailLogin}

            style={{

              alignItems: "center",

              paddingVertical: 20,

              marginTop: 10,

            }}

          >

            <Text

              style={{

                color: "#3156D3",

                fontSize: 15,

                fontWeight: "800",

              }}

            >

              Sign in using email and password

            </Text>

          </TouchableOpacity>

          <View

            style={{

              backgroundColor: "#F1F5FF",

              borderRadius: 14,

              paddingHorizontal: 15,

              paddingVertical: 14,

              marginTop: 8,

              flexDirection: "row",

              alignItems: "flex-start",

            }}

          >

            <MaterialIcons

              name="info-outline"

              size={19}

              color="#3156D3"

            />

            <Text

              style={{

                color: "#6B7A99",

                fontSize: 12,

                lineHeight: 18,

                marginLeft: 8,

                flex: 1,

              }}

            >

              Forgotten your PIN? Use your email and

              password to sign in securely.

            </Text>

          </View>

        </View>

      </View>

    </ScreenContainer>

  );

}
