# Bluetooth Attendance Test Checklist

## Scope

This procedure tests the implemented **Bluetooth Classic device-name workflow** only. It verifies that a registered student’s Android Bluetooth device name, `SM-<EnrollmentNumber>`, is discovered by the faculty phone and resolved to that student within the correct class. It does not treat a Bluetooth address as a permanent identity proof.

> Use a custom Android development build or an APK. Expo Go cannot run the Bluetooth Classic native bridge used by StudyMatrix.

## Devices and preparation

Use two physical Android phones connected to the same development backend. One phone is the **student device** and one is the **faculty device**. On Android 12 or later, grant **Nearby devices** permission when prompted. On older Android versions, grant the requested location permission. Keep Bluetooth enabled on both devices. [1] [2]

| Phone | Required setup | Example value |
| --- | --- | --- |
| Student | Register a new, clearly test-only account | Enrollment `BTTEST001`, class `BT Test A` |
| Student | Set the Android Bluetooth device name to the tag displayed after registration | `SM-BTTEST001` |
| Faculty | Sign in as administrator and create/select the same class | `BT Test A` |
| Faculty | Start the live Bluetooth scan from the attendance session | — |

Do not use real student records for this test. Choose a new enrollment number, and make the student device discoverable for the scan period through Android Bluetooth settings if the phone requires it.

## Test sequence

First, register the test student on the student phone. After registration, open the device-tag setup screen and copy the generated tag. Use the app’s **Set device name** action or Android Settings to set the Bluetooth name to the tag exactly. Return to StudyMatrix and select **Test My Bluetooth**. A success message confirms that the adapter is available and that the app was able to request the required StudyMatrix name; it does not by itself prove that another phone can discover the device.

Next, on the faculty phone, sign in as the administrator and open a live attendance session for the same class, `BT Test A`. Start the Bluetooth scan while the student phone is nearby, Bluetooth is enabled, and the student device is discoverable if required by that Android version or manufacturer.

The test passes when the faculty screen first displays the live tag `SM-BTTEST001` and then resolves it in the matched roster as the registered test student. The student Profile should subsequently display the last-scan verification status. If the tag is shown under **Unmatched devices**, test the faculty manual-link control; it should label the match as a manual link for the current review without rewriting the saved student device tag.

## Expected results and troubleshooting

| Observation | Meaning | Next action |
| --- | --- | --- |
| Student test succeeds; faculty scan finds `SM-BTTEST001`; roster shows student name | Full Bluetooth matching pipeline passed | Submit or close the test session and remove test data if needed |
| Student test succeeds; faculty scan finds no tag | The local adapter is named, but the student device is not visible to Bluetooth Classic discovery | Confirm Bluetooth is on, make the student device discoverable, keep phones close, then scan again |
| Tag appears under Unmatched devices | The tag does not resolve to a registered student in the session class | Confirm exact enrollment tag and class/division, then test manual linking if appropriate |
| Permission error | Android denied Nearby devices or location access | Enable the permission in Android app settings and retry |
| Bluetooth is off | The Android adapter is disabled | Turn on Bluetooth, then run the test again |

## Important interpretation

The workflow validates **proximity of a configured device**, not certain personal identity. For this reason, StudyMatrix keeps the attendance-code fallback, class-scoped matching, faculty review, and audit trail. If Classic discovery is inconsistent on a particular Android model, use the attendance-code fallback for the session and record the device-specific result for follow-up.

## References

[1] [Android Developers: Bluetooth permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions)

[2] [Android Developers: Find Bluetooth devices](https://developer.android.com/develop/connectivity/bluetooth/find-bluetooth-devices)
