import OpenAI from "openai";
import { env } from "../config/env.js";

export const openai = new OpenAI({
  baseURL: "https://inference.do-ai.run/v1",
  apiKey: env.DO_MODEL_ACCESS_KEY,
});

const MODEL = "glm-5";

export async function chatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
) {
  return openai.chat.completions.create({
    model: MODEL,
    messages,
    stream: true,
  });
}

export async function generateReportStream(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
) {
  return openai.chat.completions.create({
    model: MODEL,
    messages,
    max_tokens: 2048,
    stream: true,
  });
}
