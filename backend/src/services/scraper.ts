import { env } from "../config/env.js";
import { promptCompletion, briefCompletion } from "./llm.js";

export interface JinaResult {
  title: string;
  markdown: string;
  description: string;
}

/** Extract company name from a URL's hostname (e.g. "stripe.com" → "Stripe"). */
export function companyFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");

    // Known job board domains — company isn't in the hostname
    const jobBoards = [
      "greenhouse.io", "lever.co", "workday.com", "myworkdayjobs.com",
      "smartrecruiters.com", "ashbyhq.com", "jobs.lever.co",
      "boards.greenhouse.io", "linkedin.com", "indeed.com",
      "glassdoor.com", "ziprecruiter.com", "angel.co", "wellfound.com",
      "ycombinator.com", "workatastartup.com",
    ];
    if (jobBoards.some((jb) => hostname === jb || hostname.endsWith(`.${jb}`))) {
      return null;
    }

    // For subdomains like "careers.stripe.com" or "jobs.netflix.com", use the main domain
    const parts = hostname.split(".");
    const domain = parts.length >= 2 ? parts[parts.length - 2] : parts[0];

    // Capitalize first letter
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return null;
  }
}

/** Normalize LinkedIn URLs so we hit the public job view instead of the login wall. */
function normalizeJobUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("linkedin.com")) {
      // /jobs/collections/...?currentJobId=123 → /jobs/view/123
      // /jobs/search/...?currentJobId=123      → /jobs/view/123
      const jobId = parsed.searchParams.get("currentJobId");
      if (jobId) {
        return `https://www.linkedin.com/jobs/view/${jobId}`;
      }
    }
    return url;
  } catch {
    return url;
  }
}

/** Strip generic web noise from scraped markdown (works on any site). */
export function cleanMarkdown(raw: string): string {
  return raw
    // Remove markdown images: ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // Remove markdown links but keep text: [text](url) → text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Remove bare URLs on their own line
    .replace(/^https?:\/\/\S+$/gm, "")
    // Remove common form/auth noise
    .replace(/^(?:First name|Last name|Email|Password.*|Show|Remove photo|Not you\?|New to LinkedIn\?.*)\s*$/gm, "")
    // Remove "By clicking ... Policy." consent blocks
    .replace(/By clicking .*?(?:Policy|Cookie Policy)\.?\s*/gs, "")
    // Remove dangling ", and Cookie Policy." fragments
    .replace(/^,?\s*and Cookie Policy\.?\s*$/gm, "")
    // Remove "Continue with Google/Apple/Email" lines
    .replace(/^.*Continue with (?:Google|Apple|Email).*$/gm, "")
    // Remove "Sign in" / "Join now" / "Forgot password" standalone lines
    .replace(/^\s*(?:Sign in|Join now|Agree & Join|Continue|or|Forgot password\??|Sign in with Email)\s*$/gm, "")
    // Remove "Sign in to ..." / "Join to apply ..." / "Join or sign in" blocks
    .replace(/^(?:Sign in to|Join to apply|Join or sign in).*$/gm, "")
    // Remove "You may also apply directly" lines
    .replace(/^.*You may also apply directly.*$/gm, "")
    // Remove "See who ... has hired" lines
    .replace(/^.*See who .* has hired.*$/gm, "")
    // Remove security verification headers
    .replace(/^Security verification\s*$/gm, "")
    // Remove "Email or phone" form labels
    .replace(/^\s*Email or phone\s*$/gm, "")
    // Remove standalone "Apply" / "Save" / "Report this job" lines
    .replace(/^\s*(?:Apply|Save)\s*$/gm, "")
    .replace(/^\*\s*Report this job\s*$/gm, "")
    // Remove horizontal rules that are just dashes
    .replace(/^-{3,}\s*$/gm, "")
    // Remove "Skip to main content" lines
    .replace(/^Skip to main content\s*$/gm, "")
    // Collapse excessive blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Fast fetch — returns page title + markdown without LLM. */
export async function fetchJobPage(url: string): Promise<JinaResult | null> {
  url = normalizeJobUrl(url);
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Return-Format": "markdown",
      "X-Remove-Selector": "nav, footer, .sidebar, .ads, .cookie-banner",
    };
    if (env.JINA_API_KEY) {
      headers["Authorization"] = `Bearer ${env.JINA_API_KEY}`;
    }

    const response = await fetch(`https://r.jina.ai/${url}`, { headers });
    if (!response.ok) {
      console.error(`[JINA] Returned ${response.status} for ${url}`);
      return null;
    }

    const json = await response.json() as {
      data?: { content?: string; title?: string; description?: string };
    };
    console.log(`[JINA] Response for ${url}: title="${json.data?.title || ""}" description="${(json.data?.description || "").slice(0, 100)}" content_length=${json.data?.content?.length || 0}`);

    const title = json.data?.title || "";
    const description = json.data?.description || "";
    const markdown = cleanMarkdown(json.data?.content || "");

    // Even if markdown is thin, title + description can still be useful
    if (!markdown.trim() && !title.trim() && !description.trim()) {
      console.warn(`[JINA] No usable content returned for ${url}`);
      return null;
    }

    return {
      title,
      markdown,
      description,
    };
  } catch (err) {
    console.error("[JINA] Fetch error:", err);
    return null;
  }
}

/** LLM extraction — parses structured fields from page content. */
export async function extractJobData(page: JinaResult): Promise<{
  job_title?: string;
  company?: string;
  company_description?: string;
  team_description?: string;
  seniority_level?: string;
  requirements?: string[];
  responsibilities?: string[];
  tech_stack?: string[];
}> {
  // Build the content to send to the LLM — combine all available info
  const contentParts: string[] = [];
  if (page.title) contentParts.push(`Page Title: ${page.title}`);
  if (page.description) contentParts.push(`Meta Description: ${page.description}`);
  if (page.markdown.trim()) contentParts.push(`Page Content:\n${page.markdown}`);
  const content = contentParts.join("\n\n");

  if (!content.trim()) {
    return {};
  }

  try {
    const extraction = await promptCompletion([
      {
        role: "system",
        content: `You are extracting structured data from a job posting page. The content may be noisy — focus on identifying job-specific information and ignore navigation, marketing copy, or unrelated content.

Return ONLY valid JSON with these fields:
{
  "job_title": "exact job title or null",
  "company": "company name or null",
  "company_description": "1-2 sentence summary of what the company does, from the posting itself — or null",
  "team_description": "1-2 sentence summary of the specific team/org this role sits in — or null",
  "seniority_level": "one of: intern, junior, mid, senior, staff, principal, manager, director, vp, executive — or null",
  "requirements": ["each qualification/requirement as a separate string"],
  "responsibilities": ["each responsibility/duty as a separate string"],
  "tech_stack": ["specific technologies, languages, frameworks, or tools mentioned"]
}

Guidelines:
- For company_description, use ONLY what the posting says about the company — do not invent or assume
- For team_description, look for "About the team" sections or similar context about the specific group
- For seniority_level, infer from the title and requirements (e.g. "10+ years" + "managing managers" = director-level)
- For requirements, include both hard skills and experience level requirements
- For tech_stack, only include specific named technologies (e.g. "Python", "Kubernetes"), not vague terms like "cloud" or "databases"
- If a field cannot be determined, use null for strings or [] for arrays`,
      },
      { role: "user", content },
    ], 1400);

    const llmContent = extraction.choices[0]?.message?.content || "{}";
    const jsonMatch = llmContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[SCRAPER] LLM returned no JSON block");
      return {};
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      job_title?: string;
      company?: string;
      company_description?: string;
      team_description?: string;
      seniority_level?: string;
      requirements?: string[];
      responsibilities?: string[];
      tech_stack?: string[];
    };

    console.log(`[SCRAPER] Extracted: title="${parsed.job_title || "—"}" company="${parsed.company || "—"}" seniority="${parsed.seniority_level || "—"}" requirements=${parsed.requirements?.length || 0} responsibilities=${parsed.responsibilities?.length || 0} tech_stack=${parsed.tech_stack?.length || 0}`);

    return {
      job_title: parsed.job_title || undefined,
      company: parsed.company || undefined,
      company_description: parsed.company_description || undefined,
      team_description: parsed.team_description || undefined,
      seniority_level: parsed.seniority_level || undefined,
      requirements: parsed.requirements || [],
      responsibilities: parsed.responsibilities || [],
      tech_stack: parsed.tech_stack || [],
    };
  } catch (err) {
    console.error("[SCRAPER] LLM extraction error:", err);
    return {};
  }
}

/** Fetch multiple URLs via Jina in parallel, then LLM-summarize into interview intel. */
export async function fetchAndSummarize(
  urls: Array<{ url: string; title: string; category: string }>,
  snippets: Array<{ content: string; source: string; url: string }> = [],
): Promise<{
  questions: string[];
  process_details?: string;
  culture_notes?: string;
} | null> {
  if (urls.length === 0 && snippets.length === 0) return null;

  // Fetch each URL in parallel with 10s timeout per page
  const fetchResults = await Promise.allSettled(
    urls.map(async ({ url, title }) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const headers: Record<string, string> = {
          Accept: "application/json",
          "X-Return-Format": "markdown",
          "X-Remove-Selector": "nav, footer, .sidebar, .ads, .cookie-banner",
        };
        if (env.JINA_API_KEY) {
          headers["Authorization"] = `Bearer ${env.JINA_API_KEY}`;
        }

        const response = await fetch(`https://r.jina.ai/${url}`, {
          headers,
          signal: controller.signal,
        });
        if (!response.ok) return null;

        const json = await response.json() as {
          data?: { content?: string; title?: string };
        };
        const markdown = cleanMarkdown(json.data?.content || "");
        if (!markdown || markdown.length < 100) return null;

        // Truncate very long pages to avoid blowing up the LLM context
        const truncated = markdown.length > 4000 ? markdown.slice(0, 4000) + "\n...[truncated]" : markdown;
        return { url, title, content: truncated };
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  const pages = fetchResults
    .filter((r): r is PromiseFulfilledResult<{ url: string; title: string; content: string } | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is { url: string; title: string; content: string } => v !== null);

  if (pages.length === 0 && snippets.length === 0) {
    console.log("[DEEP-ENRICH] No pages fetched and no snippets available");
    return null;
  }

  console.log(`[DEEP-ENRICH] Fetched ${pages.length}/${urls.length} pages, ${snippets.length} snippets, summarizing...`);

  // Combine scraped pages and search snippets for the LLM
  const sections: string[] = [];
  if (pages.length > 0) {
    sections.push(
      pages
        .map((p, i) => `--- PAGE ${i + 1}: ${p.title} (${p.url}) ---\n${p.content}`)
        .join("\n\n"),
    );
  }
  if (snippets.length > 0) {
    const snippetText = snippets
      .map((s, i) => `${i + 1}. [${s.source}] (${s.url}): ${s.content}`)
      .join("\n");
    sections.push(`--- SEARCH SNIPPETS (from sites that could not be fully scraped — extract any interview questions visible here) ---\n${snippetText}`);
  }
  const pagesText = sections.join("\n\n");

  try {
    const result = await briefCompletion([
      {
        role: "system",
        content: `You are extracting interview preparation intelligence from scraped web pages. These pages contain interview experiences, company culture info, and related content.

Return ONLY valid JSON:
{
  "questions": ["actual interview questions found in the content — extract real questions people were asked, not generic advice"],
  "process_details": "description of the interview process: rounds, format, timeline, what to expect — or null if not found",
  "culture_notes": "engineering culture, team values, work style, what the company looks for — or null if not found"
}

Rules:
- For questions: extract SPECIFIC questions that were actually asked in interviews. Include technical, behavioral, and system design questions. Aim for 5-15 questions. If a page lists many questions, pick the most unique/interesting ones.
- For process_details: look for info about number of rounds, types of interviews (phone screen, onsite, coding challenge), timeline, who you talk to.
- For culture_notes: look for engineering blog insights, team values, what interviewers care about, red/green flags.
- If a field has no relevant data, use an empty array for questions or null for strings.`,
      },
      { role: "user", content: pagesText },
    ], 1200);

    const llmContent = result.choices[0]?.message?.content?.trim() || "{}";
    const jsonMatch = llmContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[DEEP-ENRICH] LLM returned no JSON block");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      questions?: string[];
      process_details?: string;
      culture_notes?: string;
    };

    console.log(`[DEEP-ENRICH] Extracted: questions=${parsed.questions?.length || 0} process=${parsed.process_details ? "yes" : "no"} culture=${parsed.culture_notes ? "yes" : "no"}`);

    return {
      questions: parsed.questions || [],
      process_details: parsed.process_details || undefined,
      culture_notes: parsed.culture_notes || undefined,
    };
  } catch (err) {
    console.error("[DEEP-ENRICH] LLM summarization error:", err);
    return null;
  }
}
