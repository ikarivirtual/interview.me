import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import ScoreGrid from "../components/report/ScoreGrid";
import { streamReport } from "../lib/api";

interface ReportData {
  content: string;
  scores: Record<string, number> | null;
}

function stripScoresSection(content: string): string {
  return content
    // Remove SCORES_JSON line
    .replace(/SCORES_JSON:\s*\{[^}]*\}?/, "")
    // Remove trailing "Scores" / "Score Summary" header and anything after it
    .replace(/\n#{1,3}\s*[Ss]core[s]?\b.*$/s, "")
    .trim();
}

// ── Markdown parser ──────────────────────────────────────────────────

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "hr" }
  | { type: "blockquote"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; alignments: ("left" | "center" | "right")[]; rows: string[][] }
  | { type: "code"; lang: string; code: string }
  | { type: "p"; text: string }
  | { type: "blank" };

function parseBlocks(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", lang, code: codeLines.join("\n") });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Headers
    if (line.startsWith("### ")) { blocks.push({ type: "h3", text: line.slice(4) }); i++; continue; }
    if (line.startsWith("## ")) { blocks.push({ type: "h2", text: line.slice(3) }); i++; continue; }
    if (line.startsWith("# ")) { blocks.push({ type: "h1", text: line.slice(2) }); i++; continue; }

    // Blockquote
    if (line.startsWith("> ")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        bqLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "blockquote", lines: bqLines });
      continue;
    }

    // Table: detect header row followed by separator row
    if (i + 1 < lines.length && line.includes("|") && /^\|?[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|?\s*$/.test(lines[i + 1])) {
      const parseRow = (row: string) =>
        row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

      const headers = parseRow(line);
      const sepCells = parseRow(lines[i + 1]);
      const alignments = sepCells.map((c): "left" | "center" | "right" => {
        if (c.startsWith(":") && c.endsWith(":")) return "center";
        if (c.endsWith(":")) return "right";
        return "left";
      });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", headers, alignments, rows });
      continue;
    }

    // Unordered list
    if (/^[\-\*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\-\*] /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      blocks.push({ type: "blank" });
      i++;
      continue;
    }

    // Paragraph
    blocks.push({ type: "p", text: line });
    i++;
  }

  return blocks;
}

function renderInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code class="rpt-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white/75 font-medium">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

// ── Component ────────────────────────────────────────────────────────

export default function ReportPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);

  const contentRef = useRef("");

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    contentRef.current = "";

    async function fetchReport() {
      try {
        
        setLoading(false);
        setStreaming(true);

        let parsedScores: Record<string, number> | null = null;

        const { scores } = await streamReport(sessionId!, (token) => {
          if (cancelled) return;
          contentRef.current += token;

          // Try to parse scores early from the streamed content
          if (!parsedScores) {
            const match = contentRef.current.match(/SCORES_JSON:\s*(\{[^}]+\})/);
            if (match) {
              try {
                parsedScores = JSON.parse(match[1]);
              } catch { /* wait for complete JSON */ }
            }
          }

          const displayContent = stripScoresSection(contentRef.current);
          setReport({ content: displayContent, scores: parsedScores });
        });

        if (!cancelled) {
          const cleanContent = stripScoresSection(contentRef.current);
          setReport({ content: cleanContent, scores: scores ?? parsedScores });
          setStreaming(false);
        }
      } catch (err) {
        console.error("Failed to stream report:", err);
        if (!cancelled) {
          setLoading(true);
          
        }
      }
    }

    fetchReport();
    return () => { cancelled = true; };
  }, [sessionId]);

  const blocks = useMemo(() => report ? parseBlocks(report.content) : [], [report]);

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col bg-[#050509]" style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* Grain */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[#050509]" />
        <div className="absolute top-[5%] left-[20%] w-[40%] h-[20%] bg-blue-500/[0.03] blur-[80px] rounded-full" />
        <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[20%] bg-blue-500/[0.03] blur-[80px] rounded-full" />
      </div>

      {/* Header */}
      <nav className="relative z-10 w-full px-8 py-5 flex justify-between items-center">
        <div className="text-lg font-semibold tracking-tight text-white/90 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          interview.me
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-xs font-medium tracking-wide"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          New Interview
        </button>
      </nav>

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center p-6 pb-20">
        {(!report || report.scores === null) ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-8 h-8 text-white/20" />
            </motion.div>
            <p className="text-white/25 text-sm font-light text-center">
              {loading ? "Generating your interview report..." : "Calculating overall assessment and scores..."}
            </p>
            {!loading && (
              <p className="text-white/20 text-xs font-light">
                Loading stats score
              </p>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl w-full space-y-10"
          >
            {/* Title */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-light text-white/90 italic" style={{ fontFamily: "'Instrument Serif', serif" }}>
                Performance Report
              </h1>
              <p className="text-white/20 text-xs tracking-[0.25em] uppercase font-medium">
                Interview Analysis
              </p>
            </div>

            <ScoreGrid scores={report.scores} />

            {/* Report content */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 md:p-10 report-content">
              {blocks.map((block, i) => {
                switch (block.type) {
                  case "h1":
                    return (
                      <h1 key={i} className="text-xl font-light text-white/90 mt-10 mb-4 first:mt-0" style={{ fontFamily: "'Instrument Serif', serif" }}>
                        {block.text}
                      </h1>
                    );
                  case "h2":
                    return (
                      <h2 key={i} className="text-lg font-medium text-white/85 mt-9 mb-3 first:mt-0">
                        {block.text}
                      </h2>
                    );
                  case "h3":
                    return (
                      <h3 key={i} className="text-[13px] font-semibold text-white/60 mt-7 mb-2 uppercase tracking-[0.15em] first:mt-0">
                        {block.text}
                      </h3>
                    );
                  case "hr":
                    return <hr key={i} className="border-none h-px bg-white/[0.06] my-8" />;
                  case "blockquote":
                    return (
                      <blockquote key={i} className="border-l-2 border-blue-500/30 pl-4 my-4">
                        {block.lines.map((line, j) => (
                          <p key={j} className="text-white/45 text-sm leading-relaxed font-light italic" dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
                        ))}
                      </blockquote>
                    );
                  case "ul":
                    return (
                      <ul key={i} className="my-3 space-y-1.5">
                        {block.items.map((item, j) => (
                          <li key={j} className="text-white/50 ml-4 font-light text-sm leading-relaxed list-disc marker:text-white/15" dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
                        ))}
                      </ul>
                    );
                  case "ol":
                    return (
                      <ol key={i} className="my-3 space-y-1.5 list-decimal">
                        {block.items.map((item, j) => (
                          <li key={j} className="text-white/50 ml-4 font-light text-sm leading-relaxed marker:text-white/25" dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
                        ))}
                      </ol>
                    );
                  case "table":
                    return (
                      <div key={i} className="my-6 overflow-x-auto rounded-lg border border-white/[0.06]">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                              {block.headers.map((h, j) => (
                                <th
                                  key={j}
                                  className="px-4 py-2.5 text-[11px] font-semibold text-white/50 uppercase tracking-[0.15em]"
                                  style={{ textAlign: block.alignments[j] || "left" }}
                                  dangerouslySetInnerHTML={{ __html: renderInline(h) }}
                                />
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {block.rows.map((row, ri) => (
                              <tr key={ri} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                                {row.map((cell, ci) => (
                                  <td
                                    key={ci}
                                    className="px-4 py-2.5 text-white/45 font-light"
                                    style={{ textAlign: block.alignments[ci] || "left" }}
                                    dangerouslySetInnerHTML={{ __html: renderInline(cell) }}
                                  />
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  case "code":
                    return (
                      <pre key={i} className="my-4 rounded-lg bg-black/40 border border-white/[0.06] p-4 overflow-x-auto">
                        <code className="text-[13px] text-blue-300/70 font-mono leading-relaxed">{block.code}</code>
                      </pre>
                    );
                  case "blank":
                    return <div key={i} className="h-2" />;
                  case "p":
                    return (
                      <p key={i} className="text-white/50 mb-2.5 leading-relaxed font-light text-sm" dangerouslySetInnerHTML={{ __html: renderInline(block.text) }} />
                    );
                }
              })}
              {streaming && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="inline-block w-[2px] h-4 bg-blue-400/60 ml-0.5 align-text-bottom"
                />
              )}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center"
            >
              <button
                onClick={() => navigate("/")}
                className="px-6 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/50 font-medium text-sm hover:bg-white/[0.08] hover:text-white/70 transition-all duration-300"
              >
                Start New Interview
              </button>
            </motion.div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
