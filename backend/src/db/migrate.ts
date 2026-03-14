import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
  await pool.query(schema);
  console.log("Database migrations applied successfully");
}
