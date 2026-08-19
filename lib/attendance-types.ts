export type AttendanceStatus = "present" | "absent" | "manual" | "pending";

export type AttendanceMethod = "bluetooth" | "wifi" | "code" | "manual";

export type AttendanceRecord = {
  date: string;
  subject: string;
  status: AttendanceStatus;
  method?: AttendanceMethod;
};

export type SubjectSummary = {
  code: string;
  name: string;
  attended: number;
  total: number;
  color: string;
};

export const studentSubjects: SubjectSummary[] = [
  { code: "CS-301", name: "Data Structures", attended: 21, total: 26, color: "#C89B3C" },
  { code: "CS-302", name: "Database Systems", attended: 19, total: 24, color: "#6B1E2F" },
  { code: "CS-303", name: "Computer Networks", attended: 17, total: 23, color: "#237A57" },
];

export const studentRecords: AttendanceRecord[] = [
  { date: "18 Aug 2026", subject: "Data Structures", status: "present", method: "bluetooth" },
  { date: "16 Aug 2026", subject: "Database Systems", status: "present", method: "code" },
  { date: "15 Aug 2026", subject: "Computer Networks", status: "absent" },
];

export const studentName = "Aarav Patil";
export const deviceTag = "SM-21CE045";
