import { Router } from "express";
import { pool } from "../config/database.js";
import { generateReportStream } from "../services/llm.js";
import { reportGenerationPrompt } from "../services/prompts.js";
import type { Report, Session, Message } from "../types/index.js";

const router = Router();

// GET /api/sessions/:id/report — Get report (200 if ready, 202 if generating)
router.get("/:id/report", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check session exists
    const sessionResult = await pool.query(
      `SELECT status FROM sessions WHERE id = $1`,
      [id],
    );
    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const status = sessionResult.rows[0].status;
    if (status === "active") {
      res.status(400).json({ error: "Session is still active" });
      return;
    }

    // Check if report exists
    const reportResult = await pool.query<Report>(
      `SELECT * FROM reports WHERE session_id = $1`,
      [id],
    );

    if (reportResult.rows.length === 0) {
      res.status(202).json({ status: "generating" });
      return;
    }

    res.json({ report: reportResult.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions/:id/report/stream — Stream report generation via SSE
router.get("/:id/report/stream", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if report already exists
    const reportResult = await pool.query<Report>(
      `SELECT * FROM reports WHERE session_id = $1`,
      [id],
    );
    if (reportResult.rows.length > 0) {
      // Report already generated — send it all at once and close
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(`data: ${JSON.stringify({ token: reportResult.rows[0].content })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true, scores: reportResult.rows[0].scores })}\n\n`);
      res.end();
      return;
    }

    // Load session and messages
    const sessionResult = await pool.query<Session>(
      `SELECT * FROM sessions WHERE id = $1`,
      [id],
    );
    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    const session = sessionResult.rows[0];

    if (session.status === "active") {
      res.status(400).json({ error: "Session is still active" });
      return;
    }

    const messagesResult = await pool.query<Message>(
      `SELECT role, content FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [id],
    );

    const nonSystemMessages = messagesResult.rows.filter((m) => m.role !== "system");
    const candidateMessages = nonSystemMessages.filter((m) => m.role === "user");

    // No candidate responses
    if (candidateMessages.length === 0) {
      const markdownContent = "## Interview Not Completed\n\nThe interview ended before any responses were given. Start a new interview and answer the questions to receive a performance report.";
      const scores = { overall: 0, communication: 0, technical_knowledge: 0, problem_solving: 0, professionalism: 0 };
      await pool.query(
        `INSERT INTO reports (session_id, content, scores) VALUES ($1, $2, $3) ON CONFLICT (session_id) DO NOTHING`,
        [id, markdownContent, JSON.stringify(scores)],
      );
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(`data: ${JSON.stringify({ token: markdownContent })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true, scores })}\n\n`);
      res.end();
      return;
    }

    const transcript = nonSystemMessages
      .map((m) => `${m.role === "assistant" ? "Interviewer" : "Candidate"}: ${m.content}`)
      .join("\n\n");

    const systemPrompt = reportGenerationPrompt(session.job_title, session.company);

    // Set up SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const llmStart = Date.now();
    const timeout = setTimeout(() => {
      console.error(`[REPORT] session=${id.slice(0, 8)}… timed out after 60s`);
      res.write(`data: ${JSON.stringify({ error: "Report generation timed out" })}\n\n`);
      res.end();
    }, 60_000);

    const stream = await generateReportStream([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Here is the interview transcript:\n\n${transcript}` },
    ]);

    let fullContent = "";

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        fullContent += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    clearTimeout(timeout);

    console.log(`[REPORT] session=${id.slice(0, 8)}… generated in ${Date.now() - llmStart}ms (${fullContent.length} chars)`);

    // Parse scores
    let scores: Record<string, number> | null = null;
    let markdownContent = fullContent;

    const scoresMatch = fullContent.match(/SCORES_JSON:\s*(\{[^}]+\})/);
    if (scoresMatch) {
      try {
        scores = JSON.parse(scoresMatch[1]);
        markdownContent = fullContent.replace(/SCORES_JSON:\s*\{[^}]+\}/, "").trim();
      } catch {
        // If parsing fails, keep the full content
      }
    }

    // Save to DB
    await pool.query(
      `INSERT INTO reports (session_id, content, scores) VALUES ($1, $2, $3) ON CONFLICT (session_id) DO NOTHING`,
      [id, markdownContent, scores ? JSON.stringify(scores) : null],
    );

    await pool.query(
      `UPDATE sessions SET status = 'report_ready' WHERE id = $1`,
      [id],
    );

    // Send final event with scores
    res.write(`data: ${JSON.stringify({ done: true, scores })}\n\n`);
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      console.error("Report SSE stream error:", err);
      res.end();
    }
  }
});

export default router;
