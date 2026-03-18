import { Router } from "express";
import { env } from "../config/env.js";

const router = Router();

const VOICE_ID = "g6xIsTj2HwM6VR4iXFCw";
const MODEL_ID = "eleven_flash_v2_5";

// POST /api/tts — Convert text to speech via ElevenLabs streaming API
router.post("/", async (req, res, next) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    if (!env.ELEVENLABS_API_KEY) {
      res.status(503).json({ error: "TTS not configured" });
      return;
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_24000_48&optimize_streaming_latency=3`,
      {
        method: "POST",
        headers: {
          "xi-api-key": env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            speed: 1.0,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[TTS] ElevenLabs error ${response.status}: ${errorText}`);
      res.status(502).json({ error: "TTS generation failed" });
      return;
    }

    if (!response.body) {
      res.status(502).json({ error: "No audio stream returned" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    });

    const reader = response.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.writableEnded) {
          res.write(Buffer.from(value));
        }
      }
      res.end();
    };

    res.on("close", () => {
      reader.cancel().catch(() => {});
    });

    await pump();
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      console.error("[TTS] Stream error:", err);
      res.end();
    }
  }
});

export default router;
