/**
 * withFmtXcode26Fix.js
 *
 * Fixes fmt 11.0.2 compilation failure on Xcode 26+.
 *
 * Root cause: Xcode 26 changed the default for SWIFT_ENABLE_EXPLICIT_MODULES to YES.
 * Explicit Modules mode requires every pod to be modular-clean (have a module map).
 * fmt 11.0.2 has no module map, so the clang module scanner fails when compiling
 * fmt/src/format.cc, producing exit status 65 with no visible diagnostic.
 *
 * React Native 0.81.5 applies a SWIFT_ENABLE_EXPLICIT_MODULES = NO workaround only
 * when NOT building React Native from source (see react_native_post_install in
 * scripts/react_native_pods.rb). Because this project sets buildReactNativeFromSource:true,
 * that branch is skipped and fmt is left exposed to the Xcode 26 default.
 *
 * Fix: inject the fmt build-setting logic INTO the existing post_install block in
 * the generated Podfile. CocoaPods does not allow multiple post_install hooks, so
 * adding a second block would cause "Invalid Podfile: Specifying multiple
 * post_install hooks is unsupported."
 *
 * The injection is idempotent – repeated expo prebuild --clean runs will not
 * duplicate the injected lines.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FMT_XCODE26_MARKER = '# withFmtXcode26Fix';

// Lines inserted at the top of the existing post_install block body.
const FMT_XCODE26_SNIPPET = `  ${FMT_XCODE26_MARKER}
  # Disable Explicit Modules for the fmt pod only.
  # fmt 11.0.2 is not module-map clean and fails to compile under Xcode 26's new
  # SWIFT_ENABLE_EXPLICIT_MODULES=YES default (exit 65, no diagnostic).
  installer.pods_project.targets.each do |target|
    next unless target.name == 'fmt'
    target.build_configurations.each do |config|
      config.build_settings['SWIFT_ENABLE_EXPLICIT_MODULES'] = 'NO'
    end
  end`;

/** @type {import('@expo/config-plugins').ConfigPlugin} */
function withFmtXcode26Fix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      let podfile = fs.readFileSync(podfilePath, 'utf8');

      // Already injected – nothing to do.
      if (podfile.includes(FMT_XCODE26_MARKER)) {
        return config;
      }

      // Find the opening line of the existing post_install block and inject
      // immediately after it.  The generated Podfile always contains a block
      // of the form:
      //   post_install do |installer|
      //     …
      //   end
      const POST_INSTALL_RE = /^(post_install do \|installer\|)$/m;
      if (!POST_INSTALL_RE.test(podfile)) {
        throw new Error(
          'withFmtXcode26Fix: could not find a "post_install do |installer|" ' +
            'block in the generated Podfile. The fix cannot be applied.'
        );
      }

      podfile = podfile.replace(
        POST_INSTALL_RE,
        `$1\n${FMT_XCODE26_SNIPPET}\n`
      );

      fs.writeFileSync(podfilePath, podfile, 'utf8');

      return config;
    },
  ]);
}

module.exports = withFmtXcode26Fix;
