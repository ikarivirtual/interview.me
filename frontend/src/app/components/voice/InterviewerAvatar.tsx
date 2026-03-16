import { motion } from "motion/react";

interface InterviewerAvatarProps {
  isSpeaking: boolean;
  isProcessing: boolean;
}

export default function InterviewerAvatar({ isSpeaking, isProcessing }: InterviewerAvatarProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer ambient glow */}
      <motion.div
        animate={
          isSpeaking
            ? { scale: [1, 1.3, 1], opacity: [0.08, 0.2, 0.08] }
            : isProcessing
              ? { scale: [1, 1.1, 1], opacity: [0.05, 0.12, 0.05] }
              : { scale: 1, opacity: 0.05 }
        }
        transition={{ duration: isSpeaking ? 0.6 : 2.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-56 h-56 rounded-full bg-emerald-500 blur-[60px]"
      />

      {/* Secondary ring — pulses when speaking */}
      {isSpeaking && (
        <motion.div
          animate={{ scale: [1, 1.4], opacity: [0.15, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
          className="absolute w-36 h-36 rounded-full border border-emerald-400/30"
        />
      )}

      {/* Main orb */}
      <motion.div
        animate={
          isSpeaking
            ? { scale: [1, 1.06, 1] }
            : isProcessing
              ? { rotate: 360 }
              : { scale: 1 }
        }
        transition={
          isSpeaking
            ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
            : isProcessing
              ? { duration: 4, repeat: Infinity, ease: "linear" }
              : {}
        }
        className="relative w-28 h-28 rounded-full overflow-hidden"
      >
        {/* Gradient fill */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600" />

        {/* Subtle inner highlight */}
        <div className="absolute top-0 inset-x-0 h-[45%] bg-gradient-to-b from-white/20 to-transparent" />

        {/* Border ring */}
        <div className="absolute inset-0 rounded-full border border-white/10" />

        {/* Inner pulse for processing */}
        {isProcessing && (
          <motion.div
            animate={{ opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-4 rounded-full bg-white/10"
          />
        )}
      </motion.div>
    </div>
  );
}
