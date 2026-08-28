/**
 * withFmtXcode26Fix.js
 *
 * Fixes fmt 11.0.2 compilation failures on Xcode 26+.
 *
 * Root causes:
 * 1) Xcode 26 changed the default for SWIFT_ENABLE_EXPLICIT_MODULES to YES.
 *    Explicit Modules mode requires every pod to be modular-clean (have a module map).
 * 2) Apple Clang 21 in Xcode 26.4 rejects fmt 11.0.2 consteval checks in base.h.
 *
 * React Native 0.81.5 applies a SWIFT_ENABLE_EXPLICIT_MODULES = NO workaround only
 * when NOT building React Native from source (see react_native_post_install in
 * scripts/react_native_pods.rb). Because this project sets buildReactNativeFromSource:true,
 * that branch is skipped and fmt is left exposed to the Xcode 26 default.
 *
 * Fix: inject fmt-specific build-setting and post-install patch logic INTO the
 * existing post_install block in the generated Podfile when one is present;
 * otherwise append exactly one new post_install block containing the fix.
 * CocoaPods does not allow multiple
 * post_install hooks ("Invalid Podfile: Specifying multiple post_install hooks
 * is unsupported"), so a second block is never created.
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
  end

  # Patch fmt 11.0.2 for Xcode 26.4+ consteval failure:
  # format-inl.h/base.h errors such as "call to consteval function is not a
  # constant expression" while compiling fmt/src/format.cc.
  # Idempotent: only patch once, and only if the exact 11.0.2 guard text exists.
  fmt_base_h_path = File.join(installer.sandbox.root.to_s, 'fmt', 'include', 'fmt', 'base.h')
  if File.exist?(fmt_base_h_path)
    fmt_base_h = File.read(fmt_base_h_path)
    patch_marker = 'withFmtXcode26Fix consteval workaround'
    unless fmt_base_h.include?(patch_marker)
      from = "#elif defined(__apple_build_version__) && __apple_build_version__ < 14000029L\\n#  define FMT_USE_CONSTEVAL 0  // consteval is broken in Apple clang < 14."
      to = "#elif defined(__apple_build_version__)\\n#  define FMT_USE_CONSTEVAL 0  // #{patch_marker} for Xcode 26.4 + fmt 11.0.2"
      if fmt_base_h.include?(from)
        fmt_base_h.sub!(from, to)
        File.write(fmt_base_h_path, fmt_base_h)
      end
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

      // If the Podfile already has a post_install block, inject the snippet
      // immediately after its opening line.  Otherwise append a new block.
      // CocoaPods does not allow multiple post_install hooks, so we must never
      // create a second one.
      //
      // The regex matches the opening line regardless of indentation level so
      // that it works both when post_install is at column 0 (bare Podfile) and
      // when it is indented inside a target block (Expo SDK 54 template).
      const POST_INSTALL_RE = /^([ \t]*post_install do \|installer\|)[ \t]*$/m;
      const match = POST_INSTALL_RE.exec(podfile);
      if (match) {
        // Derive the indent used by the block body from the opening-line indent
        // (post_install itself) plus two spaces, so the injected lines align
        // with the surrounding Ruby.
        const blockIndent = match[1].match(/^[ \t]*/)[0] + '  ';
        const indentedSnippet = FMT_XCODE26_SNIPPET.replace(
          /^  /gm,
          blockIndent
        );
        podfile = podfile.replace(
          POST_INSTALL_RE,
          `$1\n${indentedSnippet}\n`
        );
      } else {
        podfile =
          podfile.trimEnd() +
          `\n\npost_install do |installer|\n${FMT_XCODE26_SNIPPET}\nend\n`;
      }

      fs.writeFileSync(podfilePath, podfile, 'utf8');

      return config;
    },
  ]);
}

module.exports = withFmtXcode26Fix;
