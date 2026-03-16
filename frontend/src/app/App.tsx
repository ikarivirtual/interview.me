import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import InterviewPage from "./pages/InterviewPage";
import ReportPage from "./pages/ReportPage";
import LoadingScreen from "./components/LoadingScreen";
import { createSession } from "./lib/api";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/interview/new" element={<InterviewPage />} />
        <Route path="/interview/:sessionId" element={<InterviewPage />} />
        <Route path="/report/:sessionId" element={<ReportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

const MainPage = () => {
  const navigate = useNavigate();
  const [jobUrl, setJobUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = jobUrl.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsLoading(true);
    try {
      const data = await createSession("Software Engineer", undefined, {
        job_url: jobUrl.trim(),
      });
      navigate(`/interview/${data.session.id}`);
    } catch (err) {
      console.error("Failed to create session:", err);
      setIsLoading(false);
      alert("Failed to start session. Check the URL and try again.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col selection:bg-emerald-500/30 selection:text-white bg-[#060608]">
      {/* Grain texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Background ambient gradient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[#060608]" />
        <motion.div
          animate={{
            transform: ["translate(-5%, -5%) scale(1)", "translate(2%, 2%) scale(1.1)", "translate(-5%, -5%) scale(1)"],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[50%] bg-emerald-500/[0.07] blur-[120px] rounded-full"
        />
        <motion.div
          animate={{
            transform: ["translate(5%, 5%) scale(1)", "translate(-2%, -2%) scale(1.15)", "translate(5%, 5%) scale(1)"],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/[0.05] blur-[140px] rounded-full"
        />
        <div className="absolute top-[30%] left-[20%] w-[60%] h-[40%] bg-amber-500/[0.02] blur-[100px] rounded-full" />
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <LoadingScreen key="loading" />
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex flex-col flex-1 min-h-screen"
          >
            {/* Navbar */}
            <nav className="w-full px-8 py-6 flex justify-between items-center">
              <div className="text-lg font-semibold tracking-tight text-white/90 flex items-center gap-2.5" style={{ fontFamily: "'Outfit', sans-serif" }}>
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                interview.me
              </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 text-center -mt-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-3xl w-full flex flex-col items-center"
              >
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] mb-8"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-white/50 tracking-wide uppercase">AI-Powered Interview Practice</span>
                </motion.div>

                {/* Headline */}
                <h1 className="mb-5 leading-[1.1] tracking-tight">
                  <motion.span
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="block text-4xl md:text-6xl text-white/40 font-light"
                    style={{ fontFamily: "'Outfit', sans-serif" }}
                  >
                    Your next interview,
                  </motion.span>
                  <motion.span
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="block text-5xl md:text-7xl text-white font-light italic"
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    mastered.
                  </motion.span>
                </h1>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35, duration: 0.6 }}
                  className="text-white/30 text-lg mb-12 max-w-md font-light"
                >
                  Paste a job posting link and practice with an AI interviewer tailored to the role.
                </motion.p>

                {/* Single URL input */}
                <motion.form
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  onSubmit={handleSubmit}
                  className="w-full max-w-xl mx-auto"
                >
                  <div className="relative group">
                    <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] pointer-events-none" />
                    <div className="relative flex items-center bg-white/[0.03] rounded-2xl border border-white/[0.06] overflow-hidden transition-all duration-300 group-focus-within:border-emerald-500/30 group-focus-within:bg-white/[0.05]">
                      <input
                        type="url"
                        placeholder="Paste a job posting URL"
                        value={jobUrl}
                        onChange={(e) => setJobUrl(e.target.value)}
                        className="w-full px-6 py-4 sm:py-5 bg-transparent text-lg text-white/90 placeholder-white/20 focus:outline-none font-light"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={!canSubmit}
                        className="flex-shrink-0 mr-2 px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-medium text-sm hover:bg-emerald-400 transition-all duration-200 disabled:opacity-20 disabled:pointer-events-none flex items-center gap-2 active:scale-[0.97]"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                      >
                        Start
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.form>
              </motion.div>
            </main>

            {/* Bottom fade */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#060608] to-transparent pointer-events-none" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
