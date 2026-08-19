import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const studentProfiles = mysqlTable("student_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  enrollmentNumber: varchar("enrollmentNumber", { length: 64 }).notNull().unique(),
  rollNumber: varchar("rollNumber", { length: 64 }).notNull(),
  mobileNumber: varchar("mobileNumber", { length: 32 }).notNull(),
  parentMobileNumber: varchar("parentMobileNumber", { length: 32 }).notNull(),
  department: varchar("department", { length: 128 }).notNull().default("Computer Department"),
  classDivision: varchar("classDivision", { length: 128 }).notNull(),
  deviceTag: varchar("deviceTag", { length: 80 }).notNull().unique(),
  deviceVerified: boolean("deviceVerified").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const facultyProfiles = mysqlTable("faculty_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  fullName: varchar("fullName", { length: 255 }).notNull(),
  department: varchar("department", { length: 128 }).notNull().default("Computer Department"),
  accessRole: mysqlEnum("accessRole", ["admin", "superadmin"]).notNull().default("admin"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const localCredentials = mysqlTable("local_credentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  identifier: varchar("identifier", { length: 128 }).notNull().unique(),
  accountType: mysqlEnum("accountType", ["student", "admin"]).notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  mustChangePassword: boolean("mustChangePassword").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const subjects = mysqlTable("subjects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  department: varchar("department", { length: 128 }).notNull().default("Computer Department"),
  classDivision: varchar("classDivision", { length: 128 }).notNull(),
  teacherName: varchar("teacherName", { length: 255 }).notNull().default(""),
  room: varchar("room", { length: 128 }).notNull().default(""),
  dayOfWeek: int("dayOfWeek").notNull().default(1),
  startTime: varchar("startTime", { length: 5 }).notNull().default("09:00"),
  endTime: varchar("endTime", { length: 5 }).notNull().default("10:00"),
  assignedAdminId: int("assignedAdminId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const timetableEntries = mysqlTable("timetable_entries", {
  id: int("id").autoincrement().primaryKey(),
  subjectId: int("subjectId").notNull(),
  classDivision: varchar("classDivision", { length: 128 }).notNull(),
  dayOfWeek: int("dayOfWeek").notNull(),
  startTime: varchar("startTime", { length: 5 }).notNull(),
  endTime: varchar("endTime", { length: 5 }).notNull(),
  room: varchar("room", { length: 128 }),
  reminderEnabled: boolean("reminderEnabled").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const attendanceSessions = mysqlTable("attendance_sessions", {
  id: int("id").autoincrement().primaryKey(),
  subjectId: int("subjectId").notNull(),
  classDivision: varchar("classDivision", { length: 128 }).notNull(),
  adminId: int("adminId").notNull(),
  sessionDate: varchar("sessionDate", { length: 10 }).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  status: mysqlEnum("status", ["active", "closed"]).notNull().default("active"),
  attendanceCodeHash: varchar("attendanceCodeHash", { length: 128 }).notNull(),
  codeExpiresAt: timestamp("codeExpiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const attendanceRecords = mysqlTable("attendance_records", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  studentId: int("studentId").notNull(),
  status: mysqlEnum("status", ["present", "absent", "manual"]).notNull(),
  method: mysqlEnum("method", ["bluetooth", "wifi", "code", "manual"]).notNull(),
  markedByAdminId: int("markedByAdminId"),
  markedAt: timestamp("markedAt").defaultNow().notNull(),
}, (table) => [uniqueIndex("attendance_records_session_student_uq").on(table.sessionId, table.studentId)]);

export const notices = mysqlTable("notices", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  sentByAdminId: int("sentByAdminId").notNull(),
  targetClass: varchar("targetClass", { length: 128 }).notNull().default("all"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StudentProfile = typeof studentProfiles.$inferSelect;
export type FacultyProfile = typeof facultyProfiles.$inferSelect;
export type LocalCredential = typeof localCredentials.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type AttendanceSession = typeof attendanceSessions.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type Notice = typeof notices.$inferSelect;
