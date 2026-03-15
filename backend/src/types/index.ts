export interface ScrapedContext {
  job_title?: string;
  company?: string;
  requirements?: string[];
  responsibilities?: string[];
  tech_stack?: string[];
  raw_markdown?: string;
  source_url?: string;
}

export interface SearchContext {
  interview_questions?: Array<{ content: string; source: string; url: string }>;
  company_info?: Array<{ content: string; url: string }>;
}

export interface Session {
  id: string;
  job_title: string;
  company: string | null;
  job_description: string | null;
  job_url: string | null;
  scraped_context: ScrapedContext | null;
  search_context: SearchContext | null;
  user_context: string | null;
  status: "active" | "ended" | "report_ready";
  created_at: string;
  ended_at: string | null;
}

export interface Message {
  id: string;
  session_id: string;
  role: "system" | "user" | "assistant";
  content: string;
  created_at: string;
}

export interface Report {
  id: string;
  session_id: string;
  content: string;
  scores: Record<string, number> | null;
  created_at: string;
}

export interface CreateSessionBody {
  job_title?: string;
  company?: string;
  job_description?: string;
  job_url?: string;
  user_context?: string;
}

export interface ChatBody {
  session_id: string;
  content: string;
}
