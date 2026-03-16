import { useState, useRef, useCallback, useEffect } from "react";

interface SpeechRecognitionResult {
  transcript: string;
  isListening: boolean;
  start: () => void;
  stop: () => void;
  supported: boolean;
}

const SILENCE_TIMEOUT_MS = 5000;
const EMPTY_SILENCE_TIMEOUT_MS = 10000;

export function useSpeechRecognition(
  onSilence?: () => void,
): SpeechRecognitionResult {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasSpokenRef = useRef(false);
  const onSilenceRef = useRef(onSilence);
  onSilenceRef.current = onSilence;
  const stoppingRef = useRef(false);

  const SpeechRecognitionAPI =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const supported = !!SpeechRecognitionAPI;

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (hasSpokenRef.current) {
        onSilenceRef.current?.();
      }
    }, SILENCE_TIMEOUT_MS);
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) return;

    // Stop any existing instance first
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    clearSilenceTimer();
    stoppingRef.current = false;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";
    hasSpokenRef.current = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (stoppingRef.current) return;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
      hasSpokenRef.current = true;
      resetSilenceTimer();
    };

    let restartAttempts = 0;
    const MAX_RESTART_ATTEMPTS = 3;

    recognition.onend = () => {
      // If we didn't intentionally stop, the browser killed it — restart
      if (!stoppingRef.current && recognitionRef.current === recognition && restartAttempts < MAX_RESTART_ATTEMPTS) {
        restartAttempts++;
        try {
          recognition.start();
          return;
        } catch {
          // Can't restart — fall through to cleanup
        }
      }
      setIsListening(false);
      clearSilenceTimer();
    };

    recognition.onerror = (event) => {
      // "aborted" and "no-speech" fire during normal operation — not real errors
      if (event.error === "aborted" || event.error === "no-speech") return;
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      clearSilenceTimer();
    };

    recognitionRef.current = recognition;
    setTranscript("");
    setIsListening(true);
    recognition.start();

    // Start a long silence timer for the case where user never speaks
    silenceTimerRef.current = setTimeout(() => {
      if (!hasSpokenRef.current) {
        onSilenceRef.current?.();
      }
    }, EMPTY_SILENCE_TIMEOUT_MS);
  }, [SpeechRecognitionAPI, resetSilenceTimer, clearSilenceTimer]);

  const stop = useCallback(() => {
    stoppingRef.current = true;
    clearSilenceTimer();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stoppingRef.current = true;
      clearSilenceTimer();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
    };
  }, [clearSilenceTimer]);

  return { transcript, isListening, start, stop, supported };
}
