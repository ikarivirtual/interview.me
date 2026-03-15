import { Router } from "express";
import { pool } from "../config/database.js";
import { chatCompletion } from "../services/llm.js";
import type { ChatBody, Message } from "../types/index.js";
import type OpenAI from "openai";

const router = Router();

// POST /api/chat — Send user message, stream LLM response via SSE
router.post("/", async (req, res, next) => {
  try {
    const { session_id, content } = req.body as ChatBody;
    if (!session_id || !content) {
      res.status(400).json({ error: "session_id and content are required" });
      return;
    }

    // Verify session is active
    const sessionResult = await pool.query(
      `SELECT status FROM sessions WHERE id = $1`,
      [session_id],
    );
    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    if (sessionResult.rows[0].status !== "active") {
      res.status(400).json({ error: "Session is not active" });
      return;
    }

    // Store user message
    console.log(`[CHAT] session=${session_id.slice(0, 8)}… user: "${content.slice(0, 100)}${content.length > 100 ? "…" : ""}"`);
    await pool.query(
      `INSERT INTO messages (session_id, role, content) VALUES ($1, 'user', $2)`,
      [session_id, content],
    );

    // Fetch full conversation history
    const messagesResult = await pool.query<Message>(
      `SELECT role, content FROM messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [session_id],
    );

    const llmMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
      messagesResult.rows.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));

    // Set up SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const llmStart = Date.now();
    const stream = await chatCompletion(llmMessages);
    let fullContent = "";

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        fullContent += token;
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }
    }

    // Store assistant message
    console.log(`[CHAT] session=${session_id.slice(0, 8)}… assistant (${Date.now() - llmStart}ms): "${fullContent.slice(0, 120)}…"`);
    const msgResult = await pool.query<Message>(
      `INSERT INTO messages (session_id, role, content) VALUES ($1, 'assistant', $2) RETURNING id`,
      [session_id, fullContent],
    );

    res.write(
      `data: ${JSON.stringify({ done: true, messageId: msgResult.rows[0].id })}\n\n`,
    );
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      console.error("SSE stream error:", err);
      res.end();
    }
  }
});

export default router;
