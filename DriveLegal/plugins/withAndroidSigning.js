/**
 * withAndroidSigning.js
 *
 * Configures the Android release build to use a production keystore
 * instead of the default debug keystore.
 *
 * This plugin:
 * 1. Adds a "release" signingConfig that reads from Gradle properties:
 *    - android.injected.signing.store.file
 *    - android.injected.signing.store.password
 *    - android.injected.signing.key.alias
 *    - android.injected.signing.key.password
 * 2. Changes the release buildType to use signingConfig signingConfigs.release
 *
 * These properties are passed by Codemagic via CLI flags:
 *   -Pandroid.injected.signing.store.file="$CM_KEYSTORE_PATH"
 *   -Pandroid.injected.signing.store.******
 *   -Pandroid.injected.signing.key.alias="$CM_KEY_ALIAS"
 *   -Pandroid.injected.signing.key.******
 *
 * The configuration is idempotent – repeated expo prebuild --clean runs
 * will not duplicate the injected configuration.
 */

const fs = require('fs');
const path = require('path');

const ANDROID_SIGNING_MARKER = '// withAndroidSigning';

const RELEASE_SIGNING_CONFIG = `    ${ANDROID_SIGNING_MARKER}
    release {
        if (project.hasProperty('android.injected.signing.store.file')) {
            storeFile = file(project.getProperty('android.injected.signing.store.file'))
            storePassword = project.getProperty('android.injected.signing.store.password')
            keyAlias = project.getProperty('android.injected.signing.key.alias')
            keyPassword = project.getProperty('android.injected.signing.key.password')
        }
    }`;

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
function withAndroidSigning(config) {
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
          `[withAndroidSigning] app/build.gradle not found at ${appBuildGradlePath}`
        );
        return config;
      }

      let buildGradle = fs.readFileSync(appBuildGradlePath, 'utf8');

      // Track changes
      let modified = false;

      // Step 1: Add release signingConfig if not already present
      if (!buildGradle.includes(ANDROID_SIGNING_MARKER)) {
        // Find the signingConfigs block and add release config
        const SIGNING_CONFIGS_START_RE = /(\s*)signingConfigs\s*\{/m;
        const match = SIGNING_CONFIGS_START_RE.exec(buildGradle);

        if (match) {
          // Get indentation from the signingConfigs block
          const signingConfigsIndent = match[1];
          
          // Find the closing brace of signingConfigs block
          let braceCount = 0;
          let startPos = match.index + match[0].length;
          let endPos = -1;

          for (let i = startPos; i < buildGradle.length; i++) {
            if (buildGradle[i] === '{') braceCount++;
            if (buildGradle[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                endPos = i;
                break;
              }
            }
          }

          if (endPos !== -1) {
            // Insert the release signingConfig just before the closing brace
            const indentedSnippet = RELEASE_SIGNING_CONFIG.replace(
              /^    /gm,
              signingConfigsIndent + '    '
            );

            buildGradle =
              buildGradle.substring(0, endPos) +
              '\n' +
              indentedSnippet +
              '\n' +
              signingConfigsIndent +
              buildGradle.substring(endPos);

            modified = true;
          }
        }
      }

      // Step 2: Change release buildType to use signingConfigs.release
      // Look for: release {
      //             signingConfig signingConfigs.debug
      // Replace with: signingConfig signingConfigs.release

      const releaseBlockRe = /(buildTypes\s*\{[\s\S]*?)(\s+)release\s*\{([\s\S]*?)signingConfig\s+signingConfigs\.debug/;
      if (releaseBlockRe.test(buildGradle)) {
        buildGradle = buildGradle.replace(
          releaseBlockRe,
          (match, before, indent, releaseContent) => {
            return (
              before +
              indent +
              'release {' +
              releaseContent +
              'signingConfig signingConfigs.release'
            );
          }
        );
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(appBuildGradlePath, buildGradle, 'utf8');
        console.log('[withAndroidSigning] Android signing configuration updated');
      }

      return config;
    },
  ]);
}

module.exports = withAndroidSigning;
