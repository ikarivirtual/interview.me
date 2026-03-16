import { motion } from "motion/react";

interface ScoreCardProps {
  label: string;
  score: number;
  index: number;
}

export default function ScoreCard({ label, score, index }: ScoreCardProps) {
  const percentage = (score / 10) * 100;

  const getAccentColor = () => {
    if (score >= 8) return { bar: "from-emerald-400 to-emerald-500", text: "text-emerald-400", bg: "bg-emerald-400" };
    if (score >= 6) return { bar: "from-sky-400 to-cyan-500", text: "text-sky-400", bg: "bg-sky-400" };
    if (score >= 4) return { bar: "from-amber-400 to-orange-500", text: "text-amber-400", bg: "bg-amber-400" };
    return { bar: "from-red-400 to-red-500", text: "text-red-400", bg: "bg-red-400" };
  };

  const accent = getAccentColor();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.04] transition-colors duration-300"
    >
      <div className="flex justify-between items-center mb-3.5">
        <span className="text-white/50 font-medium text-xs tracking-wider uppercase" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {label.replace(/_/g, " ")}
        </span>
        <span className={`font-semibold text-lg ${accent.text}`} style={{ fontFamily: "'Instrument Serif', serif" }}>
          {score}
        </span>
      </div>
      <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ delay: index * 0.08 + 0.3, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full bg-gradient-to-r ${accent.bar}`}
        />
      </div>
    </motion.div>
  );
}
