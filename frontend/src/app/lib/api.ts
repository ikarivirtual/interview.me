const API_BASE = import.meta.env.VITE_API_URL || "";
const END_MARKER_PATTERN = /\[\[?\s*END[\s_]?INTERVIEW\s*\]?\]/gi;
const END_MARKER_HOLDBACK = 20;

function stripEndMarkers(text: string, trim = false): string {
  const cleaned = text.replace(END_MARKER_PATTERN, "");
  return trim ? cleaned.trim() : cleaned;
}

export async function createSession(
  jobTitle: string,
  company?: string,
  options?: { job_url?: string; user_context?: string },
) {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job_title: jobTitle,
      company,
      job_url: options?.job_url,
      user_context: options?.user_context,
    }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function getSession(sessionId: string) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}`);
  if (!res.ok) throw new Error("Failed to get session");
  return res.json();
}

export interface SendMessageResult {
  text: string;
  interviewComplete: boolean;
}

export async function sendMessage(
  sessionId: string,
  content: string,
  onToken: (token: string) => void,
): Promise<SendMessageResult> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, content }),
  });

  if (!res.ok) throw new Error("Failed to send message");

  if (!res.body) throw new Error("Response body is empty");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  let pendingText = "";
  let interviewComplete = false;

  const flushSafeText = (final = false) => {
    const safeLength = final ? pendingText.length : Math.max(0, pendingText.length - END_MARKER_HOLDBACK);
    if (safeLength <= 0) return;

    const safeChunk = stripEndMarkers(pendingText.slice(0, safeLength));
    pendingText = pendingText.slice(safeLength);

    if (safeChunk) {
      fullText += safeChunk;
      onToken(safeChunk);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.token) {
          pendingText += String(data.token);
          flushSafeText();
        }
        if (data.interviewComplete) {
          interviewComplete = true;
        }
      } catch {
        // Malformed JSON line — skip
      }
    }
  }

  if (buffer.startsWith("data: ")) {
    try {
      const data = JSON.parse(buffer.slice(6));
      if (data.token) {
        pendingText += String(data.token);
      }
      if (data.interviewComplete) {
        interviewComplete = true;
      }
    } catch {
      // Malformed — skip
    }
  }

  flushSafeText(true);

  return { text: stripEndMarkers(fullText, true), interviewComplete };
}

export async function deleteLastUserMessage(sessionId: string) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages/last`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete last message");
  return res.json();
}

export async function endSession(sessionId: string) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/end`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to end session");
  return res.json();
}

export async function getReport(sessionId: string) {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/report`);
  if (res.status === 202) return { status: "generating" as const };
  if (!res.ok) throw new Error("Failed to get report");
  return res.json();
}

export async function streamReport(
  sessionId: string,
  onToken: (token: string) => void,
): Promise<{ scores: Record<string, number> | null }> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/report/stream`);
  if (!res.ok) throw new Error("Failed to stream report");

  if (!res.body) throw new Error("Response body is empty");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let scores: Record<string, number> | null = null;
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.error) {
          throw new Error(data.error);
        } else if (data.done) {
          scores = data.scores ?? null;
        } else if (data.token) {
          onToken(data.token);
        }
      } catch {
        // Malformed JSON line — skip
      }
    }
  }

  // Process remaining buffer
  if (buffer.startsWith("data: ")) {
    try {
      const data = JSON.parse(buffer.slice(6));
      if (data.error) throw new Error(data.error);
      if (data.done) scores = data.scores ?? null;
      else if (data.token) onToken(data.token);
    } catch {
      // Malformed — skip
    }
  }

  return { scores };
}
