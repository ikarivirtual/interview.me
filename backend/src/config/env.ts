import { config } from "dotenv";
import { resolve } from "path";

// Support both the Docker quick-start root `.env` and the manual setup `backend/.env`.
config({ path: resolve(import.meta.dirname, "../../.env") });
config({ path: resolve(import.meta.dirname, "../../../.env") });

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  DO_MODEL_ACCESS_KEY: required("DO_MODEL_ACCESS_KEY"),
  MODEL_PROMPT: process.env.MODEL_PROMPT || process.env.MODEL || "minimax-m2.5",
  MODEL_INTERVIEW: process.env.MODEL_INTERVIEW || process.env.MODEL || "minimax-m2.5",
  MODEL_REPORT: process.env.MODEL_REPORT || process.env.MODEL || "minimax-m2.5",
  MODEL_BRIEF: process.env.MODEL_BRIEF || "openai-gpt-oss-120b",
  LOG_LLM_PAYLOADS: process.env.LOG_LLM_PAYLOADS === "true",
  PORT: parseInt(process.env.PORT || "3001", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  SERPER_API_KEY: process.env.SERPER_API_KEY || "",
  JINA_API_KEY: process.env.JINA_API_KEY || "",
};
