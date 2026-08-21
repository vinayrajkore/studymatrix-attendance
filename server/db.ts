import crypto from "node:crypto";
import { and, desc, eq, gte, inArray, like, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  attendanceRecords,
  attendanceSessions,
  facultyProfiles,
  InsertUser,
  localCredentials,
  notices,
  studentProfiles,
  subjects,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/** Performs a read-only query so the client can verify API and database reachability. */
export async function getBackendTestStatus() {
  const db = await getDb();
  if (!db) return { api: "online" as const, database: "unavailable" as const };
  try {
    const databaseConnected = await Promise.race([
      db.select({ id: users.id }).from(users).limit(1).then(() => true).catch(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3500)),
    ]);
    return { api: "online" as const, database: databaseConnected ? "connected" as const : "unavailable" as const };
  } catch (error) {
    console.warn("[Testing] Database health check failed:", error);
    return { api: "online" as const, database: "unavailable" as const };
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getFacultyProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(facultyProfiles).where(eq(facultyProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function getStudentProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function upsertStudentProfile(input: {
  userId: number;
  fullName: string;
  enrollmentNumber: string;
  rollNumber: string;
  mobileNumber: string;
  parentMobileNumber: string;
  classDivision: string;
  deviceTag: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(studentProfiles).values(input).onDuplicateKeyUpdate({
    set: {
      fullName: input.fullName,
      enrollmentNumber: input.enrollmentNumber,
      rollNumber: input.rollNumber,
      mobileNumber: input.mobileNumber,
      parentMobileNumber: input.parentMobileNumber,
      classDivision: input.classDivision,
      deviceTag: input.deviceTag,
      updatedAt: new Date(),
    },
  });
}

export async function markDeviceVerified(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(studentProfiles).set({ deviceVerified: true, updatedAt: new Date() }).where(eq(studentProfiles.userId, userId));
}

export async function upsertFacultyProfile(input: {
  userId: number;
  fullName: string;
  accessRole: "admin" | "superadmin";
  active: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(facultyProfiles).values(input).onDuplicateKeyUpdate({
    set: { fullName: input.fullName, accessRole: input.accessRole, active: input.active, updatedAt: new Date() },
  });
}

export async function setFacultyActive(userId: number, active: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(facultyProfiles).set({ active, updatedAt: new Date() }).where(eq(facultyProfiles.userId, userId));
}

export async function listFacultyProfiles() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(facultyProfiles).orderBy(desc(facultyProfiles.createdAt));
}

export async function createAttendanceSession(input: {
  subjectId: number;
  classDivision: string;
  adminId: number;
  sessionDate: string;
  attendanceCodeHash: string;
  codeExpiresAt: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(attendanceSessions).values(input).$returningId();
  const sessionId = result[0]?.id;
  if (!sessionId) throw new Error("Attendance session ID was not returned");
  return sessionId;
}

export async function getAttendanceSession(sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(attendanceSessions).where(eq(attendanceSessions.id, sessionId)).limit(1);
  return result[0];
}

export async function closeAttendanceSession(sessionId: number, adminId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(attendanceSessions).set({ status: "closed", closedAt: new Date() }).where(and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.adminId, adminId)));
}

export async function upsertAttendanceRecord(input: {
  sessionId: number;
  studentId: number;
  status: "present" | "absent" | "manual";
  method: "bluetooth" | "wifi" | "code" | "manual";
  markedByAdminId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(attendanceRecords).values(input).onDuplicateKeyUpdate({
    set: {
      status: input.status,
      method: input.method,
      markedByAdminId: input.markedByAdminId ?? null,
      markedAt: new Date(),
    },
  });
}

export async function createNotice(input: { title: string; body: string; sentByAdminId: number; targetClass: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(notices).values(input).$returningId();
  const noticeId = result[0]?.id;
  if (!noticeId) throw new Error("Notice ID was not returned");
  return noticeId;
}

export async function listNotices(classDivision?: string) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(notices).orderBy(desc(notices.createdAt));
  return classDivision ? all.filter((notice) => notice.targetClass === "all" || notice.targetClass === classDivision) : all;
}

export async function listRecordsForSession(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, sessionId));
}

export async function getSubject(subjectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
  return result[0];
}

export async function listAdminSubjects(adminId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subjects).where(eq(subjects.assignedAdminId, adminId)).orderBy(desc(subjects.updatedAt));
}

export async function listAllSubjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subjects).orderBy(desc(subjects.updatedAt));
}

export async function createAdminSubject(input: {
  name: string;
  code: string;
  classDivision: string;
  teacherName: string;
  room: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  assignedAdminId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(subjects).values(input).$returningId();
  const subjectId = result[0]?.id;
  if (!subjectId) throw new Error("Subject ID was not returned");
  return subjectId;
}

export async function updateAdminSubject(input: {
  id: number;
  name: string;
  code: string;
  classDivision: string;
  teacherName: string;
  room: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  assignedAdminId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(subjects).set({
    name: input.name,
    code: input.code,
    classDivision: input.classDivision,
    teacherName: input.teacherName,
    room: input.room,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    updatedAt: new Date(),
  }).where(and(eq(subjects.id, input.id), eq(subjects.assignedAdminId, input.assignedAdminId)));
}

export async function deleteAdminSubject(subjectId: number, adminId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const linkedSessions = await db.select({ id: attendanceSessions.id }).from(attendanceSessions).where(eq(attendanceSessions.subjectId, subjectId)).limit(1);
  if (linkedSessions.length > 0) throw new Error("This subject has attendance sessions and cannot be deleted. Update it instead to preserve attendance history.");
  await db.delete(subjects).where(and(eq(subjects.id, subjectId), eq(subjects.assignedAdminId, adminId)));
}

export async function listStudentAttendanceHistory(studentId: number, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    date: attendanceSessions.sessionDate,
    subject: subjects.name,
    code: subjects.code,
    classDivision: attendanceSessions.classDivision,
    status: attendanceRecords.status,
    method: attendanceRecords.method,
  }).from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
    .innerJoin(subjects, eq(attendanceSessions.subjectId, subjects.id))
    .where(and(eq(attendanceRecords.studentId, studentId), gte(attendanceSessions.sessionDate, startDate), lte(attendanceSessions.sessionDate, endDate)))
    .orderBy(desc(attendanceSessions.sessionDate));
}

export async function listDailyAbsences(adminId: number, startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    date: attendanceSessions.sessionDate,
    subject: subjects.name,
    teacherName: subjects.teacherName,
    classDivision: attendanceSessions.classDivision,
    room: subjects.room,
    startTime: subjects.startTime,
    endTime: subjects.endTime,
    studentName: studentProfiles.fullName,
    enrollmentNumber: studentProfiles.enrollmentNumber,
  }).from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
    .innerJoin(subjects, eq(attendanceSessions.subjectId, subjects.id))
    .innerJoin(studentProfiles, eq(attendanceRecords.studentId, studentProfiles.userId))
    .where(and(eq(attendanceSessions.adminId, adminId), eq(attendanceRecords.status, "absent"), gte(attendanceSessions.sessionDate, startDate), lte(attendanceSessions.sessionDate, endDate)))
    .orderBy(desc(attendanceSessions.sessionDate));
}

export async function matchStudentsByDeviceTags(classDivision: string, deviceTags: string[]) {
  const db = await getDb();
  if (!db || deviceTags.length === 0) return [];
  const matches = await db.select({
    studentId: studentProfiles.userId,
    fullName: studentProfiles.fullName,
    enrollmentNumber: studentProfiles.enrollmentNumber,
    deviceTag: studentProfiles.deviceTag,
    deviceVerified: studentProfiles.deviceVerified,
  }).from(studentProfiles).where(and(eq(studentProfiles.classDivision, classDivision), inArray(studentProfiles.deviceTag, deviceTags)));
  if (matches.length > 0) await db.update(studentProfiles).set({ deviceVerified: true, updatedAt: new Date() }).where(inArray(studentProfiles.userId, matches.map((student) => student.studentId)));
  return matches.map((student) => ({ ...student, deviceVerified: true }));
}

async function hashLocalPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = await new Promise<string>((resolve, reject) =>
    crypto.scrypt(password, salt, 64, { N: 16384 }, (err, key) =>
      err ? reject(err) : resolve(key.toString("hex"))
    )
  );
  return `${salt}:${digest}`;
}

async function verifyLocalPassword(password: string, storedHash: string) {
  const [salt, expected] = storedHash.split(":");
  if (!salt || !expected) return false;
  const actual = await new Promise<string>((resolve, reject) =>
    crypto.scrypt(password, salt, 64, { N: 16384 }, (err, key) =>
      err ? reject(err) : resolve(key.toString("hex"))
    )
  );
  try { return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex")); } catch { return false; }
}

export async function registerLocalStudent(input: {
  fullName: string;
  enrollmentNumber: string;
  rollNumber: string;
  mobileNumber: string;
  parentMobileNumber: string;
  classDivision: string;
  deviceTag: string;
  password: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const enrollmentNumber = input.enrollmentNumber.trim().toUpperCase();
  const existing = await db.select({ id: studentProfiles.id }).from(studentProfiles).where(eq(studentProfiles.enrollmentNumber, enrollmentNumber)).limit(1);
  if (existing.length > 0) throw new Error("This enrollment number is already registered. Please sign in instead.");
  const openId = `local-student-${crypto.createHash("sha256").update(enrollmentNumber).digest("hex").slice(0, 32)}`;
  const userResult = await db.insert(users).values({ openId, name: input.fullName.trim(), loginMethod: "local-password", role: "user", lastSignedIn: new Date() }).$returningId();
  const userId = userResult[0]?.id;
  if (!userId) throw new Error("Unable to create student account");
  await db.insert(studentProfiles).values({ userId, fullName: input.fullName.trim(), enrollmentNumber, rollNumber: input.rollNumber.trim(), mobileNumber: input.mobileNumber.trim(), parentMobileNumber: input.parentMobileNumber.trim(), classDivision: input.classDivision.trim(), deviceTag: input.deviceTag });
  await db.insert(localCredentials).values({ userId, identifier: enrollmentNumber, accountType: "student", passwordHash: await hashLocalPassword(input.password) });
  return { userId, openId, fullName: input.fullName.trim(), enrollmentNumber, classDivision: input.classDivision.trim(), deviceTag: input.deviceTag };
}

export async function registerLocalFaculty(input: {
  fullName: string;
  facultyId: string;
  accessRole: "admin" | "superadmin";
  password: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const identifier = input.facultyId.trim().toUpperCase();
  const existing = await db.select({ id: localCredentials.id }).from(localCredentials).where(eq(localCredentials.identifier, identifier)).limit(1);
  if (existing.length > 0) throw new Error("This Faculty ID is already registered.");
  const openId = `local-faculty-${crypto.createHash("sha256").update(identifier).digest("hex").slice(0, 32)}`;
  const userResult = await db.insert(users).values({ openId, name: input.fullName.trim(), loginMethod: "local-password", role: input.accessRole === "superadmin" ? "superadmin" : "admin", lastSignedIn: new Date() }).$returningId();
  const userId = userResult[0]?.id;
  if (!userId) throw new Error("Unable to create faculty account");
  await db.insert(facultyProfiles).values({ userId, fullName: input.fullName.trim(), accessRole: input.accessRole, active: true });
  await db.insert(localCredentials).values({ userId, identifier, accountType: "admin", passwordHash: await hashLocalPassword(input.password) });
  return { userId, fullName: input.fullName.trim(), facultyId: identifier, accessRole: input.accessRole };
}

async function ensureLocalAdministrator() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existing = await db.select().from(localCredentials).where(eq(localCredentials.identifier, "ADMIN@ICRE")).limit(1);
  if (existing[0]) return existing[0];
  const userResult = await db.insert(users).values({ openId: "local-admin", name: "ICRE Administrator", loginMethod: "local-password", role: "admin", lastSignedIn: new Date() }).$returningId();
  const userId = userResult[0]?.id;
  if (!userId) throw new Error("Unable to create administrator account");
  await db.insert(facultyProfiles).values({ userId, fullName: "ICRE Administrator", accessRole: "superadmin", active: true });
  await db.insert(localCredentials).values({ userId, identifier: "ADMIN@ICRE", accountType: "admin", passwordHash: await hashLocalPassword("icre@2026"), mustChangePassword: true });
  const created = await db.select().from(localCredentials).where(eq(localCredentials.identifier, "ADMIN@ICRE")).limit(1);
  if (!created[0]) throw new Error("Unable to initialize administrator credentials");
  return created[0];
}

export async function loginWithLocalCredentials(identifier: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const normalizedIdentifier = identifier.trim().toUpperCase();
  const credential = normalizedIdentifier === "ADMIN@ICRE" ? await ensureLocalAdministrator() : (await db.select().from(localCredentials).where(eq(localCredentials.identifier, normalizedIdentifier)).limit(1))[0];
  if (!credential || !(await verifyLocalPassword(password, credential.passwordHash))) throw new Error("Invalid ID or password");
  if (credential.accountType === "student") {
    const student = await getStudentProfile(credential.userId);
    const userRow = (await db.select().from(users).where(eq(users.id, credential.userId)).limit(1))[0];
    if (!student || !userRow) throw new Error("Student profile could not be loaded");
    return { accountType: "student" as const, userId: credential.userId, openId: userRow.openId, fullName: student.fullName, classDivision: student.classDivision, deviceTag: student.deviceTag, deviceVerified: student.deviceVerified, mustChangePassword: false };
  }
  const faculty = await getFacultyProfile(credential.userId);
  const userRow = (await db.select().from(users).where(eq(users.id, credential.userId)).limit(1))[0];
  return { accountType: "admin" as const, userId: credential.userId, openId: userRow?.openId || "", fullName: faculty?.fullName ?? "ICRE Administrator", classDivision: null, deviceTag: null, deviceVerified: false, mustChangePassword: credential.mustChangePassword };
}

export async function changeLocalAdminPassword(userId: number, currentPassword: string, nextPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const credential = (await db.select().from(localCredentials).where(and(eq(localCredentials.userId, userId), eq(localCredentials.accountType, "admin"))).limit(1))[0];
  if (!credential || !(await verifyLocalPassword(currentPassword, credential.passwordHash))) throw new Error("Current administrator password is incorrect");
  await db.update(localCredentials).set({ passwordHash: await hashLocalPassword(nextPassword), mustChangePassword: false, updatedAt: new Date() }).where(eq(localCredentials.id, credential.id));
}

export async function verifyLocalAdminPassword(userId: number, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const credential = (await db.select().from(localCredentials).where(and(eq(localCredentials.userId, userId), eq(localCredentials.accountType, "admin"))).limit(1))[0];
  if (!credential || !(await verifyLocalPassword(password, credential.passwordHash))) throw new Error("Administrator password is incorrect");
  return true;
}

export async function getAbsenceSmsDetails(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    studentName: studentProfiles.fullName,
    parentMobileNumber: studentProfiles.parentMobileNumber,
    subjectName: subjects.name,
    teacherName: subjects.teacherName,
    startTime: subjects.startTime,
  }).from(attendanceRecords)
    .innerJoin(studentProfiles, eq(attendanceRecords.studentId, studentProfiles.userId))
    .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
    .innerJoin(subjects, eq(attendanceSessions.subjectId, subjects.id))
    .where(and(
      eq(attendanceRecords.sessionId, sessionId),
      eq(attendanceRecords.status, "absent")
    ));
}

// ─── Student Management (Admin) ──────────────────────────────────────────────

export async function listStudentsByClass(classDivision: string) {
  const db = await getDb();
  if (!db) return [];

  const baseQuery = db.select({
    userId: studentProfiles.userId,
    fullName: studentProfiles.fullName,
    enrollmentNumber: studentProfiles.enrollmentNumber,
    rollNumber: studentProfiles.rollNumber,
    mobileNumber: studentProfiles.mobileNumber,
    parentMobileNumber: studentProfiles.parentMobileNumber,
    classDivision: studentProfiles.classDivision,
    deviceTag: studentProfiles.deviceTag,
    deviceVerified: studentProfiles.deviceVerified,
    status: attendanceRecords.status,
  }).from(studentProfiles)
    .leftJoin(attendanceRecords, eq(attendanceRecords.studentId, studentProfiles.userId));

  const rows = classDivision
    ? await baseQuery.where(like(studentProfiles.classDivision, `${classDivision}%`))
    : await baseQuery;

  // Aggregate per student
  const map = new Map<number, {
    userId: number; fullName: string; enrollmentNumber: string; rollNumber: string;
    mobileNumber: string; parentMobileNumber: string; classDivision: string;
    deviceTag: string; deviceVerified: boolean; presentCount: number; absentCount: number; percentage: number;
  }>();

  for (const row of rows) {
    const existing = map.get(row.userId);
    if (!existing) {
      map.set(row.userId, {
        userId: row.userId, fullName: row.fullName, enrollmentNumber: row.enrollmentNumber,
        rollNumber: row.rollNumber, mobileNumber: row.mobileNumber, parentMobileNumber: row.parentMobileNumber,
        classDivision: row.classDivision, deviceTag: row.deviceTag, deviceVerified: row.deviceVerified,
        presentCount: row.status === "present" || row.status === "manual" ? 1 : 0,
        absentCount: row.status === "absent" ? 1 : 0,
        percentage: 0,
      });
    } else {
      if (row.status === "present" || row.status === "manual") existing.presentCount++;
      else if (row.status === "absent") existing.absentCount++;
    }
  }

  const result = [...map.values()].map((student) => {
    const total = student.presentCount + student.absentCount;
    return { ...student, percentage: total > 0 ? Math.round((student.presentCount / total) * 100) : 100 };
  });
  return result;
}

export async function getStudentProfileById(studentUserId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, studentUserId)).limit(1);
  return result[0];
}

export async function getStudentAttendanceByUserId(studentUserId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    recordId: attendanceRecords.id,
    sessionId: attendanceRecords.sessionId,
    date: attendanceSessions.sessionDate,
    subject: subjects.name,
    subjectCode: subjects.code,
    startTime: subjects.startTime,
    status: attendanceRecords.status,
    method: attendanceRecords.method,
    markedAt: attendanceRecords.markedAt,
  }).from(attendanceRecords)
    .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
    .innerJoin(subjects, eq(attendanceSessions.subjectId, subjects.id))
    .where(eq(attendanceRecords.studentId, studentUserId))
    .orderBy(desc(attendanceSessions.sessionDate));
}

export async function updateStudentProfileById(studentUserId: number, data: {
  fullName: string;
  mobileNumber: string;
  parentMobileNumber: string;
  classDivision: string;
  rollNumber: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(studentProfiles).set({
    fullName: data.fullName.trim(),
    mobileNumber: data.mobileNumber.trim(),
    parentMobileNumber: data.parentMobileNumber.trim(),
    classDivision: data.classDivision.trim(),
    rollNumber: data.rollNumber.trim(),
    updatedAt: new Date(),
  }).where(eq(studentProfiles.userId, studentUserId));
}

export async function deleteStudentById(studentUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(attendanceRecords).where(eq(attendanceRecords.studentId, studentUserId));
  await db.delete(studentProfiles).where(eq(studentProfiles.userId, studentUserId));
  await db.delete(localCredentials).where(eq(localCredentials.userId, studentUserId));
  await db.delete(users).where(eq(users.id, studentUserId));
}

export async function updateAttendanceRecordStatus(recordId: number, status: "present" | "absent" | "manual") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(attendanceRecords).set({ status, method: "manual", markedAt: new Date() }).where(eq(attendanceRecords.id, recordId));
}
export async function createSubject(data: {
  name: string;
  code: string;
  department: string;
  classDivision: string;
  teacherName: string;
  room: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  assignedAdminId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(subjects).values({
    name: data.name.trim(),
    code: data.code.trim(),
    department: data.department.trim() || "Computer Department",
    classDivision: data.classDivision.trim(),
    teacherName: data.teacherName.trim(),
    room: data.room.trim(),
    dayOfWeek: data.dayOfWeek,
    startTime: data.startTime.trim(),
    endTime: data.endTime.trim(),
    assignedAdminId: data.assignedAdminId,
  });
}
