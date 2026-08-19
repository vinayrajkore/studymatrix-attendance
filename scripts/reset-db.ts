/**
 * reset-db.ts
 * Clears ALL data and resets the default admin (ADMIN@ICRE / icre@2026).
 * Run with:  npx tsx scripts/reset-db.ts
 */
import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  users,
  localCredentials,
  studentProfiles,
  facultyProfiles,
  attendanceSessions,
  attendanceRecords,
  subjects,
  notices,
} from "../drizzle/schema";

// ── Load .env manually ──────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx === -1) continue;
    const key = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not found in .env");

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const digest = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

const conn = await mysql.createConnection(DATABASE_URL + "?ssl-mode=REQUIRED");
const db = drizzle(conn);

console.log("\n⚠️  Resetting database — clearing all rows...\n");

await db.delete(attendanceRecords);  console.log("✅ Cleared attendance_records");
await db.delete(attendanceSessions); console.log("✅ Cleared attendance_sessions");
await db.delete(studentProfiles);    console.log("✅ Cleared student_profiles");
await db.delete(facultyProfiles);    console.log("✅ Cleared faculty_profiles");
await db.delete(localCredentials);   console.log("✅ Cleared local_credentials");
await db.delete(subjects);           console.log("✅ Cleared subjects (catalog)");
await db.delete(notices);            console.log("✅ Cleared notices");
await db.delete(users);              console.log("✅ Cleared users");

// ── Re-create the default admin ──────────────────────────────────────────────
console.log("\n🔧 Creating default admin (ADMIN@ICRE / icre@2026)...");

const [{ insertId: userId }] = await conn.execute(
  `INSERT INTO users (open_id, name, login_method, role, last_signed_in)
   VALUES ('local-admin', 'ICRE Administrator', 'local-password', 'admin', NOW())`
);

await conn.execute(
  `INSERT INTO local_credentials (user_id, identifier, account_type, password_hash, must_change_password)
   VALUES (?, 'ADMIN@ICRE', 'admin', ?, 1)`,
  [userId, hashPassword("icre@2026")]
);

console.log("✅ Default admin created");
console.log("\n🎉 Done!\n");
console.log("   Login ID : ADMIN@ICRE");
console.log("   Password : icre@2026");
console.log("   (App will prompt you to change it on first login)\n");

await conn.end();
