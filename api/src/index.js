import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { pool, query } from "./db.js";
import { isValidEmail, parseId, parseOptionalInt, requireFields } from "./validation.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const corsOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.includes("*") ? "*" : corsOrigins,
  })
);
app.use(express.json());

function fail(res, code, message) {
  return res.status(code).json({ error: message });
}

function handleDbError(res, error) {
  if (error?.code === "23505") {
    return fail(res, 409, "Unique constraint violation");
  }
  if (error?.code === "23503") {
    return fail(res, 400, "Invalid relationship reference");
  }
  console.error(error);
  return fail(res, 500, "Internal server error");
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/db-check", async (_req, res) => {
  try {
    const result = await query("SELECT NOW() AS now");
    res.json({ now: result.rows[0].now });
  } catch (error) {
    handleDbError(res, error);
  }
});

app.get("/api/dashboard", async (_req, res) => {
  try {
    const [classes, teachers, students] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM classes"),
      query("SELECT COUNT(*)::int AS count FROM teachers"),
      query("SELECT COUNT(*)::int AS count FROM students"),
    ]);
    res.json({
      classes: classes.rows[0].count,
      teachers: teachers.rows[0].count,
      students: students.rows[0].count,
    });
  } catch (error) {
    handleDbError(res, error);
  }
});

app.get("/api/classes", async (_req, res) => {
  try {
    const result = await query(
      `SELECT c.*, t.full_name AS teacher_name, COUNT(s.student_id)::int AS student_count
       FROM classes c
       LEFT JOIN teachers t ON t.teacher_id = c.teacher_id
       LEFT JOIN students s ON s.class_id = c.class_id
       GROUP BY c.class_id, t.teacher_id
       ORDER BY c.class_id`
    );
    res.json(result.rows);
  } catch (error) {
    handleDbError(res, error);
  }
});

app.get("/api/classes/:id", async (req, res) => {
  try {
    const classId = parseId(req.params.id);
    const classResult = await query(
      `SELECT c.*, t.full_name AS teacher_name, t.email AS teacher_email, t.phone AS teacher_phone
       FROM classes c
       LEFT JOIN teachers t ON t.teacher_id = c.teacher_id
       WHERE c.class_id = $1`,
      [classId]
    );
    if (!classResult.rowCount) return fail(res, 404, "Class not found");

    const students = await query(
      `SELECT student_id, student_code, full_name, gender, age, status
       FROM students WHERE class_id = $1 ORDER BY student_code`,
      [classId]
    );

    res.json({ ...classResult.rows[0], students: students.rows });
  } catch (error) {
    if (error.message?.includes("id must")) return fail(res, 400, error.message);
    handleDbError(res, error);
  }
});

app.get("/api/classes/:id/next-student-code", async (req, res) => {
  try {
    const classId = parseId(req.params.id);
    const classData = await query("SELECT class_code FROM classes WHERE class_id = $1", [classId]);
    if (!classData.rowCount) return fail(res, 404, "Class not found");

    const countData = await query("SELECT COUNT(*)::int AS count FROM students WHERE class_id = $1", [classId]);
    const next = String(countData.rows[0].count + 1).padStart(2, "0");
    res.json({ student_code: `${classData.rows[0].class_code}-student${next}` });
  } catch (error) {
    if (error.message?.includes("id must")) return fail(res, 400, error.message);
    handleDbError(res, error);
  }
});

app.post("/api/classes", async (req, res) => {
  const requiredError = requireFields(req.body, ["class_code", "class_name"]);
  if (requiredError) return fail(res, 400, requiredError);

  let teacherId;
  try {
    teacherId = parseOptionalInt(req.body.teacher_id, "teacher_id");
  } catch (error) {
    return fail(res, 400, error.message);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (teacherId !== null) {
      const teacher = await client.query("SELECT teacher_id, class_id FROM teachers WHERE teacher_id = $1", [teacherId]);
      if (!teacher.rowCount) {
        await client.query("ROLLBACK");
        return fail(res, 400, "teacher_id does not exist");
      }
      if (teacher.rows[0].class_id !== null) {
        await client.query("ROLLBACK");
        return fail(res, 409, "Teacher is already assigned to another class");
      }
    }

    const inserted = await client.query(
      `INSERT INTO classes
      (class_code, class_name, subjects, schedule_days, schedule_time, room, teacher_id, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        req.body.class_code,
        req.body.class_name,
        req.body.subjects || "",
        req.body.schedule_days || "",
        req.body.schedule_time || "",
        req.body.room || "",
        teacherId,
        req.body.status || "Active",
      ]
    );

    if (teacherId !== null) {
      await client.query("UPDATE teachers SET class_id = $1 WHERE teacher_id = $2", [inserted.rows[0].class_id, teacherId]);
    }

    await client.query("COMMIT");
    res.status(201).json(inserted.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    handleDbError(res, error);
  } finally {
    client.release();
  }
});

app.put("/api/classes/:id", async (req, res) => {
  const requiredError = requireFields(req.body, ["class_code", "class_name"]);
  if (requiredError) return fail(res, 400, requiredError);

  let classId;
  let teacherId;
  try {
    classId = parseId(req.params.id);
    teacherId = parseOptionalInt(req.body.teacher_id, "teacher_id");
  } catch (error) {
    return fail(res, 400, error.message);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT * FROM classes WHERE class_id = $1", [classId]);
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Class not found");
    }

    const oldTeacherId = existing.rows[0].teacher_id;

    if (teacherId !== null) {
      const teacher = await client.query("SELECT teacher_id, class_id FROM teachers WHERE teacher_id = $1", [teacherId]);
      if (!teacher.rowCount) {
        await client.query("ROLLBACK");
        return fail(res, 400, "teacher_id does not exist");
      }
      if (teacher.rows[0].class_id !== null && teacher.rows[0].class_id !== classId) {
        await client.query("ROLLBACK");
        return fail(res, 409, "Teacher is already assigned to another class");
      }
    }

    const updated = await client.query(
      `UPDATE classes SET
       class_code=$1, class_name=$2, subjects=$3, schedule_days=$4,
       schedule_time=$5, room=$6, teacher_id=$7, status=$8
       WHERE class_id = $9
       RETURNING *`,
      [
        req.body.class_code,
        req.body.class_name,
        req.body.subjects || "",
        req.body.schedule_days || "",
        req.body.schedule_time || "",
        req.body.room || "",
        teacherId,
        req.body.status || "Active",
        classId,
      ]
    );

    if (oldTeacherId && oldTeacherId !== teacherId) {
      await client.query("UPDATE teachers SET class_id = NULL WHERE teacher_id = $1", [oldTeacherId]);
    }
    if (teacherId !== null) {
      await client.query("UPDATE teachers SET class_id = $1 WHERE teacher_id = $2", [classId, teacherId]);
    }

    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    handleDbError(res, error);
  } finally {
    client.release();
  }
});

app.delete("/api/classes/:id", async (req, res) => {
  let classId;
  try {
    classId = parseId(req.params.id);
  } catch (error) {
    return fail(res, 400, error.message);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const found = await client.query("SELECT class_id, teacher_id FROM classes WHERE class_id = $1", [classId]);
    if (!found.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Class not found");
    }

    const studentCount = await client.query("SELECT COUNT(*)::int AS count FROM students WHERE class_id = $1", [classId]);
    if (studentCount.rows[0].count > 0) {
      await client.query("ROLLBACK");
      return fail(res, 409, "Cannot delete class with enrolled students. Reassign or delete students first.");
    }

    if (found.rows[0].teacher_id) {
      await client.query("UPDATE teachers SET class_id = NULL WHERE teacher_id = $1", [found.rows[0].teacher_id]);
    }

    await client.query("DELETE FROM classes WHERE class_id = $1", [classId]);
    await client.query("COMMIT");

    res.json({ message: "Class deleted" });
  } catch (error) {
    await client.query("ROLLBACK");
    handleDbError(res, error);
  } finally {
    client.release();
  }
});

app.get("/api/teachers", async (_req, res) => {
  try {
    const result = await query(
      `SELECT t.*, c.class_code, c.class_name
       FROM teachers t
       LEFT JOIN classes c ON c.class_id = t.class_id
       ORDER BY t.teacher_id`
    );
    res.json(result.rows);
  } catch (error) {
    handleDbError(res, error);
  }
});

app.get("/api/teachers/:id", async (req, res) => {
  try {
    const teacherId = parseId(req.params.id);
    const result = await query(
      `SELECT t.*, c.class_code, c.class_name
       FROM teachers t
       LEFT JOIN classes c ON c.class_id = t.class_id
       WHERE t.teacher_id = $1`,
      [teacherId]
    );

    if (!result.rowCount) return fail(res, 404, "Teacher not found");
    res.json(result.rows[0]);
  } catch (error) {
    if (error.message?.includes("id must")) return fail(res, 400, error.message);
    handleDbError(res, error);
  }
});

app.post("/api/teachers", async (req, res) => {
  const requiredError = requireFields(req.body, ["teacher_code", "full_name"]);
  if (requiredError) return fail(res, 400, requiredError);
  if (!isValidEmail(req.body.email)) return fail(res, 400, "email must be valid");

  let classId;
  try {
    classId = parseOptionalInt(req.body.class_id, "class_id");
  } catch (error) {
    return fail(res, 400, error.message);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (classId !== null) {
      const cls = await client.query("SELECT class_id, teacher_id FROM classes WHERE class_id = $1", [classId]);
      if (!cls.rowCount) {
        await client.query("ROLLBACK");
        return fail(res, 400, "class_id does not exist");
      }
      if (cls.rows[0].teacher_id !== null) {
        await client.query("ROLLBACK");
        return fail(res, 409, "Class already has a teacher");
      }
    }

    const inserted = await client.query(
      `INSERT INTO teachers
      (teacher_code, full_name, email, phone, subject_specialty, class_id, join_date, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        req.body.teacher_code,
        req.body.full_name,
        req.body.email || "",
        req.body.phone || "",
        req.body.subject_specialty || "",
        classId,
        req.body.join_date || new Date().toISOString().slice(0, 10),
        req.body.status || "Active",
      ]
    );

    if (classId !== null) {
      await client.query("UPDATE classes SET teacher_id = $1 WHERE class_id = $2", [inserted.rows[0].teacher_id, classId]);
    }

    await client.query("COMMIT");
    res.status(201).json(inserted.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    handleDbError(res, error);
  } finally {
    client.release();
  }
});

app.put("/api/teachers/:id", async (req, res) => {
  const requiredError = requireFields(req.body, ["teacher_code", "full_name"]);
  if (requiredError) return fail(res, 400, requiredError);
  if (!isValidEmail(req.body.email)) return fail(res, 400, "email must be valid");

  let teacherId;
  let classId;
  try {
    teacherId = parseId(req.params.id);
    classId = parseOptionalInt(req.body.class_id, "class_id");
  } catch (error) {
    return fail(res, 400, error.message);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT * FROM teachers WHERE teacher_id = $1", [teacherId]);
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Teacher not found");
    }

    const oldClassId = existing.rows[0].class_id;

    if (classId !== null) {
      const cls = await client.query("SELECT class_id, teacher_id FROM classes WHERE class_id = $1", [classId]);
      if (!cls.rowCount) {
        await client.query("ROLLBACK");
        return fail(res, 400, "class_id does not exist");
      }
      if (cls.rows[0].teacher_id !== null && cls.rows[0].teacher_id !== teacherId) {
        await client.query("ROLLBACK");
        return fail(res, 409, "Class already has a different teacher");
      }
    }

    const updated = await client.query(
      `UPDATE teachers SET
        teacher_code=$1, full_name=$2, email=$3, phone=$4,
        subject_specialty=$5, class_id=$6, join_date=$7, status=$8
       WHERE teacher_id=$9
       RETURNING *`,
      [
        req.body.teacher_code,
        req.body.full_name,
        req.body.email || "",
        req.body.phone || "",
        req.body.subject_specialty || "",
        classId,
        req.body.join_date || new Date().toISOString().slice(0, 10),
        req.body.status || "Active",
        teacherId,
      ]
    );

    if (oldClassId && oldClassId !== classId) {
      await client.query("UPDATE classes SET teacher_id = NULL WHERE class_id = $1", [oldClassId]);
    }
    if (classId !== null) {
      await client.query("UPDATE classes SET teacher_id = $1 WHERE class_id = $2", [teacherId, classId]);
    }

    await client.query("COMMIT");
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    handleDbError(res, error);
  } finally {
    client.release();
  }
});

app.delete("/api/teachers/:id", async (req, res) => {
  let teacherId;
  try {
    teacherId = parseId(req.params.id);
  } catch (error) {
    return fail(res, 400, error.message);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const found = await client.query("SELECT teacher_id FROM teachers WHERE teacher_id = $1", [teacherId]);
    if (!found.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Teacher not found");
    }

    await client.query("UPDATE classes SET teacher_id = NULL WHERE teacher_id = $1", [teacherId]);
    await client.query("DELETE FROM teachers WHERE teacher_id = $1", [teacherId]);

    await client.query("COMMIT");
    res.json({ message: "Teacher deleted and unassigned from class" });
  } catch (error) {
    await client.query("ROLLBACK");
    handleDbError(res, error);
  } finally {
    client.release();
  }
});

app.get("/api/students", async (req, res) => {
  try {
    let classId = null;
    if (req.query.class_id !== undefined && req.query.class_id !== "") {
      classId = parseId(req.query.class_id, "class_id");
    }

    const sql =
      classId === null
        ? `SELECT s.*, c.class_code, c.class_name
           FROM students s
           JOIN classes c ON c.class_id = s.class_id
           ORDER BY s.student_id`
        : `SELECT s.*, c.class_code, c.class_name
           FROM students s
           JOIN classes c ON c.class_id = s.class_id
           WHERE s.class_id = $1
           ORDER BY s.student_id`;

    const result = classId === null ? await query(sql) : await query(sql, [classId]);
    res.json(result.rows);
  } catch (error) {
    if (error.message?.includes("class_id must")) return fail(res, 400, error.message);
    handleDbError(res, error);
  }
});

app.get("/api/students/:id", async (req, res) => {
  try {
    const studentId = parseId(req.params.id);
    const result = await query(
      `SELECT s.*, c.class_code, c.class_name
       FROM students s
       JOIN classes c ON c.class_id = s.class_id
       WHERE s.student_id = $1`,
      [studentId]
    );

    if (!result.rowCount) return fail(res, 404, "Student not found");
    res.json(result.rows[0]);
  } catch (error) {
    if (error.message?.includes("id must")) return fail(res, 400, error.message);
    handleDbError(res, error);
  }
});

app.post("/api/students", async (req, res) => {
  const requiredError = requireFields(req.body, ["student_code", "full_name", "class_id"]);
  if (requiredError) return fail(res, 400, requiredError);
  if (!isValidEmail(req.body.guardian_email)) return fail(res, 400, "guardian_email must be valid");

  let classId;
  let age;
  try {
    classId = parseId(req.body.class_id, "class_id");
    age = parseOptionalInt(req.body.age, "age");
  } catch (error) {
    return fail(res, 400, error.message);
  }

  try {
    const result = await query(
      `INSERT INTO students
      (student_code, full_name, gender, age, class_id, guardian_name, guardian_phone, guardian_email, enrolment_date, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        req.body.student_code,
        req.body.full_name,
        req.body.gender || "",
        age,
        classId,
        req.body.guardian_name || "",
        req.body.guardian_phone || "",
        req.body.guardian_email || "",
        req.body.enrolment_date || new Date().toISOString().slice(0, 10),
        req.body.status || "Active",
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    handleDbError(res, error);
  }
});

app.put("/api/students/:id", async (req, res) => {
  const requiredError = requireFields(req.body, ["student_code", "full_name", "class_id"]);
  if (requiredError) return fail(res, 400, requiredError);
  if (!isValidEmail(req.body.guardian_email)) return fail(res, 400, "guardian_email must be valid");

  let studentId;
  let classId;
  let age;
  try {
    studentId = parseId(req.params.id);
    classId = parseId(req.body.class_id, "class_id");
    age = parseOptionalInt(req.body.age, "age");
  } catch (error) {
    return fail(res, 400, error.message);
  }

  try {
    const result = await query(
      `UPDATE students SET
      student_code=$1, full_name=$2, gender=$3, age=$4, class_id=$5,
      guardian_name=$6, guardian_phone=$7, guardian_email=$8,
      enrolment_date=$9, status=$10
      WHERE student_id=$11
      RETURNING *`,
      [
        req.body.student_code,
        req.body.full_name,
        req.body.gender || "",
        age,
        classId,
        req.body.guardian_name || "",
        req.body.guardian_phone || "",
        req.body.guardian_email || "",
        req.body.enrolment_date || new Date().toISOString().slice(0, 10),
        req.body.status || "Active",
        studentId,
      ]
    );

    if (!result.rowCount) return fail(res, 404, "Student not found");
    res.json(result.rows[0]);
  } catch (error) {
    handleDbError(res, error);
  }
});

app.delete("/api/students/:id", async (req, res) => {
  let studentId;
  try {
    studentId = parseId(req.params.id);
  } catch (error) {
    return fail(res, 400, error.message);
  }

  try {
    const result = await query("DELETE FROM students WHERE student_id = $1 RETURNING student_id", [studentId]);
    if (!result.rowCount) return fail(res, 404, "Student not found");
    res.json({ message: "Student deleted" });
  } catch (error) {
    handleDbError(res, error);
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
