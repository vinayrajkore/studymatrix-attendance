# StudyMatrix Bluetooth Device Matching

## Identifier Model

StudyMatrix does not treat a Bluetooth MAC address as a student identity. Android devices may randomize addresses, addresses can change after hardware or operating-system changes, and a visible device can be owned by someone other than the student. The durable institutional identifier is the student profile’s **device tag**, generated from the enrollment number and stored in the database.

| Data item | Example | Purpose |
|---|---|---|
| Enrollment number | `21CE045` | Institutional student identifier. |
| Stored device tag | `SM-21CE045` | Unique application identifier in `student_profiles.deviceTag`. |
| Bluetooth broadcast name | `SM-21CE045` | Name that the student configures on their Android Bluetooth device. |
| Bluetooth address and RSSI | `AA:BB:CC:DD:EE:FF`, `-58` | Session-only evidence of a nearby device; recorded only for discovery diagnostics, not used as the canonical student identity. |

## Matching Sequence

The student’s one-time setup generates and displays their `SM-<EnrollmentNumber>` tag. The student renames the phone’s Bluetooth device to that exact value and makes it discoverable for the attendance period. The faculty Android device requests Nearby devices permission, starts Bluetooth Classic discovery, normalizes detected names to upper case, and accepts only names matching `SM-[A-Z0-9]+`.

The app sends the recognized tag names with the active class to the protected attendance API. The API resolves each tag against `student_profiles.deviceTag` **and** the session’s class/division. This produces an enrolled student roster candidate instead of trusting an address or a display name alone. The faculty user then reviews the matched roster and submits the final attendance state.

> A discovered Bluetooth device demonstrates proximity of a configured device—not guaranteed personal identity. StudyMatrix therefore uses code fallback, class-scoped matching, faculty review, session expiry, and attendance audit records as complementary safeguards.

## Operational Requirements

The workflow requires a custom Android build rather than Expo Go because it relies on a Bluetooth Classic native bridge. On Android 12 and later, the faculty device must grant Nearby devices permissions; older Android versions require location permission for discovery. Students must keep Bluetooth enabled and their configured device discoverable while the faculty scan is active. [1] [2]

## Reference

[1] [Android Developers: Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions)

[2] [Android Developers: Find Bluetooth devices](https://developer.android.com/develop/connectivity/bluetooth/find-bluetooth-devices)
