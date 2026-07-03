// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

// Bundle ID format: space.manus.<project_name_dots>.<timestamp>
// e.g., "my-app" created at 2024-01-15 10:30:45 -> "space.manus.my.app.t20240115103045"
// Bundle ID can only contain letters, numbers, and dots
// Android requires each dot-separated segment to start with a letter
// Bundle ID for the Drive Legal iOS app (EAS credentials registered under this ID)
const bundleId = "com.app.guidednzlogbook";
// Primary branded deep link scheme — drivelegal://
// The auto-generated manus scheme is kept as a secondary scheme for compatibility.
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

const LIVE_API_URL = "https://guidedlogbook-6i7vyx5h.manus.space";

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "Drive Legal",
  appSlug: "guided-nz-logbook",
  // S3 URL of the app logo - set this to the URL returned by generate_image when creating custom logo
  // Leave empty to use the default icon from assets/images/icon.png
  logoUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663468633220/6i7vyx5hH4pUpsBoJAtZeK/drive-legal-icon-TcA2fQ3cP7XnZztaesH6WD.png",
  // drivelegal is the primary branded scheme; manusmobile is kept as secondary
  primaryScheme: "drivelegal",
  secondaryScheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
  // Live backend URL — baked into native builds so iOS/Android can reach the cloud API
  apiUrl: process.env.EXPO_PUBLIC_API_URL || LIVE_API_URL,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.18",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: [env.primaryScheme, env.secondaryScheme],
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    buildNumber: "10023",
    "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.primaryScheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  extra: {
    apiUrl: env.apiUrl,
    eas: {
      projectId: "1cb6117e-85be-497d-9fc8-7c0a54e9b072",
    },
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
