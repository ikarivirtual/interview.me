import { Mic, MicOff } from "lucide-react";
import { motion } from "motion/react";

interface MicButtonProps {
  isListening: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export default function MicButton({ isListening, onClick, disabled }: MicButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.93 }}
      className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300
        ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
        ${isListening
          ? "bg-red-500/90 shadow-[0_0_30px_rgba(239,68,68,0.3)]"
          : "bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12]"
        }`}
    >
      {/* Pulse rings when listening */}
      {isListening && (
        <>
          <motion.div
            animate={{ scale: [1, 1.8], opacity: [0.25, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-red-500/30"
          />
          <motion.div
            animate={{ scale: [1, 2.2], opacity: [0.15, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            className="absolute inset-0 rounded-full bg-red-500/20"
          />
        </>
      )}

      <div className="relative z-10">
        {isListening ? (
          <MicOff className="w-6 h-6 text-white" />
        ) : (
          <Mic className="w-6 h-6 text-white/60" />
        )}
      </div>
    </motion.button>
  );
}
