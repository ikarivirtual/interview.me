import { motion } from "motion/react";

interface ScoreCardProps {
  label: string;
  score: number;
  index: number;
}

export default function ScoreCard({ label, score, index }: ScoreCardProps) {
  const percentage = (score / 10) * 100;

  const getAccentColor = () => {
    if (score >= 8) return { bar: "from-emerald-400 to-emerald-500", text: "text-emerald-400", glow: "rgba(52,211,153,0.15)" };
    if (score >= 6) return { bar: "from-sky-400 to-cyan-500", text: "text-sky-400", glow: "rgba(56,189,248,0.15)" };
    if (score >= 4) return { bar: "from-amber-400 to-orange-500", text: "text-amber-400", glow: "rgba(251,191,36,0.15)" };
    return { bar: "from-red-400 to-red-500", text: "text-red-400", glow: "rgba(248,113,113,0.15)" };
  };

  const accent = getAccentColor();
  const isOverall = label === "overall";

  if (isOverall) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="col-span-full bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 relative overflow-hidden"
      >
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 30% 50%, ${accent.glow}, transparent 70%)` }}
        />
        <div className="relative flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-white/30 font-medium text-[11px] tracking-[0.25em] uppercase">
              Overall Score
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`text-5xl font-light ${accent.text}`} style={{ fontFamily: "'Instrument Serif', serif" }}>
                {score}
              </span>
              <span className="text-white/20 text-lg font-light">/10</span>
            </div>
          </div>
          <div className="w-48">
            <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ delay: 0.4, duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className={`h-full rounded-full bg-gradient-to-r ${accent.bar}`}
              />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 + 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 hover:bg-white/[0.04] transition-colors duration-300"
    >
      <div className="flex flex-col gap-3 mb-4">
        <span className={`font-light text-3xl ${accent.text}`} style={{ fontFamily: "'Instrument Serif', serif" }}>
          {score}<span className="text-white/15 text-base">/10</span>
        </span>
        <span className="text-white/35 font-medium text-[10px] tracking-[0.2em] uppercase leading-tight">
          {label.replace(/_/g, " ")}
        </span>
      </div>
      <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ delay: index * 0.06 + 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full bg-gradient-to-r ${accent.bar}`}
        />
      </div>
    </motion.div>
  );
}
