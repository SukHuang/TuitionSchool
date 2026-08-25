import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: "../api/.env" });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

try {
  const result = await pool.query("SELECT NOW() AS now");
  console.log("DB connection OK:", result.rows[0].now);
} catch (error) {
  console.error("DB connection failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
