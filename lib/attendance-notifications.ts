import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { attendanceReminderBody, calculateReminderTime, canScheduleReminder } from "@/shared/reminder-domain";

export type AttendanceReminder = {
  sessionId: string;
  audience: "student" | "faculty";
  subject: string;
  room: string;
  teacherName?: string;
  classDivision?: string;
  startsAt: Date;
  reminderMinutes?: number;
};

const channelId = "attendance-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function buildUpcomingSession(role: "student" | "faculty"): AttendanceReminder {
  const startsAt = new Date(Date.now() + 30 * 60 * 1000);
  return {
    sessionId: `${role}-cs301-${startsAt.toISOString().slice(0, 10)}`,
    audience: role,
    subject: "Data Structures",
    room: "Room 204",
    startsAt,
    reminderMinutes: 10,
  };
}

export async function prepareAttendanceNotifications() {
  if (Platform.OS === "web") return { granted: false, message: "Notifications are available in the Android app." };

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: "Attendance reminders",
      description: "Upcoming attendance-session reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 120, 220],
      lightColor: "#C89B3C",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const finalStatus = existing.status === "granted" ? existing.status : (await Notifications.requestPermissionsAsync()).status;
  return finalStatus === "granted"
    ? { granted: true, message: "Attendance reminders are enabled." }
    : { granted: false, message: "Notifications are off. Enable them in Android Settings to receive attendance reminders." };
}

export async function scheduleAttendanceReminder(reminder: AttendanceReminder) {
  const readiness = await prepareAttendanceNotifications();
  if (!readiness.granted) return readiness;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.find((item) => item.content.data?.sessionId === reminder.sessionId && item.content.data?.audience === reminder.audience);
  if (existing) await Notifications.cancelScheduledNotificationAsync(existing.identifier);

  const minutes = reminder.reminderMinutes ?? 10;
  if (!canScheduleReminder(reminder.startsAt, minutes)) {
    return { granted: true, message: "This attendance session is too close to schedule a reminder." };
  }
  const triggerAt = calculateReminderTime(reminder.startsAt, minutes);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${reminder.subject} starts soon`,
      body: attendanceReminderBody(reminder.audience, reminder.room, minutes, reminder.teacherName, reminder.classDivision),
      data: { sessionId: reminder.sessionId, audience: reminder.audience, subject: reminder.subject, teacherName: reminder.teacherName ?? "", classDivision: reminder.classDivision ?? "" },
      sound: "default",
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerAt, channelId },
  });
  return { granted: true, message: `Reminder scheduled for ${triggerAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` };
}

export async function syncTimetableReminders(catalog: any[], role: "student" | "faculty", identifier: string) {
  const readiness = await prepareAttendanceNotifications();
  if (!readiness.granted) return readiness;

  // Clear existing recurring notifications
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of scheduled) {
    if (item.content.data?.recurringTimetable) {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }

  // Filter catalog for this user
  const relevantSubjects = catalog.filter((item) => {
    if (role === "faculty") return item.teacherName === identifier;
    if (role === "student") return item.classDivision === identifier;
    return false;
  });

  let count = 0;
  for (const subject of relevantSubjects) {
    if (!subject.startTime || subject.dayOfWeek === undefined) continue;
    const [startHourStr, startMinuteStr] = subject.startTime.split(":");
    let hour = parseInt(startHourStr, 10);
    let minute = parseInt(startMinuteStr, 10);

    // Subtract 10 minutes for reminder
    minute -= 10;
    if (minute < 0) {
      minute += 60;
      hour -= 1;
      if (hour < 0) hour += 24;
    }

    // dayOfWeek 1=Mon, 2=Tue... Expo weekday 1=Sun, 2=Mon...
    const weekday = (subject.dayOfWeek % 7) + 1; 

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${subject.name} starts soon`,
        body: attendanceReminderBody(role, subject.room, 10, subject.teacherName, subject.classDivision),
        data: { recurringTimetable: true, sessionId: `${role}-${subject.code}-${subject.dayOfWeek}-${subject.startTime}`, audience: role, subject: subject.name, teacherName: subject.teacherName, classDivision: subject.classDivision },
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour,
        minute,
        channelId,
      },
    });
    count++;
  }

  return { granted: true, count, message: `Synced ${count} weekly timetable reminders.` };
}
