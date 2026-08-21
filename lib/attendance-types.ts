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
