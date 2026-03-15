import { env } from "../config/env.js";
import type { SearchContext } from "../types/index.js";

export async function searchInterviewContext(
  jobTitle: string,
  company?: string,
): Promise<SearchContext> {
  if (!env.SERPER_API_KEY) return {};

  try {
    const companyStr = company || "";
    const headers = {
      "X-API-KEY": env.SERPER_API_KEY,
      "Content-Type": "application/json",
    };

    const [questionsRes, companyRes] = await Promise.all([
      fetch("https://google.serper.dev/search", {
        method: "POST",
        headers,
        body: JSON.stringify({
          q: `${companyStr} ${jobTitle} interview questions site:reddit.com OR site:glassdoor.com OR site:leetcode.com`,
          num: 5,
        }),
      }),
      fetch("https://google.serper.dev/search", {
        method: "POST",
        headers,
        body: JSON.stringify({
          q: `${companyStr} company culture engineering what it's like to work`,
          num: 3,
        }),
      }),
    ]);

    const result: SearchContext = {};

    if (questionsRes.ok) {
      const data = (await questionsRes.json()) as {
        organic?: Array<{ snippet?: string; title?: string; link?: string }>;
      };
      result.interview_questions = (data.organic || []).map((item) => ({
        content: item.snippet || "",
        source: item.title || "",
        url: item.link || "",
      }));
    }

    if (companyRes.ok) {
      const data = (await companyRes.json()) as {
        organic?: Array<{ snippet?: string; link?: string }>;
      };
      result.company_info = (data.organic || []).map((item) => ({
        content: item.snippet || "",
        url: item.link || "",
      }));
    }

    return result;
  } catch (err) {
    console.error("Search error:", err);
    return {};
  }
}
