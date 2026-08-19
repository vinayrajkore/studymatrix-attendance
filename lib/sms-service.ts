import { Platform, PermissionsAndroid } from "react-native";
import SendSMS from "react-native-send-direct-sms";

export type AbsenceSmsDetail = {
  studentName: string;
  parentMobileNumber: string;
  subjectName: string;
  teacherName: string;
  startTime: string;
};

export async function sendAbsenceSmsBatch(details: AbsenceSmsDetail[]) {
  if (Platform.OS !== "android") {
    console.warn("Direct SMS sending is only supported on Android.");
    return;
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      {
        title: "StudyMatrix SMS Permission",
        message: "StudyMatrix needs access to send SMS to notify parents of absences.",
        buttonNeutral: "Ask Me Later",
        buttonNegative: "Cancel",
        buttonPositive: "OK",
      }
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      console.warn("SMS permission denied");
      return;
    }
  } catch (err) {
    console.warn(err);
    return;
  }

  for (const detail of details) {
    if (!detail.parentMobileNumber) continue;
    
    // Format: "Dear Parent, [Student Name] was marked absent for the [Subject Name] lecture today at [Time]. Faculty: [Faculty Name]."
    const message = `Dear Parent, ${detail.studentName} was marked absent for the ${detail.subjectName} lecture today at ${detail.startTime}. Faculty: ${detail.teacherName}.`;
    
    try {
      SendSMS.sendDirectSms(detail.parentMobileNumber, message);
    } catch (error) {
      console.error(`Failed to send SMS to ${detail.parentMobileNumber}`, error);
    }
  }
}
