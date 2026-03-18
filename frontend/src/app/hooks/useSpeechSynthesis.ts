import { useState, useCallback, useRef, useEffect } from "react";

interface SpeechSynthesisResult {
  isSpeaking: boolean;
  speak: (text: string) => Promise<void>;
  cancel: () => void;
}

function speakWithBrowserTTS(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();

    const chunks = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.name.includes("Samantha") || v.name.includes("Google") || v.lang === "en-US",
    );

    let i = 0;
    const speakNext = () => {
      if (i >= chunks.length) { resolve(); return; }
      const utt = new SpeechSynthesisUtterance(chunks[i]);
      utt.rate = 1.05;
      if (preferred) utt.voice = preferred;
      utt.onend = () => { i++; speakNext(); };
      utt.onerror = () => resolve();
      window.speechSynthesis.speak(utt);
    };
    speakNext();
  });
}

export function useSpeechSynthesis(): SpeechSynthesisResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resolveRef = useRef<(() => void) | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const usingBrowserTTSRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (usingBrowserTTSRef.current) {
        window.speechSynthesis?.cancel();
      }
      if (resolveRef.current) {
        resolveRef.current();
        resolveRef.current = null;
      }
    };
  }, []);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      // Resolve any previous pending promise
      if (resolveRef.current) {
        resolveRef.current();
        resolveRef.current = null;
      }

      // Cancel any in-progress audio
      abortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (usingBrowserTTSRef.current) {
        window.speechSynthesis?.cancel();
        usingBrowserTTSRef.current = false;
      }

      resolveRef.current = resolve;
      const controller = new AbortController();
      abortRef.current = controller;

      setIsSpeaking(true);

      fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`TTS failed: ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          if (controller.signal.aborted) return;

          const url = URL.createObjectURL(blob);
          objectUrlRef.current = url;

          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onended = () => {
            setIsSpeaking(false);
            audioRef.current = null;
            if (objectUrlRef.current) {
              URL.revokeObjectURL(objectUrlRef.current);
              objectUrlRef.current = null;
            }
            if (resolveRef.current) {
              resolveRef.current();
              resolveRef.current = null;
            }
          };

          audio.onerror = () => {
            setIsSpeaking(false);
            audioRef.current = null;
            if (objectUrlRef.current) {
              URL.revokeObjectURL(objectUrlRef.current);
              objectUrlRef.current = null;
            }
            if (resolveRef.current) {
              resolveRef.current();
              resolveRef.current = null;
            }
          };

          audio.play().catch(() => {
            setIsSpeaking(false);
            if (resolveRef.current) {
              resolveRef.current();
              resolveRef.current = null;
            }
          });
        })
        .catch(async (err) => {
          if (err.name === "AbortError") return;
          console.warn("[TTS] ElevenLabs unavailable, falling back to browser TTS:", err.message);

          // Fallback to browser speech synthesis
          usingBrowserTTSRef.current = true;
          try {
            await speakWithBrowserTTS(text);
          } catch {
            // ignore
          }
          usingBrowserTTSRef.current = false;
          setIsSpeaking(false);
          if (resolveRef.current) {
            resolveRef.current();
            resolveRef.current = null;
          }
        });
    });
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (usingBrowserTTSRef.current) {
      window.speechSynthesis?.cancel();
      usingBrowserTTSRef.current = false;
    }
    setIsSpeaking(false);
    if (resolveRef.current) {
      resolveRef.current();
      resolveRef.current = null;
    }
  }, []);

  return { isSpeaking, speak, cancel };
}
