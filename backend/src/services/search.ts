import { env } from "../config/env.js";
import { briefCompletion } from "./llm.js";

const BLOCKED_DOMAINS = [
  "linkedin.com",
  "glassdoor.",
  "blind.com",
  "teamblind.com",
  "facebook.com",
  "quora.com",
  "pinterest.com",
  "tiktok.com",
];

function isBlocked(url: string): boolean {
  return BLOCKED_DOMAINS.some((d) => url.includes(d));
}

interface SerperResult {
  snippet?: string;
  title?: string;
  link?: string;
}

async function serperSearch(query: string, num = 5): Promise<SerperResult[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": env.SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { organic?: SerperResult[] };
  return (data.organic || []).filter((r) => r.link);
}

/** Have the LLM generate targeted search queries for interview prep. */
async function generateSearchQueries(
  jobTitle: string,
  company?: string,
): Promise<string[]> {
  try {
    const res = await briefCompletion([
      {
        role: "system",
        content: `You generate Google search queries to help someone prepare for a job interview. Given a job title and company, output 4-6 search queries that would find the most useful interview prep information.

Target these categories:
- Interview experiences and questions asked by past candidates
- The company's engineering culture, values, or team blog posts
- The company's tech stack, architecture, or technical challenges
- Interview process details (rounds, format, what to expect)

Rules:
- Each query should be specific enough to get relevant results
- Use the company name in every query
- Don't include site: restrictions
- Simplify the job title — drop seniority levels and parenthetical subtitles
- Return ONLY a JSON array of strings, no commentary`,
      },
      { role: "user", content: `Job title: ${jobTitle}\nCompany: ${company || "unknown"}` },
    ], 300);

    const content = res.choices[0]?.message?.content?.trim() || "[]";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as string[];
  } catch (err) {
    console.error("[SEARCH] LLM query generation failed:", err);
    return [];
  }
}

/** Fallback queries if the LLM call fails. */
function fallbackQueries(jobTitle: string, company?: string): string[] {
  const short = jobTitle
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\b(senior|junior|staff|principal|lead|intern|sr\.|jr\.)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const c = company || "";
  return [
    `${c} ${short} interview questions experience`,
    `${c} engineering team blog culture tech stack`,
  ];
}

export interface SearchResult {
  urls: Array<{ url: string; title: string; category: "interview" | "culture"; scrapeable: boolean }>;
  snippets: {
    interview: Array<{ content: string; source: string; url: string }>;
    culture: Array<{ content: string; url: string }>;
  };
}

export async function searchInterviewContext(
  jobTitle: string,
  company?: string,
): Promise<SearchResult> {
  const empty: SearchResult = { urls: [], snippets: { interview: [], culture: [] } };
  if (!env.SERPER_API_KEY) return empty;

  try {
    // LLM generates targeted queries
    let queries = await generateSearchQueries(jobTitle, company);
    if (queries.length === 0) {
      queries = fallbackQueries(jobTitle, company);
    }

    console.log(`[SEARCH] Running ${queries.length} queries:`, queries);

    // Run all searches in parallel
    const allSearches = await Promise.all(
      queries.map((q) => serperSearch(q, 5)),
    );

    // Deduplicate by URL, tag each result with which query found it
    const seenUrls = new Set<string>();
    const deduped: Array<SerperResult & { queryIndex: number }> = [];
    for (let i = 0; i < allSearches.length; i++) {
      for (const r of allSearches[i]) {
        if (r.link && !seenUrls.has(r.link)) {
          seenUrls.add(r.link);
          deduped.push({ ...r, queryIndex: i });
        }
      }
    }

    // Split into categories — interview-related vs company/culture
    const interviewResults: Array<SerperResult & { queryIndex: number }> = [];
    const companyResults: Array<SerperResult & { queryIndex: number }> = [];

    for (const r of deduped) {
      const query = queries[r.queryIndex].toLowerCase();
      if (query.includes("interview") || query.includes("question") || query.includes("process") || query.includes("rounds")) {
        interviewResults.push(r);
      } else {
        companyResults.push(r);
      }
    }

    const result: SearchResult = {
      urls: deduped.map((r) => {
        const query = queries[r.queryIndex].toLowerCase();
        const isInterview = query.includes("interview") || query.includes("question") || query.includes("process") || query.includes("rounds");
        return {
          url: r.link!,
          title: r.title || "",
          category: isInterview ? "interview" as const : "culture" as const,
          scrapeable: !isBlocked(r.link!),
        };
      }),
      snippets: {
        interview: interviewResults.map((r) => ({
          content: r.snippet || "",
          source: r.title || "",
          url: r.link || "",
        })),
        culture: companyResults.map((r) => ({
          content: r.snippet || "",
          url: r.link || "",
        })),
      },
    };

    console.log(`[SEARCH] interview=${result.snippets.interview.length} culture=${result.snippets.culture.length} urls=${result.urls.length} (from ${deduped.length} unique results)`);

    return result;
  } catch (err) {
    console.error("[SEARCH] Error:", err);
    return empty;
  }
}
