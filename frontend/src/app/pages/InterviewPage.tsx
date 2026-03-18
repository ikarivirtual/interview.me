import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { PhoneOff } from "lucide-react";
import InterviewerAvatar from "../components/voice/InterviewerAvatar";
import StatusIndicator from "../components/voice/StatusIndicator";
import type { InterviewStatus } from "../components/voice/StatusIndicator";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "../hooks/useSpeechSynthesis";
import { createSession, getSession, sendMessage, endSession, deleteLastUserMessage } from "../lib/api";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function InterviewPage() {
  const { sessionId: paramSessionId } = useParams();
  const [searchParams] = useSearchParams();
  const debugTextMode = searchParams.get("debugInput") === "1";
  const navigate = useNavigate();

  const [status, setStatus] = useState<InterviewStatus>("initializing");
  const [sessionId, setSessionId] = useState<string | null>(paramSessionId || null);
  const [currentText, setCurrentText] = useState("");
  const [debugAnswer, setDebugAnswer] = useState("");
  const sessionIdRef = useRef(sessionId);
  const isEndingRef = useRef(false);
  const initRef = useRef(false);

  const handleSendRef = useRef<() => void>(() => {});
  const { transcript, start: startListening, stop: stopListening, supported } = useSpeechRecognition(
    () => handleSendRef.current(),
  );
  const { isSpeaking, speak, cancel: cancelSpeech } = useSpeechSynthesis();

  // Stable refs for functions used in the init effect
  const speakRef = useRef(speak);
  speakRef.current = speak;
  const startListeningRef = useRef(startListening);
  startListeningRef.current = startListening;

  // Keep ref in sync
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Speak AI response and transition to listening
  const speakAndListen = useCallback(async (text: string) => {
    if (isEndingRef.current || !text.trim()) return;
    setCurrentText(text);
    setStatus("ai_speaking");

    await speakRef.current(text);
    if (!isEndingRef.current) {
      setStatus("listening");
      startListeningRef.current();
    }
  }, []);

  // Initialize session — runs once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (paramSessionId) {
      // Reconnecting — load session and resume from the right point
      getSession(paramSessionId)
        .then(async (data) => {
          const session = data.session;
          const messages: Array<{ role: string; content: string }> = data.messages || [];

          // Session already ended — go straight to report
          if (session.status === "ended" || session.status === "report_ready") {
            navigate(`/report/${paramSessionId}`, { replace: true });
            return;
          }

          setSessionId(session.id);

          const lastMessage = messages[messages.length - 1];

          if (!lastMessage || lastMessage.role === "assistant") {
            // Normal case: last thing was AI speaking — replay it
            const text = lastMessage?.content;
            if (text) await speakAndListen(text);
          } else if (lastMessage.role === "user") {
            // User's message was saved but AI response was lost mid-stream.
            // Delete the orphaned message so it won't duplicate in history,
            // then replay the last question and let the user re-answer.
            await deleteLastUserMessage(paramSessionId).catch(() => {});
            const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
            if (lastAssistant) {
              await speakAndListen(lastAssistant.content);
            } else {
              setStatus("listening");
              startListeningRef.current();
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load session:", err);
          navigate("/");
        });
      return;
    }

    const position = searchParams.get("position") || "Software Engineer";
    const company = searchParams.get("company") || undefined;

    createSession(position, company)
      .then(async (data) => {
        setSessionId(data.session.id);
        window.history.replaceState(null, "", `/interview/${data.session.id}`);
        await speakAndListen(data.firstMessage.content);
      })
      .catch((err) => {
        console.error("Failed to create session:", err);
        navigate("/");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle sending transcript when user stops speaking
  const isSendingRef = useRef(false);
  const submitAnswer = useCallback(async (answer: string) => {
    if (!sessionIdRef.current || !answer.trim() || isSendingRef.current) return;
    isSendingRef.current = true;

    stopListening();
    setStatus("processing");
    setCurrentText(answer.trim());

    let fullResponse = "";
    try {
      const result = await sendMessage(sessionIdRef.current, answer.trim(), (token) => {
        fullResponse += token;
        setCurrentText(fullResponse);
      });

      if (result.interviewComplete) {
        // Interview is over — speak the closing, then transition into the report view.
        setStatus("ai_speaking");
        setCurrentText(result.text);
        await speakRef.current(result.text);
        isEndingRef.current = true;
        setStatus("ended");
        setCurrentText("Preparing your interview report...");
        await endSession(sessionIdRef.current);
        await delay(600);
        navigate(`/report/${sessionIdRef.current}`);
      } else {
        await speakAndListen(result.text);
      }
    } catch (err) {
      console.error("Chat error:", err);
      if (!isEndingRef.current) {
        setStatus("listening");
        startListeningRef.current();
      }
    } finally {
      isSendingRef.current = false;
    }
  }, [stopListening, speakAndListen, navigate]);

  const handleSend = useCallback(async () => {
    if (!transcript.trim()) return;
    await submitAnswer(transcript.trim());
  }, [submitAnswer, transcript]);

  const handleDebugSubmit = useCallback(async () => {
    if (!debugAnswer.trim()) return;
    const answer = debugAnswer;
    setDebugAnswer("");
    await submitAnswer(answer);
  }, [debugAnswer, submitAnswer]);

  // Keep ref in sync so silence callback always calls latest handleSend
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);


  const handleEndInterview = useCallback(async () => {
    if (!sessionIdRef.current || isEndingRef.current) return;
    isEndingRef.current = true;

    stopListening();
    cancelSpeech();
    setStatus("ended");

    try {
      await endSession(sessionIdRef.current);
      navigate(`/report/${sessionIdRef.current}`);
    } catch (err) {
      console.error("Failed to end session:", err);
    }
  }, [stopListening, cancelSpeech, navigate]);

  const toggleDebugMode = useCallback(() => {
    const targetSessionId = sessionIdRef.current ?? paramSessionId;
    const basePath = targetSessionId ? `/interview/${targetSessionId}` : "/interview/new";
    navigate(debugTextMode ? basePath : `${basePath}?debugInput=1`);
  }, [debugTextMode, navigate, paramSessionId]);

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
        <div className="absolute top-[10%] left-[30%] w-[40%] h-[30%] bg-emerald-500/[0.04] blur-[100px] rounded-full" />
        <div className="absolute bottom-[10%] right-[20%] w-[30%] h-[30%] bg-indigo-500/[0.03] blur-[80px] rounded-full" />
      </div>

      {/* Header */}
      <nav className="relative z-10 w-full px-8 py-5 flex justify-between items-center">
        <div className="text-lg font-semibold tracking-tight text-white/90 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          interview.me
        </div>
        <button
          onClick={handleEndInterview}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/50 font-medium text-xs tracking-wide hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all duration-300"
        >
          <PhoneOff className="w-3.5 h-3.5" />
          End
        </button>
      </nav>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center gap-8 p-6">
        <InterviewerAvatar
          isSpeaking={isSpeaking}
          isProcessing={status === "processing" || status === "initializing"}
        />

        <StatusIndicator status={status} />

        {/* Transcript / response display */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-lg w-full min-h-[80px] text-center"
        >
          <p className="text-white/50 text-base leading-relaxed font-light">
            {status === "listening" && transcript ? (
              <span className="italic text-white/30">{transcript}</span>
            ) : (
              currentText
            )}
          </p>
        </motion.div>

{!debugTextMode && !supported && (
          <p className="text-red-400/60 text-xs font-light">
            Speech recognition is not supported in this browser. Try Chrome.
          </p>
        )}

        {(
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/30">
                Debug Controls
              </div>
              <button
                onClick={toggleDebugMode}
                className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/45 transition-colors hover:text-white/70"
              >
                {debugTextMode ? "Use Voice" : "Use Text Input"}
              </button>
            </div>
            <div className="text-xs text-white/35">
              {debugTextMode ? "Text mode is active for this interview session." : "Voice mode is active. Switch to text mode for debugging."}
            </div>
            {debugTextMode && (
              <>
                <textarea
                  value={debugAnswer}
                  onChange={(event) => setDebugAnswer(event.target.value)}
                  placeholder="Type an answer for testing..."
                  className="min-h-28 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-white/80 outline-none placeholder:text-white/25 focus:border-emerald-400/40"
                  disabled={status === "initializing" || status === "processing" || status === "ended"}
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleDebugSubmit}
                    disabled={!debugAnswer.trim() || status === "initializing" || status === "processing" || status === "ended"}
                    className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 transition-all duration-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.03] disabled:text-white/25"
                  >
                    Send Debug Answer
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
