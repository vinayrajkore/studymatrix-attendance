import { createHash } from "node:crypto";

export type AttendanceMethod = "bluetooth" | "wifi" | "code" | "manual";
export type AttendanceStatus = "present" | "absent" | "manual";
export type SessionState = "active" | "closed";
export type AppRole = "student" | "admin" | "superadmin";

export function createDeviceTag(enrollmentNumber: string): string {
  const normalized = enrollmentNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length < 4) throw new Error("Enrollment number is invalid");
  return `SM-${normalized}`;
}

export function generateAttendanceCode(random: () => number = Math.random): string {
  const number = Math.floor(random() * 900000) + 100000;
  return number.toString();
}

export function hashAttendanceCode(code: string): string {
  if (!/^\d{6}$/.test(code)) throw new Error("Attendance code must contain six digits");
  return createHash("sha256").update(code).digest("hex");
}

export function canMarkByCode(input: {
  suppliedCode: string;
  expectedCodeHash: string;
  expiresAt: Date;
  sessionState: SessionState;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  return input.sessionState === "active" && input.expiresAt.getTime() > now.getTime() && hashAttendanceCode(input.suppliedCode) === input.expectedCodeHash;
}

export function isFacultyRole(role: AppRole): boolean {
  return role === "admin" || role === "superadmin";
}
