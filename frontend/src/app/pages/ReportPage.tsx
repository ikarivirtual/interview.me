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
      if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-semibold text-white mt-6 mb-2 [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]">{line.slice(4)}</h3>;
      if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-bold text-white mt-8 mb-3 [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]">{line.slice(3)}</h2>;
      if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold text-white mt-8 mb-4 [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]">{line.slice(2)}</h1>;
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        return <li key={i} className="text-white/90 ml-4 mb-1" dangerouslySetInnerHTML={{ __html: content }} />;
      }
      if (line.trim() === "") return <br key={i} />;
      const content = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return <p key={i} className="text-white/90 mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />;
    });
  }

  return (
    <div className="relative min-h-screen overflow-hidden font-sans flex flex-col bg-[#82C8FF]">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#3BAFDA] via-[#5CB3FF] to-[#A3D9FF]" />
        <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[50%] bg-[#00A3FF] blur-[120px] opacity-30 rounded-[100%]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[60%] bg-[#00FFB2] blur-[140px] opacity-20 rounded-[100%]" />
        <div className="absolute top-[20%] left-[10%] w-[80%] h-[30%] bg-white blur-[90px] opacity-60 rotate-[-15deg]" />
      </div>

      {/* Header */}
      <nav className="relative z-10 w-full px-8 py-5 flex justify-between items-center">
        <div className="text-xl font-semibold tracking-tight text-white flex items-center gap-3 [text-shadow:0_1px_3px_rgba(0,0,0,0.3)]">
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-[#4facfe] to-[#00f2fe] shadow-[0_2px_8px_rgba(0,0,0,0.2),_inset_0_2px_4px_rgba(255,255,255,0.8)] border border-white/60 flex items-center justify-center overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[60%] bg-gradient-to-b from-white/90 to-transparent rounded-b-full opacity-80" />
          </div>
          interview.me
        </div>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          New Interview
        </button>
      </nav>

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center p-6 pb-16">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="text-white/80 text-lg [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]">
              Generating your interview report...
            </p>
          </div>
        ) : report ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl w-full space-y-8"
          >
            <h1 className="text-3xl font-bold text-white text-center [text-shadow:0_2px_4px_rgba(0,100,150,0.4)]">
              Interview Report
            </h1>

            {report.scores && <ScoreGrid scores={report.scores} />}

            <div className="bg-white/15 backdrop-blur-xl border border-white/30 rounded-2xl p-8 shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
              {renderMarkdown(report.content)}
              {streaming && (
                <span className="inline-block w-2 h-5 bg-white/70 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>

            {!streaming && (
              <div className="flex justify-center">
                <button
                  onClick={() => navigate("/")}
                  className="px-8 py-3 rounded-full bg-white/20 backdrop-blur-xl border border-white/40 text-white font-medium hover:bg-white/30 transition-all shadow-lg"
                >
                  Start New Interview
                </button>
              </div>
            )}
          </motion.div>
        ) : null}
      </main>
    </div>
  );
}
