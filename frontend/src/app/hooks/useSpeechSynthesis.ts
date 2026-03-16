import { useState, useCallback, useRef, useEffect } from "react";

interface SpeechSynthesisResult {
  isSpeaking: boolean;
  speak: (text: string) => Promise<void>;
  cancel: () => void;
}

export function useSpeechSynthesis(): SpeechSynthesisResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const resolveRef = useRef<(() => void) | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Load voices (Chrome loads them async)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  // Cleanup on unmount — stop any playing speech and resolve dangling promises
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      if (resolveRef.current) {
        resolveRef.current();
        resolveRef.current = null;
      }
      utteranceRef.current = null;
    };
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }

      // Resolve any previous pending promise before starting a new one
      if (resolveRef.current) {
        resolveRef.current();
        resolveRef.current = null;
      }

      window.speechSynthesis.cancel();
      utteranceRef.current = null;

      // Split into sentences to avoid Chrome's ~15s TTS cutoff bug
      const chunks = text.match(/[^.!?]+[.!?]+\s*/g) || [text];

      const voices = voicesRef.current;
      const preferred = voices.find(
        (v) => v.name.includes("Samantha") || v.name.includes("Google") || v.lang === "en-US",
      );

      resolveRef.current = resolve;
      let chunkIndex = 0;

      const speakNext = () => {
        if (chunkIndex >= chunks.length || !resolveRef.current) {
          setIsSpeaking(false);
          utteranceRef.current = null;
          if (resolveRef.current) {
            resolveRef.current();
            resolveRef.current = null;
          }
          return;
        }

        const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
        utterance.rate = 1.05;
        utterance.pitch = 1;
        if (preferred) utterance.voice = preferred;

        utteranceRef.current = utterance;

        utterance.onstart = () => {
          if (utteranceRef.current === utterance) {
            setIsSpeaking(true);
          }
        };

        utterance.onend = () => {
          if (utteranceRef.current === utterance) {
            chunkIndex++;
            speakNext();
          }
        };

        utterance.onerror = () => {
          if (utteranceRef.current === utterance) {
            setIsSpeaking(false);
            utteranceRef.current = null;
            if (resolveRef.current) {
              resolveRef.current();
              resolveRef.current = null;
            }
          }
        };

        window.speechSynthesis.speak(utterance);
      };

      speakNext();
    });
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setIsSpeaking(false);
    if (resolveRef.current) {
      resolveRef.current();
      resolveRef.current = null;
    }
  }, []);

  return { isSpeaking, speak, cancel };
}
