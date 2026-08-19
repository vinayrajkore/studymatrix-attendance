import { COOKIE_NAME } from "../shared/const.js";
import { canMarkByCode, createDeviceTag, generateAttendanceCode, hashAttendanceCode, isFacultyRole } from "../shared/attendance-domain";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

const facultyProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const profile = await db.getFacultyProfile(ctx.user.id);
  if (!profile || !profile.active || !isFacultyRole(profile.accessRole)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Faculty administrator access is required" });
  }
  return next({ ctx: { ...ctx, facultyProfile: profile } });
});

const superAdminProcedure = facultyProcedure.use(async ({ ctx, next }) => {
  if (ctx.facultyProfile.accessRole !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Super-administrator access is required" });
  }
  return next({ ctx });
});

const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((range) => range.startDate <= range.endDate, { message: "Start date must be on or before end date" });

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    local: router({
      registerStudent: publicProcedure.input(z.object({
        fullName: z.string().min(3).max(255),
        enrollmentNumber: z.string().min(4).max(64),
        rollNumber: z.string().min(1).max(64),
        mobileNumber: z.string().min(8).max(32),
        parentMobileNumber: z.string().min(8).max(32),
        classDivision: z.string().min(1).max(128),
        password: z.string().min(8).max(128),
      })).mutation(async ({ input }) => {
        const deviceTag = createDeviceTag(input.enrollmentNumber);
        return db.registerLocalStudent({ ...input, deviceTag });
      }),
      login: publicProcedure.input(z.object({
        identifier: z.string().min(1).max(128),
        password: z.string().min(1).max(128),
      })).mutation(({ input }) => db.loginWithLocalCredentials(input.identifier, input.password)),
      changeAdminPassword: publicProcedure.input(z.object({
        userId: z.number().int().positive(),
        currentPassword: z.string().min(1).max(128),
        nextPassword: z.string().min(8).max(128),
      })).mutation(async ({ input }) => {
        await db.changeLocalAdminPassword(input.userId, input.currentPassword, input.nextPassword);
        return { changed: true };
      }),
      registerFaculty: superAdminProcedure.input(z.object({
        fullName: z.string().min(3).max(255),
        facultyId: z.string().min(1).max(128),
        accessRole: z.enum(["admin", "superadmin"]),
        password: z.string().min(8).max(128),
      })).mutation(async ({ input }) => {
        return db.registerLocalFaculty(input);
      }),
    }),
  }),
  profiles: router({
    self: protectedProcedure.query(async ({ ctx }) => ({
      student: await db.getStudentProfile(ctx.user.id),
      faculty: await db.getFacultyProfile(ctx.user.id),
    })),
    myStudentProfile: protectedProcedure.query(async ({ ctx }) => db.getStudentProfile(ctx.user.id)),
    registerStudent: protectedProcedure.input(z.object({
      fullName: z.string().min(3).max(255),
      enrollmentNumber: z.string().min(4).max(64),
      rollNumber: z.string().min(1).max(64),
      mobileNumber: z.string().min(8).max(32),
      parentMobileNumber: z.string().min(8).max(32),
      classDivision: z.string().min(1).max(128),
    })).mutation(async ({ ctx, input }) => {
      const deviceTag = createDeviceTag(input.enrollmentNumber);
      await db.upsertStudentProfile({ userId: ctx.user.id, ...input, deviceTag });
      return { deviceTag };
    }),
    verifyDeviceSetup: protectedProcedure.mutation(async ({ ctx }) => {
      const student = await db.getStudentProfile(ctx.user.id);
      if (!student) throw new TRPCError({ code: "NOT_FOUND", message: "Student profile was not found" });
      await db.markDeviceVerified(ctx.user.id);
      return { verified: true };
    }),
    faculty: router({
      list: superAdminProcedure.query(() => db.listFacultyProfiles()),
      upsert: superAdminProcedure.input(z.object({
        userId: z.number().int().positive(),
        fullName: z.string().min(3).max(255),
        accessRole: z.enum(["admin", "superadmin"]),
        active: z.boolean(),
      })).mutation(async ({ input }) => {
        await db.upsertFacultyProfile(input);
        return { saved: true };
      }),
      setActive: superAdminProcedure.input(z.object({ userId: z.number().int().positive(), active: z.boolean() })).mutation(async ({ input }) => {
        await db.setFacultyActive(input.userId, input.active);
        return { saved: true };
      }),
    }),
  }),
  catalog: router({
    list: facultyProcedure.query(({ ctx }) => db.listAdminSubjects(ctx.user.id)),
    listAll: protectedProcedure.query(() => db.listAllSubjects()),
    create: facultyProcedure.input(z.object({
      name: z.string().min(2).max(255),
      code: z.string().min(2).max(64),
      classDivision: z.string().min(1).max(128),
      teacherName: z.string().min(2).max(255),
      room: z.string().min(1).max(128),
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    }).refine((item) => item.startTime < item.endTime, { message: "End time must be after start time" })).mutation(async ({ ctx, input }) => ({
      subjectId: await db.createAdminSubject({ ...input, code: input.code.toUpperCase(), assignedAdminId: ctx.user.id }),
    })),
    update: facultyProcedure.input(z.object({
      id: z.number().int().positive(),
      name: z.string().min(2).max(255),
      code: z.string().min(2).max(64),
      classDivision: z.string().min(1).max(128),
      teacherName: z.string().min(2).max(255),
      room: z.string().min(1).max(128),
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    }).refine((item) => item.startTime < item.endTime, { message: "End time must be after start time" })).mutation(async ({ ctx, input }) => {
      await db.updateAdminSubject({ ...input, code: input.code.toUpperCase(), assignedAdminId: ctx.user.id });
      return { saved: true };
    }),
    delete: facultyProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await db.deleteAdminSubject(input.id, ctx.user.id);
      return { deleted: true };
    }),
  }),
  testing: router({
    status: publicProcedure.query(() => db.getBackendTestStatus()),
  }),
  attendance: router({
    setupDevice: protectedProcedure.input(z.object({ enrollmentNumber: z.string().min(4).max(64) })).mutation(({ input }) => ({ deviceTag: createDeviceTag(input.enrollmentNumber) })),
    startSession: facultyProcedure.input(z.object({ subjectId: z.number().int().positive(), classDivision: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const subject = await db.getSubject(input.subjectId);
      if (!subject || subject.assignedAdminId !== ctx.user.id || subject.classDivision !== input.classDivision) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You cannot start attendance for this subject and class" });
      }
      const code = generateAttendanceCode();
      const codeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const sessionId = await db.createAttendanceSession({
        subjectId: input.subjectId,
        classDivision: input.classDivision,
        adminId: ctx.user.id,
        sessionDate: new Date().toISOString().slice(0, 10),
        attendanceCodeHash: hashAttendanceCode(code),
        codeExpiresAt,
      });
      return { sessionId, code, codeExpiresAt };
    }),
    markByCode: protectedProcedure.input(z.object({ sessionId: z.number().int().positive(), code: z.string().regex(/^\d{6}$/) })).mutation(async ({ ctx, input }) => {
      const student = await db.getStudentProfile(ctx.user.id);
      if (!student) throw new TRPCError({ code: "FORBIDDEN", message: "Student profile is required" });
      const session = await db.getAttendanceSession(input.sessionId);
      if (!session || !canMarkByCode({ suppliedCode: input.code, expectedCodeHash: session.attendanceCodeHash, expiresAt: session.codeExpiresAt, sessionState: session.status })) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The attendance code is incorrect, expired, or inactive" });
      }
      if (student.classDivision !== session.classDivision) throw new TRPCError({ code: "FORBIDDEN", message: "You are not enrolled in this session's class" });
      await db.upsertAttendanceRecord({ sessionId: session.id, studentId: ctx.user.id, status: "present", method: "code" });
      return { marked: true, method: "code" as const };
    }),
    manualReview: facultyProcedure.input(z.object({ sessionId: z.number().int().positive(), studentId: z.number().int().positive(), status: z.enum(["present", "absent", "manual"]), method: z.enum(["bluetooth", "wifi", "code", "manual"]) })).mutation(async ({ ctx, input }) => {
      const session = await db.getAttendanceSession(input.sessionId);
      if (!session || session.adminId !== ctx.user.id || session.status !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "This attendance session is unavailable" });
      await db.upsertAttendanceRecord({ ...input, markedByAdminId: ctx.user.id });
      return { saved: true };
    }),
    matchBluetoothDevices: publicProcedure.input(z.object({
      classDivision: z.string().min(1).max(128),
      deviceTags: z.array(z.string().regex(/^SM-[A-Z0-9]+$/)).min(1).max(100),
      adminPassword: z.string().min(1).max(128),
    })).mutation(async ({ input }) => {
      const administrator = await db.loginWithLocalCredentials("ADMIN", input.adminPassword);
      if (administrator.accountType !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      return db.matchStudentsByDeviceTags(input.classDivision, input.deviceTags);
    }),
    closeSession: facultyProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await db.closeAttendanceSession(input.sessionId, ctx.user.id);
      const absenceSmsDetails = await db.getAbsenceSmsDetails(input.sessionId);
      return { closed: true, absenceSmsDetails };
    }),
    sessionRecords: facultyProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const session = await db.getAttendanceSession(input.sessionId);
      if (!session || session.adminId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return db.listRecordsForSession(input.sessionId);
    }),
    studentHistory: protectedProcedure.input(dateRangeSchema).query(({ ctx, input }) => db.listStudentAttendanceHistory(ctx.user.id, input.startDate, input.endDate)),
    dailyAbsences: facultyProcedure.input(dateRangeSchema).query(({ ctx, input }) => db.listDailyAbsences(ctx.user.id, input.startDate, input.endDate)),
    absenceSmsDetails: facultyProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const session = await db.getAttendanceSession(input.sessionId);
      if (!session || session.adminId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      return db.getAbsenceSmsDetails(input.sessionId);
    }),
  }),
  notices: router({
    list: protectedProcedure.input(z.object({ classDivision: z.string().max(128).optional() }).optional()).query(({ input }) => db.listNotices(input?.classDivision)),
    create: facultyProcedure.input(z.object({ title: z.string().min(3).max(255), body: z.string().min(3).max(2000), targetClass: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => ({ noticeId: await db.createNotice({ ...input, sentByAdminId: ctx.user.id }) })),
  }),
  exports: router({
    sessionCsv: facultyProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const session = await db.getAttendanceSession(input.sessionId);
      if (!session || session.adminId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      const rows = await db.listRecordsForSession(input.sessionId);
      const csv = ["studentId,status,method,markedAt", ...rows.map((row) => `${row.studentId},${row.status},${row.method},${row.markedAt.toISOString()}`)].join("\n");
      return { filename: `attendance-session-${input.sessionId}.csv`, content: csv };
    }),
  }),
  students: router({
    listByClass: facultyProcedure.input(z.object({ classDivision: z.string().min(1).max(128) })).query(({ input }) => db.listStudentsByClass(input.classDivision)),
    getDetail: facultyProcedure.input(z.object({ studentUserId: z.number().int().positive() })).query(async ({ input }) => {
      const [profile, attendance] = await Promise.all([
        db.getStudentProfileById(input.studentUserId),
        db.getStudentAttendanceByUserId(input.studentUserId),
      ]);
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Student profile not found" });
      return { profile, attendance };
    }),
    updateProfile: facultyProcedure.input(z.object({
      studentUserId: z.number().int().positive(),
      fullName: z.string().min(2).max(255),
      mobileNumber: z.string().min(8).max(32),
      parentMobileNumber: z.string().min(8).max(32),
      classDivision: z.string().min(1).max(128),
      rollNumber: z.string().min(1).max(64),
    })).mutation(async ({ input }) => {
      await db.updateStudentProfileById(input.studentUserId, input);
      return { saved: true };
    }),
    updateAttendance: facultyProcedure.input(z.object({
      recordId: z.number().int().positive(),
      status: z.enum(["present", "absent", "manual"]),
    })).mutation(async ({ input }) => {
      await db.updateAttendanceRecordStatus(input.recordId, input.status);
      return { saved: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
