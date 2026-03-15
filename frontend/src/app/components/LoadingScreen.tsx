import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const steps = [
  { label: "Analyzing job posting", icon: "🔍" },
  { label: "Researching interview questions", icon: "📋" },
  { label: "Preparing your interviewer", icon: "🎙️" },
];

const STEP_INTERVAL = 4000;

export default function LoadingScreen() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, steps.length - 1));
    }, STEP_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#3BAFDA] via-[#5CB3FF] to-[#A3D9FF]" />
      <div className="absolute top-[20%] left-[10%] w-[80%] h-[30%] bg-white blur-[90px] opacity-60 rotate-[-15deg]" />

      <div className="relative z-10 flex flex-col items-center gap-12 max-w-md w-full px-6">
        {/* Pulsing orb */}
        <div className="relative">
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.6, 0.3, 0.6],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 -m-4 rounded-full bg-white/40 blur-xl"
          />
          <motion.div
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.4, 0.2, 0.4],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            className="absolute inset-0 -m-8 rounded-full bg-[#4facfe]/30 blur-2xl"
          />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 rounded-full border-[3px] border-white/30 border-t-white"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4facfe] to-[#00f2fe] shadow-[inset_0_2px_4px_rgba(255,255,255,0.8)]">
              <div className="w-full h-[60%] bg-gradient-to-b from-white/70 to-transparent rounded-full" />
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="w-full space-y-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: i <= activeStep ? 1 : 0.3,
                x: 0,
              }}
              transition={{ delay: i * 0.15, duration: 0.4 }}
              className="flex items-center gap-4"
            >
              <div className="relative flex items-center justify-center w-10 h-10">
                {i < activeStep ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-8 h-8 rounded-full bg-white/40 backdrop-blur-sm border border-white/60 flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                ) : i === activeStep ? (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-8 h-8 rounded-full bg-white/30 backdrop-blur-sm border border-white/50 flex items-center justify-center text-sm"
                  >
                    {step.icon}
                  </motion.div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-sm opacity-50">
                    {step.icon}
                  </div>
                )}
              </div>

              <span
                className={`text-lg font-medium [text-shadow:0_1px_3px_rgba(0,0,0,0.2)] transition-colors duration-300 ${
                  i <= activeStep ? "text-white" : "text-white/40"
                }`}
              >
                {step.label}
                {i === activeStep && (
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  >
                    ...
                  </motion.span>
                )}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Tip */}
        <AnimatePresence mode="wait">
          <motion.p
            key={activeStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="text-white/50 text-sm text-center"
          >
            {activeStep === 0 && "Extracting role requirements and tech stack"}
            {activeStep === 1 && "Finding real interview questions from past candidates"}
            {activeStep === 2 && "Almost ready — your interviewer is warming up"}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
