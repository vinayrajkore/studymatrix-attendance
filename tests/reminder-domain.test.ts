import { describe, expect, it } from "vitest";
import { attendanceReminderBody, calculateReminderTime, canScheduleReminder } from "../shared/reminder-domain";

describe("attendance reminder rules", () => {
  it("calculates a reminder before a timetable session", () => {
    expect(calculateReminderTime(new Date("2026-08-18T10:30:00.000Z"), 10).toISOString()).toBe("2026-08-18T10:20:00.000Z");
  });

  it("does not schedule a reminder whose trigger has already passed", () => {
    const now = new Date("2026-08-18T10:25:00.000Z");
    expect(canScheduleReminder(new Date("2026-08-18T10:30:00.000Z"), 10, now)).toBe(false);
    expect(canScheduleReminder(new Date("2026-08-18T10:40:00.000Z"), 10, now)).toBe(true);
  });

  it("uses role-specific reminder wording", () => {
    expect(attendanceReminderBody("student", "Room 204", 10)).toContain("device tag");
    expect(attendanceReminderBody("faculty", "Room 204", 10)).toContain("start the attendance session");
  });

  it("includes administrator-provided session context", () => {
    expect(attendanceReminderBody("student", "Room 204", 10, "Prof. Meera Kulkarni", "TY Computer A")).toContain("Prof. Meera Kulkarni · TY Computer A · Room 204");
  });
});
