const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// ─── Block native-only modules that crash iOS ─────────────────────────────
// These modules call requireNativeModule() at the top level of their JS files.
// requireNativeModule() THROWS if the native module isn't registered, and this
// throw propagates synchronously even with await import(). The only reliable fix
// is to exclude them from the Metro bundle entirely.
//
// Replacements:
//   expo-print, expo-sharing, expo-file-system → server-side export endpoints
//   expo-mail-composer → Linking.openURL('mailto:...')
const existingBlockList = config.resolver?.blockList ?? [];
const nativeOnlyModules = [
  /node_modules\/expo-print\/.*/,
  /node_modules\/expo-sharing\/.*/,
  /node_modules\/expo-file-system\/.*/,
  /node_modules\/expo-mail-composer\/.*/,
];
config.resolver.blockList = Array.isArray(existingBlockList)
  ? [...existingBlockList, ...nativeOnlyModules]
  : [existingBlockList, ...nativeOnlyModules];

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
