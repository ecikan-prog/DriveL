import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import type { DriverType } from "@/lib/local-auth";

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  returnKeyType?: "next" | "done";
  optional?: boolean;
};

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
  returnKeyType = "next",
  optional = false,
}: FieldProps) {
  return (
    <View style={{ marginBottom: 18 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            color: "#12386E",
            fontSize: 12,
            fontWeight: "800",
            letterSpacing: 1,
          }}
        >
          {label.toUpperCase()}
        </Text>

        {optional ? (
          <Text
            style={{
              color: "#8793AA",
              fontSize: 10,
              marginLeft: 6,
            }}
          >
            OPTIONAL
          </Text>
        ) : null}
      </View>

      <View
        style={{
          minHeight: 58,
          borderWidth: 1,
          borderColor: "#CED9EF",
          borderRadius: 15,
          backgroundColor: "#F8FAFF",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 15,
        }}
      >
        <MaterialIcons name={icon} size={21} color="#8798B9" />

        <TextInput
          style={{
            flex: 1,
            color: "#102A4C",
            fontSize: 16,
            paddingHorizontal: 12,
            paddingVertical: 14,
          }}
          placeholder={placeholder}
          placeholderTextColor="#9BA8C0"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType={returnKeyType}
        />
      </View>
    </View>
  );
}

function SectionHeader({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <View style={{ marginTop: 8, marginBottom: 18 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 5,
        }}
      >
        <View
          style={{
            width: 27,
            height: 27,
            borderRadius: 14,
            backgroundColor: "#3156D3",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 9,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 12,
              fontWeight: "800",
            }}
          >
            {number}
          </Text>
        </View>

        <Text
          style={{
            color: "#12386E",
            fontSize: 19,
            fontWeight: "800",
          }}
        >
          {title}
        </Text>
      </View>

      <Text
        style={{
          color: "#71809F",
          fontSize: 13,
          lineHeight: 19,
          marginLeft: 36,
        }}
      >
        {description}
      </Text>
    </View>
  );
}

function CheckboxRow({
  checked,
  onPress,
  children,
}: {
  checked: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 15,
      }}
    >
      <View
        style={{
          width: 23,
          height: 23,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? "#3156D3" : "#B9C6DE",
          backgroundColor: checked ? "#3156D3" : "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 11,
          marginTop: 1,
        }}
      >
        {checked ? (
          <MaterialIcons name="check" size={17} color="#FFFFFF" />
        ) : null}
      </View>

      <View style={{ flex: 1 }}>{children}</View>
    </TouchableOpacity>
  );
}
const VEHICLE_TYPES = [
  "Sedan",
  "Hatchback",
  "Wagon",
  "SUV",
  "Van",
  "Minibus",
  "Bus",
  "Truck",
  "Truck & Trailer",
  "Motorcycle",
  "Other",
] as const;

const DRIVER_TYPES: Array<{
  value: DriverType;
  label: string;
  description: string;
}> = [

const DRIVER_TYPES: Array<{
  value: DriverType;
  label: string;
  description: string;
}> = [
  {
    value: "small_passenger",
    label: "Small Passenger Service",
    description: "Taxi, rideshare, shuttle or similar passenger service.",
  },
  {
    value: "large_passenger",
    label: "Large Passenger Service",
    description: "Bus or passenger service using a large passenger vehicle.",
  },
  {
    value: "goods",
    label: "Goods Service",
    description: "Commercial goods transport.",
  },
  {
    value: "vehicle_recovery",
    label: "Vehicle Recovery",
    description: "Tow truck or vehicle recovery service.",
  },
];

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuthContext();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [tslNumber, setTslNumber] = useState("");
  const [operatorName, setOperatorName] = useState("");

  const [licenceNumber, setLicenceNumber] = useState("");
  const [licenceClass, setLicenceClass] = useState("");
  const [licenceExpiry, setLicenceExpiry] = useState("");

  const [vehicleRegistration, setVehicleRegistration] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleTypeOpen, setVehicleTypeOpen] = useState(false);

  const [driverType, setDriverType] =
    useState<DriverType>("small_passenger");

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [confirmedAccuracy, setConfirmedAccuracy] = useState(false);
  const [confirmedSoleUse, setConfirmedSoleUse] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedEmail = email.trim().toLowerCase();

  const requiredFieldsComplete = useMemo(() => {
    return Boolean(
      name.trim() &&
        normalizedEmail &&
        password &&
        confirmPassword &&
        tslNumber.trim() &&
        licenceNumber.trim() &&
        licenceClass.trim() &&
        licenceExpiry.trim() &&
        vehicleRegistration.trim() &&
        vehicleType.trim()
    );
  }, [
    name,
    normalizedEmail,
    password,
    confirmPassword,
    tslNumber,
    licenceNumber,
    licenceClass,
    licenceExpiry,
    vehicleRegistration,
    vehicleType,
  ]);

  const declarationsComplete =
    acceptedTerms &&
    acceptedPrivacy &&
    confirmedAccuracy &&
    confirmedSoleUse;

  const canSubmit =
    requiredFieldsComplete && declarationsComplete && !loading;

  const validateForm = (): string | null => {
    if (!requiredFieldsComplete) {
      return "Please complete all required fields.";
    }

    if (!normalizedEmail.includes("@")) {
      return "Please enter a valid email address.";
    }

    if (password.length < 10) {
      return "Your password must contain at least 10 characters.";
    }

    if (password !== confirmPassword) {
      return "The passwords do not match.";
    }

    if (!declarationsComplete) {
      return "You must accept all required declarations before creating an account.";
    }

    return null;
  };

  const handleRegister = async () => {
    if (loading) return;

    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const result = await register({
        name: name.trim(),
        email: normalizedEmail,
        password,
        tslNumber: tslNumber.trim().toUpperCase(),
        operatorName: operatorName.trim() || undefined,
        licenceNumber: licenceNumber.trim().toUpperCase(),
        licenceClass: licenceClass.trim().toUpperCase(),
        licenceExpiry: licenceExpiry.trim(),
        vehicleRegistration: vehicleRegistration.trim().toUpperCase(),
        vehicleType: vehicleType.trim(),
        driverType,
      });

      if (!result.success) {
        setError(
          result.error ??
            "Registration failed. Please check your information and try again."
        );
        return;
      }

      router.replace({
        pathname: "/verify-email",
        params: {
          email: normalizedEmail,
        },
      } as any);
    } catch {
      setError(
        "Unable to create your account. Please check your internet connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer
      edges={["top", "left", "right"]}
      containerClassName="bg-[#3156D3]"
      safeAreaClassName="bg-[#3156D3]"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View
            style={{
              backgroundColor: "#3156D3",
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: 30,
              alignItems: "center",
              borderBottomLeftRadius: 34,
              borderBottomRightRadius: 34,
            }}
          >
            <Image
              source={require("../assets/images/icon.png")}
              style={{
                width: 70,
                height: 70,
                borderRadius: 17,
                marginBottom: 15,
              }}
              resizeMode="cover"
            />

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 29,
                fontWeight: "900",
                letterSpacing: 0.8,
              }}
            >
              DRIVE <Text style={{ color: "#65E58A" }}>LEGAL</Text>
            </Text>

            <Text
              style={{
                color: "#CAD6FF",
                fontSize: 12,
                fontWeight: "700",
                letterSpacing: 2.8,
                marginTop: 5,
              }}
            >
              DRIVER LOGBOOK
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: "#FFFFFF",
              paddingHorizontal: 22,
              paddingTop: 28,
              paddingBottom: 36,
            }}
          >
            <Text
              style={{
                color: "#12386E",
                fontSize: 30,
                fontWeight: "800",
                marginBottom: 7,
              }}
            >
              Create Account
            </Text>

            <Text
              style={{
                color: "#71809F",
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 22,
              }}
            >
              Enter your driver, operator and vehicle information. Required
              fields must be accurate and belong to the registered driver.
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
                  marginBottom: 18,
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

            <SectionHeader
              number={1}
              title="Account details"
              description="Your identity and secure account access."
            />

            <FormField
              label="Full legal name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your full legal name"
              icon="person-outline"
              autoCapitalize="words"
            />

            <FormField
              label="Email address"
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              icon="mail-outline"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <FormField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Minimum 10 characters"
              icon="lock-outline"
              secureTextEntry
              autoCapitalize="none"
            />

            <FormField
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter your password"
              icon="lock-outline"
              secureTextEntry
              autoCapitalize="none"
            />

            <SectionHeader
              number={2}
              title="Operator details"
              description="The transport service licence and operator responsible for the service."
            />

            <FormField
              label="TSL number"
              value={tslNumber}
              onChangeText={setTslNumber}
              placeholder="Enter TSL number"
              icon="business"
              autoCapitalize="characters"
            />

            <FormField
              label="Operator or company name"
              value={operatorName}
              onChangeText={setOperatorName}
              placeholder="Enter operator name"
              icon="apartment"
              autoCapitalize="words"
              optional
            />

            <SectionHeader
              number={3}
              title="Driver licence"
              description="Enter the details exactly as they appear on your driver licence."
            />

            <FormField
              label="Driver licence number"
              value={licenceNumber}
              onChangeText={setLicenceNumber}
              placeholder="Enter licence number"
              icon="badge"
              autoCapitalize="characters"
            />

            <FormField
              label="Licence class"
              value={licenceClass}
              onChangeText={setLicenceClass}
              placeholder="For example: 1, 2, 4 or 5"
              icon="credit-card"
              autoCapitalize="characters"
            />

            <FormField
              label="Licence expiry date"
              value={licenceExpiry}
              onChangeText={setLicenceExpiry}
              placeholder="DD/MM/YYYY"
              icon="event"
              keyboardType="numeric"
              autoCapitalize="none"
            />

            <SectionHeader
              number={4}
              title="Driver service type"
              description="Select the commercial driving category that best applies."
            />

            {DRIVER_TYPES.map((item) => {
              const selected = driverType === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setDriverType(item.value)}
                  activeOpacity={0.75}
                  style={{
                    borderWidth: 1.5,
                    borderColor: selected ? "#3156D3" : "#D5DEEF",
                    backgroundColor: selected ? "#EEF2FF" : "#FFFFFF",
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 11,
                    flexDirection: "row",
                    alignItems: "flex-start",
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 2,
                      borderColor: selected ? "#3156D3" : "#AAB7D0",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 11,
                      marginTop: 1,
                    }}
                  >
                    {selected ? (
                      <View
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: 6,
                          backgroundColor: "#3156D3",
                        }}
                      />
                    ) : null}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: "#12386E",
                        fontSize: 14,
                        fontWeight: "800",
                        marginBottom: 3,
                      }}
                    >
                      {item.label}
                    </Text>

                    <Text
                      style={{
                        color: "#71809F",
                        fontSize: 12,
                        lineHeight: 17,
                      }}
                    >
                      {item.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <SectionHeader
              number={5}
              title="Primary vehicle"
              description="You can update or change vehicles later from your profile."
            />

            <FormField
  label="Vehicle registration"
  value={vehicleRegistration}
  onChangeText={(value) =>
    setVehicleRegistration(value.trimStart().toUpperCase())
  }
  placeholder="For example: ABC123"
  icon="directions-car"
  autoCapitalize="characters"
/>
  <View style={{ marginBottom: 18 }}>
  <Text
    style={{
      color: "#12386E",
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1,
      marginBottom: 8,
    }}
  >
    VEHICLE TYPE
  </Text>

  <TouchableOpacity
    activeOpacity={0.75}
    onPress={() =>
      setVehicleTypeOpen((current) => !current)
    }
    style={{
      minHeight: 58,
      borderWidth: 1,
      borderColor: vehicleTypeOpen
        ? "#3156D3"
        : "#CED9EF",
      borderRadius: 15,
      backgroundColor: "#F8FAFF",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 15,
    }}
  >
    <MaterialIcons
      name="local-shipping"
      size={21}
      color="#8798B9"
    />

    <Text
      style={{
        flex: 1,
        color: vehicleType
          ? "#102A4C"
          : "#9BA8C0",
        fontSize: 16,
        paddingHorizontal: 12,
        paddingVertical: 14,
      }}
    >
      {vehicleType || "Select vehicle type"}
    </Text>

    <MaterialIcons
      name={
        vehicleTypeOpen
          ? "keyboard-arrow-up"
          : "keyboard-arrow-down"
      }
      size={24}
      color="#71809F"
    />
  </TouchableOpacity>

  {vehicleTypeOpen ? (
    <View
      style={{
        marginTop: 8,
        borderWidth: 1,
        borderColor: "#D5DEEF",
        borderRadius: 15,
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      {VEHICLE_TYPES.map((item, index) => {
        const selected = vehicleType === item;

        return (
          <TouchableOpacity
            key={item}
            activeOpacity={0.75}
            onPress={() => {
              setVehicleType(item);
              setVehicleTypeOpen(false);

              if (error) {
                setError("");
              }
            }}
            style={{
              minHeight: 50,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 15,
              borderBottomWidth:
                index === VEHICLE_TYPES.length - 1
                  ? 0
                  : 1,
              borderBottomColor: "#E8EEF8",
              backgroundColor: selected
                ? "#EEF2FF"
                : "#FFFFFF",
            }}
          >
            <Text
              style={{
                flex: 1,
                color: "#12386E",
                fontSize: 15,
                fontWeight: selected
                  ? "800"
                  : "500",
              }}
            >
              {item}
            </Text>

            {selected ? (
              <MaterialIcons
                name="check"
                size={20}
                color="#3156D3"
              />
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  ) : null}
</View>
            
            <SectionHeader
              number={6}
              title="Declarations"
              description="Read and confirm each declaration before creating your account."
            />

            <View
              style={{
                backgroundColor: "#F8FAFF",
                borderWidth: 1,
                borderColor: "#DCE4F2",
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <CheckboxRow
                checked={confirmedAccuracy}
                onPress={() => setConfirmedAccuracy((value) => !value)}
              >
                <Text
                  style={{
                    color: "#344563",
                    fontSize: 13,
                    lineHeight: 19,
                  }}
                >
                  I confirm that the information supplied is accurate and
                  belongs to me.
                </Text>
              </CheckboxRow>

              <CheckboxRow
                checked={confirmedSoleUse}
                onPress={() => setConfirmedSoleUse((value) => !value)}
              >
                <Text
                  style={{
                    color: "#344563",
                    fontSize: 13,
                    lineHeight: 19,
                  }}
                >
                  I understand that this logbook account is for my sole use and
                  that completed records may only be corrected through a
                  recorded amendment.
                </Text>
              </CheckboxRow>

              <CheckboxRow
                checked={acceptedTerms}
                onPress={() => setAcceptedTerms((value) => !value)}
              >
                <Text
                  style={{
                    color: "#344563",
                    fontSize: 13,
                    lineHeight: 19,
                  }}
                >
                  I accept the{" "}
                  <Text
                    style={{
                      color: "#3156D3",
                      fontWeight: "800",
                    }}
                    onPress={() => router.push("/terms-of-service")}
                  >
                    Terms of Service
                  </Text>
                  .
                </Text>
              </CheckboxRow>

              <CheckboxRow
                checked={acceptedPrivacy}
                onPress={() => setAcceptedPrivacy((value) => !value)}
              >
                <Text
                  style={{
                    color: "#344563",
                    fontSize: 13,
                    lineHeight: 19,
                  }}
                >
                  I have read and accept the{" "}
                  <Text
                    style={{
                      color: "#3156D3",
                      fontWeight: "800",
                    }}
                    onPress={() => router.push("/privacy-policy")}
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </CheckboxRow>
            </View>

            <View
              style={{
                backgroundColor: "#EFF6FF",
                borderWidth: 1,
                borderColor: "#BFDBFE",
                borderRadius: 14,
                padding: 14,
                marginBottom: 20,
                flexDirection: "row",
                alignItems: "flex-start",
              }}
            >
              <MaterialIcons
                name="verified-user"
                size={21}
                color="#1D4ED8"
              />

              <Text
                style={{
                  color: "#1E3A8A",
                  fontSize: 12,
                  lineHeight: 18,
                  marginLeft: 9,
                  flex: 1,
                }}
              >
                A verification link will be sent to your email address. You
                must verify your email before signing in.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleRegister}
              disabled={!canSubmit}
              activeOpacity={0.85}
              style={{
                minHeight: 59,
                borderRadius: 15,
                backgroundColor: canSubmit ? "#3156D3" : "#AEBCE3",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
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
                    Creating Account...
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
                  Create Account
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                alignItems: "center",
                paddingVertical: 20,
              }}
              onPress={() => router.replace("/login")}
            >
              <Text
                style={{
                  color: "#71809F",
                  fontSize: 15,
                }}
              >
                Already have an account?{" "}
                <Text
                  style={{
                    color: "#3156D3",
                    fontWeight: "800",
                  }}
                >
                  Sign In
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
