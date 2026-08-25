import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import xlsx from "xlsx";
import pg from "pg";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const workbookPath = path.resolve(ROOT, "tuition_school_dummy_data.xlsx");
const schemaPath = path.resolve(ROOT, "db", "schema.sql");
const { Pool } = pg;

function normalizeKey(key) {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function pick(row, candidates, fallback = "") {
  const entries = Object.entries(row || {});
  const normalized = Object.fromEntries(entries.map(([k, v]) => [normalizeKey(k), v]));
  for (const c of candidates) {
    const value = normalized[normalizeKey(c)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return fallback;
}

function parseDate(value) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.valueOf())) return null;
  return dt.toISOString().slice(0, 10);
}

function parseIntOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000,
    keepAlive: true,
  });

  if (!fs.existsSync(workbookPath)) {
    throw new Error(`Excel file not found: ${workbookPath}`);
  }
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  const schema = fs.readFileSync(schemaPath, "utf8");
  const workbook = xlsx.readFile(workbookPath);

  const classesRows = xlsx.utils.sheet_to_json(workbook.Sheets.Classes || {}, { defval: "" });
  const teachersRows = xlsx.utils.sheet_to_json(workbook.Sheets.Teachers || {}, { defval: "" });
  const studentsRows = xlsx.utils.sheet_to_json(workbook.Sheets.Students || {}, { defval: "" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(schema);

    const teacherMap = new Map();
    for (const row of teachersRows) {
      const teacherCode = pick(row, ["teacher_code", "teachercode", "code"]);
      if (!teacherCode) continue;

      const fullName = pick(row, ["full_name", "fullname", "teacher_name", "name"], teacherCode);
      const email = pick(row, ["email"], "");
      const phone = pick(row, ["phone", "contact", "contact_number"], "");
      const subject = pick(row, ["subject_specialty", "specialty", "subject", "subjects"], "");
      const joinDate = parseDate(pick(row, ["join_date", "joindate", "joined_on"], ""));
      const status = pick(row, ["status"], "Active") || "Active";

      const inserted = await client.query(
        `INSERT INTO teachers (teacher_code, full_name, email, phone, subject_specialty, join_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING teacher_id, teacher_code`,
        [teacherCode, fullName, email, phone, subject, joinDate || new Date().toISOString().slice(0, 10), status]
      );
      teacherMap.set(teacherCode.toLowerCase(), inserted.rows[0].teacher_id);
    }

    const classMap = new Map();
    for (const row of classesRows) {
      const classCode = pick(row, ["class_code", "classcode", "code"]);
      if (!classCode) continue;

      const className = pick(row, ["class_name", "classname", "name"], classCode);
      const subjects = pick(row, ["subjects", "subject"], "");
      const days = pick(row, ["schedule_days", "scheduledays", "day", "days"], "");
      const time = pick(row, ["schedule_time", "scheduletime", "time"], "");
      const room = pick(row, ["room", "location"], "");
      const teacherCode = pick(row, ["teacher_code", "teacher", "assigned_teacher"], "");
      const status = pick(row, ["status"], "Active") || "Active";
      const teacherId = teacherMap.get(teacherCode.toLowerCase()) || null;

      const inserted = await client.query(
        `INSERT INTO classes (class_code, class_name, subjects, schedule_days, schedule_time, room, teacher_id, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING class_id, class_code, teacher_id`,
        [classCode, className, subjects, days, time, room, teacherId, status]
      );
      classMap.set(classCode.toLowerCase(), inserted.rows[0].class_id);

      if (teacherId) {
        await client.query("UPDATE teachers SET class_id = $1 WHERE teacher_id = $2", [inserted.rows[0].class_id, teacherId]);
      }
    }

    for (const row of studentsRows) {
      const studentCode = pick(row, ["student_code", "studentcode", "code"]);
      if (!studentCode) continue;

      const fullName = pick(row, ["full_name", "fullname", "student_name", "name"], studentCode);
      const gender = pick(row, ["gender"], "");
      const age = parseIntOrNull(pick(row, ["age"], ""));
      const classCode = pick(row, ["class_code", "class", "classcode"], "");
      const classId = classMap.get(classCode.toLowerCase());
      if (!classId) {
        continue;
      }

      const guardianName = pick(row, ["guardian_name", "guardian", "parent_name"], "");
      const guardianPhone = pick(row, ["guardian_phone", "guardianphone", "parent_phone"], "");
      const guardianEmail = pick(row, ["guardian_email", "guardianemail", "parent_email"], "");
      const enrolDate = parseDate(pick(row, ["enrolment_date", "enrollment_date", "enrol_date"], ""));
      const status = pick(row, ["status"], "Active") || "Active";

      await client.query(
        `INSERT INTO students
        (student_code, full_name, gender, age, class_id, guardian_name, guardian_phone, guardian_email, enrolment_date, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          studentCode,
          fullName,
          gender,
          age,
          classId,
          guardianName,
          guardianPhone,
          guardianEmail,
          enrolDate || new Date().toISOString().slice(0, 10),
          status,
        ]
      );
    }

    await client.query("COMMIT");
    console.log("Seed completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
