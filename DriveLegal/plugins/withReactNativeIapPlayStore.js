/**
 * withReactNativeIapPlayStore.js
 *
 * Configures Gradle to select the "play" variant for react-native-iap
 * when both Amazon and Google Play variants are available.
 *
 * The react-native-iap library exposes two flavor variants via the "store" dimension:
 * - amazonReleaseRuntimeElements
 * - playReleaseRuntimeElements
 *
 * This plugin injects missingDimensionStrategy configuration into the defaultConfig
 * block of the generated app/build.gradle file, ensuring Gradle automatically
 * selects the Google Play variant during the build process.
 *
 * The configuration is idempotent – repeated expo prebuild --clean runs will
 * not duplicate the injected configuration.
 */

const fs = require('fs');
const path = require('path');

const REACT_NATIVE_IAP_MARKER = '// withReactNativeIapPlayStore';

const REACT_NATIVE_IAP_SNIPPET = `    ${REACT_NATIVE_IAP_MARKER}
    missingDimensionStrategy 'store', 'play'`;

function resolveWithDangerousMod() {
  for (const request of ['@expo/config-plugins', 'expo/config-plugins']) {
    try {
      const mod = require(request);
      if (typeof mod.withDangerousMod === 'function') {
        return mod.withDangerousMod;
      }
    } catch (error) {
      if (
        error?.code !== 'MODULE_NOT_FOUND' ||
        !error.message.includes(`'${request}'`)
      ) {
        throw error;
      }
    }
  }

  // Fallback for contexts where config-plugins is not available
  return (config) => config;
}

/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withReactNativeIapPlayStore(config) {
  const withDangerousMod = resolveWithDangerousMod();
  return withDangerousMod(config, [
    'android',
    (config) => {
      const appBuildGradlePath = path.join(
        config.modRequest.projectRoot,
        'android',
        'app',
        'build.gradle'
      );

      if (!fs.existsSync(appBuildGradlePath)) {
        console.warn(
          `[withReactNativeIapPlayStore] app/build.gradle not found at ${appBuildGradlePath}`
        );
        return config;
      }

      let buildGradle = fs.readFileSync(appBuildGradlePath, 'utf8');

      // Already injected – nothing to do
      if (buildGradle.includes(REACT_NATIVE_IAP_MARKER)) {
        return config;
      }

      // Find the defaultConfig { ... } block and inject missingDimensionStrategy inside it
      // Look for "defaultConfig {" pattern
      const DEFAULT_CONFIG_START_RE = /^(\s*)defaultConfig\s*\{/m;
      const match = DEFAULT_CONFIG_START_RE.exec(buildGradle);

      if (!match) {
        console.warn(
          '[withReactNativeIapPlayStore] Could not find defaultConfig block in app/build.gradle'
        );
        return config;
      }

      // Get the indentation level from the defaultConfig block
      const defaultConfigIndent = match[1];
      const blockIndent = defaultConfigIndent + '    '; // 4 more spaces for content

      // Find where to insert: after the opening "defaultConfig {" line
      const startPos = match.index + match[0].length;

      // Look for the next line after "defaultConfig {" to determine placement
      const afterBlockStart = buildGradle.substring(startPos);
      const nextNewlineIndex = afterBlockStart.indexOf('\n');

      if (nextNewlineIndex === -1) {
        console.warn(
          '[withReactNativeIapPlayStore] Unexpected build.gradle format'
        );
        return config;
      }

      const insertPos = startPos + nextNewlineIndex + 1;
      const indentedSnippet = REACT_NATIVE_IAP_SNIPPET.replace(
        /^    /gm,
        blockIndent
      );

      buildGradle =
        buildGradle.substring(0, insertPos) +
        indentedSnippet +
        '\n' +
        buildGradle.substring(insertPos);

      fs.writeFileSync(appBuildGradlePath, buildGradle, 'utf8');

      return config;
    },
  ]);
}

module.exports = withReactNativeIapPlayStore;
