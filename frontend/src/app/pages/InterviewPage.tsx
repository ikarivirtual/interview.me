import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { PhoneOff } from "lucide-react";
import InterviewerAvatar from "../components/voice/InterviewerAvatar";
import MicButton from "../components/voice/MicButton";
import StatusIndicator from "../components/voice/StatusIndicator";
import type { InterviewStatus } from "../components/voice/StatusIndicator";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "../hooks/useSpeechSynthesis";
import { createSession, getSession, sendMessage, endSession } from "../lib/api";

export default function InterviewPage() {
  const { sessionId: paramSessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<InterviewStatus>("initializing");
  const [sessionId, setSessionId] = useState<string | null>(paramSessionId || null);
  const [currentText, setCurrentText] = useState("");
  const sessionIdRef = useRef(sessionId);
  const isEndingRef = useRef(false);

  const handleSendRef = useRef<() => void>(() => {});
  const { transcript, isListening, start: startListening, stop: stopListening, supported } = useSpeechRecognition(
    () => handleSendRef.current(),
  );
  const { isSpeaking, speak, cancel: cancelSpeech } = useSpeechSynthesis();

  // Keep ref in sync
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Initialize session — either load existing (from MainPage) or create new (legacy URL params)
  useEffect(() => {
    if (sessionId && sessionId !== paramSessionId) return;

    if (paramSessionId) {
      // Session already created by MainPage — load it and speak the last assistant message
      getSession(paramSessionId)
        .then(async (data) => {
          setSessionId(data.session.id);
          const messages = data.messages || [];
          const lastAssistant = [...messages].reverse().find((m: { role: string }) => m.role === "assistant");
          if (lastAssistant) {
            setCurrentText(lastAssistant.content);
            setStatus("ai_speaking");
            await speak(lastAssistant.content);
            setStatus("listening");
            startListening();
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
        // Replace URL with session ID
        window.history.replaceState(null, "", `/interview/${data.session.id}`);

        // Speak first message
        const firstMsg = data.firstMessage.content;
        setCurrentText(firstMsg);
        setStatus("ai_speaking");
        await speak(firstMsg);
        setStatus("listening");
        startListening();
      })
      .catch((err) => {
        console.error("Failed to create session:", err);
      });
  }, [paramSessionId, sessionId, searchParams, speak, startListening]);

  // Handle sending transcript when user stops speaking
  const isSendingRef = useRef(false);
  const handleSend = useCallback(async () => {
    if (!sessionIdRef.current || !transcript.trim() || isSendingRef.current) return;
    isSendingRef.current = true;

    stopListening();
    setStatus("processing");
    setCurrentText("");

    let fullResponse = "";
    try {
      await sendMessage(sessionIdRef.current, transcript.trim(), (token) => {
        fullResponse += token;
        setCurrentText(fullResponse);
      });

      setStatus("ai_speaking");
      await speak(fullResponse);

      if (!isEndingRef.current) {
        setStatus("listening");
        startListening();
      }
    } catch (err) {
      console.error("Chat error:", err);
      setStatus("listening");
      startListening();
    } finally {
      isSendingRef.current = false;
    }
  }, [transcript, stopListening, startListening, speak]);

  // Keep ref in sync so silence callback always calls latest handleSend
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  const handleMicToggle = useCallback(() => {
    if (isListening) {
      // User stopped talking — send the transcript
      handleSend();
    } else if (status === "listening" || status === "ai_speaking") {
      cancelSpeech();
      setStatus("listening");
      startListening();
    }
  }, [isListening, status, handleSend, cancelSpeech, startListening]);

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

  return (
    <div className="relative min-h-screen overflow-hidden font-sans flex flex-col bg-[#82C8FF]">
      {/* Background — same Vista aurora style */}
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
          onClick={handleEndInterview}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500/80 backdrop-blur-xl border border-red-400/50 text-white font-medium text-sm hover:bg-red-500 transition-all shadow-lg"
        >
          <PhoneOff className="w-4 h-4" />
          End Interview
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
          className="max-w-xl w-full min-h-[80px] text-center"
        >
          <p className="text-white/90 text-lg leading-relaxed [text-shadow:0_1px_3px_rgba(0,0,0,0.2)]">
            {status === "listening" && transcript ? (
              <span className="italic text-white/70">{transcript}</span>
            ) : (
              currentText
            )}
          </p>
        </motion.div>

        {/* Mic button */}
        <MicButton
          isListening={isListening}
          onClick={handleMicToggle}
          disabled={status === "initializing" || status === "processing" || status === "ended" || !supported}
        />

        {!supported && (
          <p className="text-red-200 text-sm">
            Speech recognition is not supported in this browser. Try Chrome.
          </p>
        )}
      </main>
    </div>
  );
}
