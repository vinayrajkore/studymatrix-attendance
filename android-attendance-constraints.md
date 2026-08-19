# Android Attendance Capability Notes

## Decision

The app will use **Bluetooth Classic discovery** for the PRD’s device-name convention (`SM-<EnrollmentNumber>`) and the short-lived attendance code as the required reliability fallback. Bluetooth Classic discovery exposes nearby device names when student phones are explicitly discoverable; this matches the product requirement more closely than BLE libraries that only discover BLE peripherals. Wi-Fi SSID scanning will not be the primary v1 implementation because modern Android scan throttling, OEM behavior, and hotspot-name discoverability make it less predictable across student devices.

## Verified Constraints

| Area | Implementation consequence |
|---|---|
| Expo runtime | The Bluetooth Classic bridge requires a custom Android build. The standard Expo client cannot exercise this native module. |
| Android permissions | Android 12+ requires declared and runtime-approved nearby-device permissions for scanning; older Android versions require compatible legacy Bluetooth declarations and fine location access for discovery. |
| Device identity | Android applications cannot silently rename a phone’s Bluetooth name or hotspot SSID. Student onboarding must show the generated `SM-<EnrollmentNumber>` tag, copy it, and open Bluetooth settings for a one-time manual rename. |
| Identity assurance | Discovering a broadcast name demonstrates proximity only. Faculty manual override, audit fields, expiry-bound attendance codes, and an active-session time window remain mandatory safeguards. |
| Discoverability requirement | Android phones are not discoverable by default. During attendance, the student device must be set to Bluetooth discoverable for a limited period; a broadcast name alone does not make it visible to the faculty scan. |
| Build requirement | The managed preview can validate UI and server flows, but not physical Bluetooth behavior. Native scanner verification requires the generated Android build and multiple hardware test devices. |

## Product Boundary

The build includes the permission-aware Bluetooth Classic scanner interface, attendance-code validation, and a native configuration plugin for the Android bridge. It will not claim to verify hardware discovery until it is installed on a physical Android device and exercised with representative Bluetooth device names in an actual classroom environment.

## Sources

[1] [Expo: How to build a Bluetooth Low Energy powered Expo app](https://expo.dev/blog/how-to-build-a-bluetooth-low-energy-powered-expo-app)

[2] [Android Developers: Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions)

[3] [Android Developers: Find Bluetooth devices](https://developer.android.com/develop/connectivity/bluetooth/find-bluetooth-devices)

[4] [React Native Bluetooth Classic: Expo integration](https://kenjdavidson.com/react-native-bluetooth-classic/guides/using-with-expo/)

[5] [React Native Bluetooth Classic: Discovery API](https://kenjdavidson.com/react-native-bluetooth-classic/react-native/rn-bluetooth-classic/)
