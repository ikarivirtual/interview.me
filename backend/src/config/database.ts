import pg from "pg";
import { env } from "./env.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});
