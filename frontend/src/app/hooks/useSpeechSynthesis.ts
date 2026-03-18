import { useState, useCallback, useRef, useEffect } from "react";

interface SpeechSynthesisResult {
  isSpeaking: boolean;
  speak: (text: string) => Promise<void>;
  cancel: () => void;
}

const canStreamAudio =
  typeof MediaSource !== "undefined" &&
  MediaSource.isTypeSupported("audio/mpeg");

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

function streamAudioPlayback(
  response: Response,
  signal: AbortSignal,
): { audio: HTMLAudioElement; objectUrl: string; done: Promise<void> } {
  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  const audio = new Audio(objectUrl);

  const done = new Promise<void>((resolve, reject) => {
    mediaSource.addEventListener("sourceopen", () => {
      const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
      const queue: Uint8Array[] = [];
      let streamDone = false;

      const flush = () => {
        if (sourceBuffer.updating || queue.length === 0) return;
        if (mediaSource.readyState !== "open") return;
        sourceBuffer.appendBuffer(queue.shift()! as BufferSource);
      };

      sourceBuffer.addEventListener("updateend", () => {
        if (queue.length > 0) {
          flush();
        } else if (streamDone && mediaSource.readyState === "open") {
          mediaSource.endOfStream();
        }
      });

      const reader = response.body!.getReader();

      const pump = async () => {
        try {
          while (true) {
            if (signal.aborted) {
              reader.cancel();
              return;
            }
            const { done: readerDone, value } = await reader.read();
            if (readerDone) {
              streamDone = true;
              // If not currently updating and queue is empty, end now
              if (!sourceBuffer.updating && queue.length === 0 && mediaSource.readyState === "open") {
                mediaSource.endOfStream();
              }
              return;
            }
            queue.push(value);
            flush();
          }
        } catch (err) {
          if (signal.aborted) return;
          if (mediaSource.readyState === "open") {
            mediaSource.endOfStream("network");
          }
        }
      };

      pump();
    });

    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("Audio playback error"));
  });

  // Start playback immediately — audio will play as data arrives
  audio.play().catch(() => {});

  return { audio, objectUrl, done };
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

      const onDone = () => {
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

      fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

          if (canStreamAudio && res.body) {
            // Stream audio chunks into MediaSource for immediate playback
            const { audio, objectUrl, done } = streamAudioPlayback(res, controller.signal);
            audioRef.current = audio;
            objectUrlRef.current = objectUrl;
            return done;
          }

          // Fallback: download full blob then play
          return res.blob().then((blob) => {
            if (controller.signal.aborted) return;

            const url = URL.createObjectURL(blob);
            objectUrlRef.current = url;

            const audio = new Audio(url);
            audioRef.current = audio;

            return new Promise<void>((resolvePlay) => {
              audio.onended = () => resolvePlay();
              audio.onerror = () => resolvePlay();
              audio.play().catch(() => resolvePlay());
            });
          });
        })
        .then(() => {
          if (!controller.signal.aborted) onDone();
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
          onDone();
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
