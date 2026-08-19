export type ReminderAudience = "student" | "faculty";

export function calculateReminderTime(startsAt: Date, reminderMinutes: number) {
  if (!Number.isFinite(reminderMinutes) || reminderMinutes <= 0) throw new Error("Reminder minutes must be positive");
  return new Date(startsAt.getTime() - reminderMinutes * 60 * 1000);
}

export function canScheduleReminder(startsAt: Date, reminderMinutes: number, now = new Date()) {
  return calculateReminderTime(startsAt, reminderMinutes).getTime() > now.getTime();
}

export function attendanceReminderBody(audience: ReminderAudience, room: string, reminderMinutes: number, teacherName?: string, classDivision?: string) {
  const action = audience === "faculty" ? "Prepare to start the attendance session" : "Have your StudyMatrix device tag ready";
  const context = [teacherName, classDivision, room].filter(Boolean).join(" · ");
  return `${action}${context ? ` · ${context}` : ""} · begins in ${reminderMinutes} minutes.`;
}
