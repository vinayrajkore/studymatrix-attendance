/**
 * reset-db.mts — ESM script, run with:  npx tsx scripts/reset-db.mts
 */
import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

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

async function main() {
  const conn = await mysql.createConnection({
    uri: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log("\n⚠️  Resetting database — clearing all rows...\n");

  // Delete in safe order (children first)
  await conn.execute("DELETE FROM attendance_records");  console.log("✅ Cleared attendance_records");
  await conn.execute("DELETE FROM attendance_sessions"); console.log("✅ Cleared attendance_sessions");
  await conn.execute("DELETE FROM student_profiles");    console.log("✅ Cleared student_profiles");
  await conn.execute("DELETE FROM faculty_profiles");    console.log("✅ Cleared faculty_profiles");
  await conn.execute("DELETE FROM local_credentials");   console.log("✅ Cleared local_credentials");
  await conn.execute("DELETE FROM subjects");            console.log("✅ Cleared subjects (catalog)");
  await conn.execute("DELETE FROM notices");             console.log("✅ Cleared notices");
  await conn.execute("DELETE FROM users");               console.log("✅ Cleared users");

  // ── Re-create the default admin ────────────────────────────────────────────
  console.log("\n🔧 Creating default admin (ADMIN@ICRE / icre@2026)...");

  const [result] = await conn.execute(
    `INSERT INTO users (openId, name, loginMethod, role, lastSignedIn)
     VALUES ('local-admin', 'ICRE Administrator', 'local-password', 'admin', NOW())`
  ) as any;
  const userId = result.insertId;

  await conn.execute(
    `INSERT INTO local_credentials (userId, identifier, accountType, passwordHash, mustChangePassword)
     VALUES (?, 'ADMIN@ICRE', 'admin', ?, 1)`,
    [userId, hashPassword("icre@2026")]
  );

  console.log("✅ Default admin created");
  console.log("\n🎉 Done!\n");
  console.log("   Login ID : ADMIN@ICRE");
  console.log("   Password : icre@2026");
  console.log("   (App prompts you to change password on first login)\n");

  await conn.end();
}

main().catch((err) => { console.error("❌ Reset failed:", err); process.exit(1); });
