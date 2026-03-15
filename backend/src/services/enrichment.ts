import { fetchJobPage, extractJobData } from "./scraper.js";
import { searchInterviewContext } from "./search.js";
import type { ScrapedContext, SearchContext } from "../types/index.js";

export interface EnrichmentResult {
  scraped: ScrapedContext;
  searched: SearchContext;
  job_title?: string;
  company?: string;
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
}): Promise<EnrichmentResult> {
  let scraped: ScrapedContext = {};
  let searched: SearchContext = {};

  // Phase 1: Fast fetch — get page title + markdown from Jina (no LLM)
  const page = params.jobUrl
    ? await withTimeout(fetchJobPage(params.jobUrl), "Jina fetch", 10000)
    : null;

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

  // Phase 2: Run LLM extraction + search in parallel
  const [extractedResult, searchResult] = await Promise.all([
    page
      ? withTimeout(extractJobData(page.markdown, params.jobUrl!), "LLM extraction", 30000)
      : Promise.resolve(null),
    quickTitle || quickCompany
      ? withTimeout(
          searchInterviewContext(quickTitle || "", quickCompany),
          "Search",
        )
      : Promise.resolve(null),
  ]);

  scraped = extractedResult || {};
  searched = searchResult || {};

  // Prefer LLM-extracted data > page title > user input
  const job_title = scraped.job_title || quickTitle;
  const company = scraped.company || quickCompany;

  return { scraped, searched, job_title, company };
}
