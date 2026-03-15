import { env } from "../config/env.js";
import { openai } from "./llm.js";
import type { ScrapedContext } from "../types/index.js";

const MODEL = "glm-5";

export interface JinaResult {
  title: string;
  markdown: string;
}

/** Fast fetch — returns page title + markdown without LLM. */
export async function fetchJobPage(url: string): Promise<JinaResult | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Remove-Selector": "nav, footer, .sidebar, .ads, .cookie-banner",
    };
    if (env.JINA_API_KEY) {
      headers["Authorization"] = `Bearer ${env.JINA_API_KEY}`;
    }

    const response = await fetch(`https://r.jina.ai/${url}`, { headers });
    if (!response.ok) {
      console.error(`Jina Reader returned ${response.status} for ${url}`);
      return null;
    }

    const json = await response.json() as {
      data?: { content?: string; title?: string };
    };
    const markdown = json.data?.content || "";
    if (!markdown.trim()) return null;

    return {
      title: json.data?.title || "",
      markdown: markdown.slice(0, 6000),
    };
  } catch (err) {
    console.error("Jina fetch error:", err);
    return null;
  }
}

/** Slow LLM extraction — parses structured fields from markdown. */
export async function extractJobData(markdown: string, sourceUrl: string): Promise<ScrapedContext> {
  try {
    const extraction = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `Extract structured job posting data from the markdown below. Return ONLY valid JSON with these fields:
{
  "job_title": "string or null",
  "company": "string or null",
  "requirements": ["array of requirement strings"],
  "responsibilities": ["array of responsibility strings"],
  "tech_stack": ["array of technology/tool names"]
}
If a field cannot be determined, use null for strings or [] for arrays.`,
        },
        { role: "user", content: markdown },
      ],
      stream: false,
    });

    const content = extraction.choices[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { raw_markdown: markdown, source_url: sourceUrl };

    const parsed = JSON.parse(jsonMatch[0]) as {
      job_title?: string;
      company?: string;
      requirements?: string[];
      responsibilities?: string[];
      tech_stack?: string[];
    };

    return {
      job_title: parsed.job_title || undefined,
      company: parsed.company || undefined,
      requirements: parsed.requirements || [],
      responsibilities: parsed.responsibilities || [],
      tech_stack: parsed.tech_stack || [],
      raw_markdown: markdown,
      source_url: sourceUrl,
    };
  } catch (err) {
    console.error("LLM extraction error:", err);
    return { raw_markdown: markdown, source_url: sourceUrl };
  }
}
