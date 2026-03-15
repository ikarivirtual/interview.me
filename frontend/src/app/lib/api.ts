const API_BASE = import.meta.env.VITE_API_URL || "";

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

export async function sendMessage(
  sessionId: string,
  content: string,
  onToken: (token: string) => void,
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, content }),
  });

  if (!res.ok) throw new Error("Failed to send message");

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = JSON.parse(line.slice(6));
      if (data.token) {
        fullText += data.token;
        onToken(data.token);
      }
    }
  }

  return fullText;
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
