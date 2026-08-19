---
name: Expo background audio
description: Expo media config plugins can add the iOS audio background capability without an explicit plist entry.
---

Do not enable the `expo-audio` config plugin unless DriveLegal genuinely supports persistent background audio: its playback setting defaults on and injects `audio` into `UIBackgroundModes`.

Likewise, do not configure the `expo-video` plugin with background playback or Picture-in-Picture unless that capability is genuinely required, because either setting injects the same iOS audio background mode.

**Why:** Apple rejected the app under Guideline 2.5.4 because it declared the audio background capability without a persistent audio feature.

**How to apply:** When changing Expo media plugins, inspect the resolved Expo config and a clean-prebuilt `ios/*/Info.plist`; `UIBackgroundModes` must not contain `audio` unless the associated background feature is shipped and reviewable.