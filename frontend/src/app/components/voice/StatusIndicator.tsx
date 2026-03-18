import { motion } from "motion/react";

type InterviewStatus = "initializing" | "ai_speaking" | "listening" | "processing" | "ended";

interface StatusIndicatorProps {
  status: InterviewStatus;
}

const statusConfig: Record<InterviewStatus, { label: string; color: string; dotColor: string }> = {
  initializing: { label: "Setting up...", color: "text-white/30", dotColor: "bg-white/30" },
  ai_speaking: { label: "Speaking", color: "text-blue-400/80", dotColor: "bg-blue-400" },
  listening: { label: "Listening", color: "text-sky-400/80", dotColor: "bg-sky-400" },
  processing: { label: "Thinking", color: "text-amber-400/80", dotColor: "bg-amber-400" },
  ended: { label: "Complete", color: "text-white/40", dotColor: "bg-white/40" },
};

export default function StatusIndicator({ status }: StatusIndicatorProps) {
  const { label, color, dotColor } = statusConfig[status];

  return (
    <div className={`flex items-center gap-2.5 text-xs font-medium tracking-widest uppercase ${color}`} style={{ fontFamily: "'Outfit', sans-serif" }}>
      {status !== "ended" && status !== "initializing" && (
        <motion.span
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`}
        />
      )}
      <span>{label}</span>
    </div>
  );
}

export type { InterviewStatus };
