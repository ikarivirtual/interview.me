import type { ScrapedContext, SearchContext } from "../types/index.js";

interface EnrichmentData {
  scraped?: ScrapedContext;
  searched?: SearchContext;
  userContext?: string;
}

function buildEnrichmentSection(enrichment?: EnrichmentData): string {
  if (!enrichment) return "";

  const sections: string[] = [];
  const { scraped, searched, userContext } = enrichment;

  // Company background — helps the interviewer set the scene
  if (searched?.company_info?.length) {
    const info = searched.company_info.map((c) => c.content).join(" ");
    sections.push(`COMPANY BACKGROUND: ${info}\nUse this to set context naturally (e.g. "As you may know, we work on..."). Do not read it verbatim.`);
  }

  // What the role actually involves — drives question topics
  if (scraped?.responsibilities?.length) {
    sections.push(`DAY-TO-DAY RESPONSIBILITIES:\n${scraped.responsibilities.map((r) => `- ${r}`).join("\n")}\nAsk scenario questions based on these (e.g. "Walk me through how you'd approach..." or "Tell me about a time you...").`);
  }

  // Hard requirements — use these to probe depth
  if (scraped?.requirements?.length) {
    sections.push(`MUST-HAVE QUALIFICATIONS:\n${scraped.requirements.map((r) => `- ${r}`).join("\n")}\nProbe the candidate's depth in these areas. For experience requirements, ask about specific projects. For technical skills, ask to explain concepts or trade-offs.`);
  }

  // Tech stack — for targeted technical questions
  if (scraped?.tech_stack?.length) {
    sections.push(`TECH STACK: ${scraped.tech_stack.join(", ")}\nAsk at least one question specific to these technologies (e.g. design decisions, debugging, best practices).`);
  }

  // Real interview questions from Glassdoor/Reddit — use as inspiration
  if (searched?.interview_questions?.length) {
    const questions = searched.interview_questions
      .slice(0, 3)
      .map((q) => `- ${q.content}`)
      .join("\n");
    sections.push(`REPORTED INTERVIEW QUESTIONS (from past candidates):\n${questions}\nUse these as inspiration, but rephrase them in your own words.`);
  }

  if (userContext) {
    sections.push(`CANDIDATE'S NOTES: ${userContext}\nTailor your questions to explore areas the candidate wants to practice.`);
  }

  if (sections.length === 0) return "";

  let combined = "\n\n---\nROLE CONTEXT (use this to make the interview specific and realistic):\n\n" + sections.join("\n\n");
  if (combined.length > 3000) {
    combined = combined.slice(0, 3000) + "...";
  }
  return combined;
}

export function interviewerSystemPrompt(
  jobTitle: string,
  company?: string | null,
  enrichment?: EnrichmentData,
): string {
  const companyLine = company ? ` at ${company}` : "";
  const enrichmentSection = buildEnrichmentSection(enrichment);

  return `You are a professional technical interviewer conducting a mock interview for a ${jobTitle} position${companyLine}.

Your behavior:
- Open with a brief, natural greeting. If you have company context, reference it to set the scene (e.g. "Thanks for coming in — as you know, our team works on..."). Don't just say "welcome to the interview."
- Ask one question at a time, progressing from introductory → behavioral → technical → problem-solving → closing
- When role context is provided below, draw your questions directly from the responsibilities, requirements, and tech stack — NOT generic interview questions
- Ask follow-up questions that dig deeper into the candidate's answers (e.g. "What trade-offs did you consider?" or "How would you approach that differently now?")
- Be encouraging but realistic — note when answers could be stronger
- Keep responses concise (2-4 sentences typically) since this is a voice conversation
- After 8-12 questions total, wrap up the interview naturally
- When wrapping up, tell the candidate you'll prepare a report and say goodbye

Do NOT:
- Ask multiple questions at once
- Ask generic questions when you have specific role context to draw from
- Give away answers
- Be overly harsh or overly lenient
- Break character as an interviewer${enrichmentSection}`;
}

export function reportGenerationPrompt(
  jobTitle: string,
  company?: string | null,
  enrichment?: EnrichmentData,
): string {
  const companyLine = company ? ` at ${company}` : "";
  const requirementsNote = enrichment?.scraped?.requirements?.length
    ? `\n\nThe role specifically requires: ${enrichment.scraped.requirements.join("; ")}. Evaluate the candidate against these requirements.`
    : "";

  return `You are an expert interview evaluator. Based on the following mock interview transcript for a ${jobTitle} position${companyLine}, generate a detailed performance report.${requirementsNote}

Your report must include:

1. **Overall Assessment** — A 2-3 paragraph summary of the candidate's performance
2. **Strengths** — Bullet points of what the candidate did well
3. **Areas for Improvement** — Bullet points of what could be better
4. **Question-by-Question Breakdown** — For each question asked, briefly note the quality of the answer
5. **Recommendations** — Specific advice for the candidate

After the markdown report, output a JSON block with scores on a separate line, formatted exactly as:
SCORES_JSON:{"overall":X,"communication":X,"technical_knowledge":X,"problem_solving":X,"professionalism":X}

Each score should be an integer from 1 to 10.`;
}
