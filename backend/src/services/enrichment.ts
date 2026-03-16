import { pool } from "../config/database.js";
import { fetchJobPage, extractJobData, companyFromUrl, fetchAndSummarize } from "./scraper.js";
import { searchInterviewContext } from "./search.js";
import { generateInterviewBrief } from "./prompts.js";
import type { EnrichmentContext } from "../types/index.js";
import type { SearchResult } from "./search.js";

export interface EnrichmentResult {
  context: EnrichmentContext;
  job_title?: string;
  company?: string;
  startDeepEnrichment: (sessionId: string) => void;
}

function withTimeout<T>(p: Promise<T>, label: string, ms = 30000): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.catch((err) => { console.error(`${label} error:`, err); return null; }),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        console.error(`${label} timed out after ${ms}ms`);
        resolve(null);
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function enrichSession(params: {
  jobUrl?: string;
  jobTitle?: string;
  company?: string;
  userContext?: string;
}): Promise<EnrichmentResult> {
  const context: EnrichmentContext = {};
  let searchResult: SearchResult | null = null;

  // Phase 1: Fast fetch — get page title + markdown from Jina (no LLM)
  const page = params.jobUrl
    ? await withTimeout(fetchJobPage(params.jobUrl), "Jina fetch", 15000)
    : null;

  // Extract company from URL domain as a reliable fallback
  const urlCompany = params.jobUrl ? companyFromUrl(params.jobUrl) : null;

  // Parse company and title from the page title (e.g. "Zoox - Senior Software Engineer")
  let quickTitle = params.jobTitle;
  let quickCompany = params.company;
  if (page?.title) {
    const parts = page.title.split(/\s[-–|]\s/);
    if (parts.length >= 2) {
      quickCompany = quickCompany || parts[0].trim();
      quickTitle = quickTitle || parts.slice(1).join(" - ").trim();
    } else {
      quickTitle = quickTitle || page.title.trim();
    }
  }
  // Fall back to URL-derived company name
  quickCompany = quickCompany || urlCompany || undefined;

  // Phase 2: Run LLM extraction + search in parallel
  const [extractedResult, searchRaw] = await Promise.all([
    page
      ? withTimeout(extractJobData(page), "LLM extraction", 30000)
      : Promise.resolve(null),
    quickTitle || quickCompany
      ? withTimeout(
          searchInterviewContext(quickTitle || "", quickCompany),
          "Search",
        )
      : Promise.resolve(null),
  ]);

  searchResult = searchRaw;

  // Merge extracted data into context
  if (extractedResult) {
    Object.assign(context, extractedResult);
  }

  // Prefer LLM-extracted data > page title > URL-derived > user input
  const job_title = context.job_title || quickTitle;
  const company = context.company || quickCompany;

  // Build deep enrichment launcher (fire-and-forget)
  const startDeepEnrichment = (sessionId: string): void => {
    const hasContent = searchResult && (
      searchResult.urls.some((u) => u.scrapeable) ||
      searchResult.snippets.interview.length > 0
    );
    if (!hasContent || !searchResult) {
      console.log(`[DEEP-ENRICH] No scrapeable URLs or snippets for session ${sessionId.slice(0, 8)}…`);
      return;
    }

    const scrapeableUrls = searchResult.urls.filter((u) => u.scrapeable).slice(0, 5);
    const interviewSnippets = searchResult.snippets.interview;
    const finalTitle = job_title || "Software Engineer";
    const finalCompany = company || null;
    const userContext = params.userContext;

    // Fire and forget — runs in background
    (async () => {
      try {
        console.log(`[DEEP-ENRICH] Starting background enrichment for session ${sessionId.slice(0, 8)}… (${scrapeableUrls.length} scrapeable URLs, ${interviewSnippets.length} snippets)`);
        const deepStart = Date.now();

        const intel = await fetchAndSummarize(scrapeableUrls, interviewSnippets);

        // Merge intel into the existing context
        const fullContext: EnrichmentContext = { ...context };
        if (intel) {
          fullContext.interview_intel = intel;
        }

        // Generate interview brief with the full context (including deep scrape)
        const brief = await generateInterviewBrief(finalTitle, finalCompany, fullContext, userContext);

        // Update session in DB
        await pool.query(
          `UPDATE sessions SET enrichment_context = $1, interview_brief = $2 WHERE id = $3`,
          [JSON.stringify(fullContext), brief, sessionId],
        );

        console.log(`[DEEP-ENRICH] Completed for session ${sessionId.slice(0, 8)}… in ${Date.now() - deepStart}ms (intel: ${intel ? `${intel.questions.length} questions` : "none"}, brief: ${brief.length} chars)`);
      } catch (err) {
        console.error(`[DEEP-ENRICH] Failed for session ${sessionId.slice(0, 8)}…:`, err);
      }
    })();
  };

  return { context, job_title, company, startDeepEnrichment };
}
