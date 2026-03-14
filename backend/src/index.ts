import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { migrate } from "./db/migrate.js";
import { errorHandler } from "./middleware/errorHandler.js";
import sessionsRouter from "./routes/sessions.js";
import chatRouter from "./routes/chat.js";
import reportsRouter from "./routes/reports.js";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/sessions", sessionsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/sessions", reportsRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Error handler
app.use(errorHandler);

async function start() {
  try {
    await migrate();
    app.listen(env.PORT, () => {
      console.log(`Backend listening on port ${env.PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();
