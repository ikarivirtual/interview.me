import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import ScoreGrid from "../components/report/ScoreGrid";
import { streamReport } from "../lib/api";

interface ReportData {
  content: string;
  scores: Record<string, number> | null;
}

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
        setStreaming(true);
        setLoading(false);

        const { scores } = await streamReport(sessionId!, (token) => {
          if (cancelled) return;
          contentRef.current += token;
          setReport({ content: contentRef.current, scores: null });
        });

        if (!cancelled) {
          // Strip SCORES_JSON line from displayed content
          const cleanContent = contentRef.current.replace(/SCORES_JSON:\s*\{[^}]+\}/, "").trim();
          setReport({ content: cleanContent, scores });
          setStreaming(false);
        }
      } catch (err) {
        console.error("Failed to stream report:", err);
        if (!cancelled) {
          setLoading(true);
          setStreaming(false);
        }
      }
    }

    fetchReport();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Simple markdown-to-HTML (bold, headers, bullets)
  function renderMarkdown(md: string) {
    return md.split("\n").map((line, i) => {
      if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-semibold text-white/80 mt-6 mb-2 uppercase tracking-wider">{line.slice(4)}</h3>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-lg font-semibold text-white/90 mt-8 mb-3">{line.slice(3)}</h2>;
      if (line.startsWith("# ")) return <h1 key={i} className="text-xl font-semibold text-white mt-8 mb-4" style={{ fontFamily: "'Instrument Serif', serif" }}>{line.slice(2)}</h1>;
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, "<strong class='text-white/80 font-medium'>$1</strong>");
        return (
          <li key={i} className="text-white/50 ml-4 mb-1.5 font-light text-sm leading-relaxed list-disc" dangerouslySetInnerHTML={{ __html: content }} />
        );
      }
      if (line.trim() === "") return <div key={i} className="h-2" />;
      const content = line.replace(/\*\*(.+?)\*\*/g, "<strong class='text-white/80 font-medium'>$1</strong>");
      return <p key={i} className="text-white/50 mb-2 leading-relaxed font-light text-sm" dangerouslySetInnerHTML={{ __html: content }} />;
    });
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col bg-[#060608]" style={{ fontFamily: "'Outfit', sans-serif" }}>
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
        <div className="absolute inset-0 bg-[#060608]" />
        <div className="absolute top-[5%] left-[20%] w-[40%] h-[20%] bg-emerald-500/[0.03] blur-[80px] rounded-full" />
        <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[20%] bg-indigo-500/[0.03] blur-[80px] rounded-full" />
      </div>

      {/* Header */}
      <nav className="relative z-10 w-full px-8 py-5 flex justify-between items-center">
        <div className="text-lg font-semibold tracking-tight text-white/90 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
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
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="w-8 h-8 text-white/20" />
            </motion.div>
            <p className="text-white/25 text-sm font-light">
              Generating your interview report...
            </p>
          </div>
        ) : report ? (
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
              <p className="text-white/20 text-xs tracking-widest uppercase font-medium">
                Interview Analysis
              </p>
            </div>

            {report.scores && <ScoreGrid scores={report.scores} />}

            {/* Report content */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8">
              {renderMarkdown(report.content)}
              {streaming && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="inline-block w-[2px] h-4 bg-emerald-400/60 ml-0.5 align-text-bottom"
                />
              )}
            </div>

            {!streaming && (
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
            )}
          </motion.div>
        ) : null}
      </main>
    </div>
  );
}
