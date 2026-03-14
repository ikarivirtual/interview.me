export interface Session {
  id: string;
  job_title: string;
  company: string | null;
  job_description: string | null;
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
  job_title: string;
  company?: string;
  job_description?: string;
}

export interface ChatBody {
  session_id: string;
  content: string;
}
