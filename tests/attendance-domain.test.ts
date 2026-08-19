import { describe, expect, it } from "vitest";
import { canMarkByCode, createDeviceTag, generateAttendanceCode, hashAttendanceCode, isFacultyRole } from "../shared/attendance-domain";

describe("attendance domain rules", () => {
  it("creates a stable device tag from a normalized enrollment number", () => {
    expect(createDeviceTag(" 21-ce/045 ")).toBe("SM-21CE045");
  });

  it("rejects a device tag with an unusably short enrollment number", () => {
    expect(() => createDeviceTag("12")).toThrow("Enrollment number is invalid");
  });

  it("generates a six-digit attendance code", () => {
    expect(generateAttendanceCode(() => 0)).toBe("100000");
    expect(generateAttendanceCode(() => 0.999999)).toBe("999999");
  });

  it("allows only valid, active, unexpired attendance code submissions", () => {
    const now = new Date("2026-08-18T10:00:00.000Z");
    const expectedCodeHash = hashAttendanceCode("462913");
    expect(canMarkByCode({ suppliedCode: "462913", expectedCodeHash, expiresAt: new Date("2026-08-18T10:10:00.000Z"), sessionState: "active", now })).toBe(true);
    expect(canMarkByCode({ suppliedCode: "462912", expectedCodeHash, expiresAt: new Date("2026-08-18T10:10:00.000Z"), sessionState: "active", now })).toBe(false);
    expect(canMarkByCode({ suppliedCode: "462913", expectedCodeHash, expiresAt: new Date("2026-08-18T09:59:00.000Z"), sessionState: "active", now })).toBe(false);
    expect(canMarkByCode({ suppliedCode: "462913", expectedCodeHash, expiresAt: new Date("2026-08-18T10:10:00.000Z"), sessionState: "closed", now })).toBe(false);
  });

  it("limits session administration to faculty roles", () => {
    expect(isFacultyRole("student")).toBe(false);
    expect(isFacultyRole("admin")).toBe(true);
    expect(isFacultyRole("superadmin")).toBe(true);
  });
});
