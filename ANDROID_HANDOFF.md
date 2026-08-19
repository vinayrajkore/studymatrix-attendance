# StudyMatrix Attendance — Android Handoff

## Current Deliverable

StudyMatrix Attendance is an Android-first Expo application for the Institute of Civil and Rural Engineering, Computer Department. The project includes a branded student/faculty interface, role-protected service routes, attendance-session records, student device tags, a time-limited attendance-code fallback, notices, PDF/CSV sharing, and a Bluetooth Classic discovery bridge for Android.

| Area | Included in this project |
|---|---|
| Institutional branding | Deep navy, maroon, and gold mobile interface; launcher, splash, favicon, and adaptive-foreground icon assets. |
| Student flow | Dashboard, subject breakdown, attendance history, notice inbox, attendance-code entry, device-tag status, and an upcoming-session reminder control. |
| Faculty flow | Session preparation, Bluetooth discovery UI with loading/cancellation/error guidance, roster review, manual override state, records, reminder control, and native PDF/CSV sharing actions. |
| Secure service layer | Student/faculty profiles, subjects, timetable entries, attendance sessions/records, notices, role checks, code hashing, expiry verification, and CSV service export. |
| Android proximity | Bluetooth Classic native bridge and config plugin, runtime nearby-device permission request, Android-only device-tag filtering, and fallback-code availability. |

## How the Proximity Flow Works

Students are assigned a stable device tag in the format `SM-<EnrollmentNumber>`, such as `SM-21CE045`. A student must set this as their Bluetooth device name during one-time onboarding and make the device discoverable for the attendance period. The faculty device starts Bluetooth Classic discovery, filters nearby names matching the StudyMatrix convention, and keeps faculty manual review as the final decision.

> Bluetooth discovery establishes **nearby-device presence**, not high-assurance personal identity. The attendance code, session expiry, class check, manual faculty override, and subsequent audit review are deliberate safeguards, rather than optional embellishments.

The generated Android project includes `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_ADVERTISE`, and legacy/fine-location compatibility permissions. Android 12 and later prompt through the operating system’s Nearby devices permission. Older Android versions need fine location permission for discovery. [1] [2]

## APK Generation and Hardware Verification

The native project has been generated successfully to validate the Android configuration, but the APK should be generated through the project interface rather than by consuming sandbox resources. After reviewing the saved checkpoint, select **Publish** in the project interface. The publishing flow will build the Android package and provide the APK artifact.

| Verification step | Expected result |
|---|---|
| Install on a faculty Android phone | The app launches with the StudyMatrix icon and the Faculty workspace is selectable. |
| Install on two student Android phones | Each student completes device-tag setup and uses a unique `SM-...` Bluetooth name. |
| Make student phones discoverable | Their Bluetooth names become eligible for nearby Bluetooth Classic discovery for the allowed system duration. [2] |
| Start a faculty scan | The app requests Android Nearby devices permission, runs a discovery period, and lists matching `SM-...` names for review. |
| Use code fallback | Open a session, enter its six-digit code from an enrolled student account before expiry, and verify that a code attendance record is created. |
| Export records | Use PDF and CSV controls on the faculty records screen and verify the Android share sheet opens with the expected file. |

## Important Production Decisions

The scaffold provides platform-backed OAuth and the project’s own student/faculty profile records. The PRD’s institutional email/password or mobile-OTP sign-in will require connecting an approved identity provider before a public institutional release. The application now schedules **local Android reminders** for the next attendance session after notification permission is granted. Department-wide remote push delivery and timetable-wide automatic scheduling still require an approved notification service, production scheduling policy, and the institution’s credentials.

The Bluetooth Classic library required disabling the React Native new architecture in the Expo configuration because its package metadata does not yet claim compatibility. The standard Expo client cannot test this bridge; only the generated Android build on physical devices can validate real device-name discovery. [3] [4]

## References

[1] [Android Developers: Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions)

[2] [Android Developers: Find Bluetooth devices](https://developer.android.com/develop/connectivity/bluetooth/find-bluetooth-devices)

[3] [React Native Bluetooth Classic: Expo integration](https://kenjdavidson.com/react-native-bluetooth-classic/guides/using-with-expo/)

[4] [React Native Bluetooth Classic: Discovery API](https://kenjdavidson.com/react-native-bluetooth-classic/react-native/rn-bluetooth-classic/)
