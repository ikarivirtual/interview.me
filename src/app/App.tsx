import React, { useState } from "react";
import { motion } from "motion/react";
import { Search, ArrowRight } from "lucide-react";

export default function App() {
  const [job, setJob] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (job) {
      alert(`Connecting you to the AI agent for: ${job}...`);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden font-sans flex flex-col selection:bg-[#4facfe] selection:text-white bg-[#82C8FF]">
      {/* 
        Light Windows Vista Aurora Background 
        Crisp, airy blue base with vibrant cyan, soft green, and bright white sweeping lights.
      */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Slightly darker airy background gradient for better contrast */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#3BAFDA] via-[#5CB3FF] to-[#A3D9FF]" />
        
        {/* Swooping Aurora Streaks */}
        <motion.div 
          animate={{
            transform: ["translate(-5%, -5%) rotate(-10deg)", "translate(2%, 2%) rotate(-8deg)", "translate(-5%, -5%) rotate(-10deg)"]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[120%] h-[50%] bg-[#00A3FF] blur-[120px] opacity-30 rounded-[100%]"
        />
        <motion.div 
          animate={{
            transform: ["translate(5%, 5%) rotate(15deg)", "translate(-2%, -2%) rotate(12deg)", "translate(5%, 5%) rotate(15deg)"]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-10%] right-[-10%] w-[100%] h-[60%] bg-[#00FFB2] blur-[140px] opacity-20 rounded-[100%]"
        />
        <div className="absolute top-[20%] left-[10%] w-[80%] h-[30%] bg-white blur-[90px] opacity-60 rotate-[-15deg]" />

        {/* Diagonal Light Ray (Crisp glare for the glass effect) */}
        <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_20%,rgba(255,255,255,0.4)_25%,rgba(255,255,255,0.6)_30%,transparent_35%)] pointer-events-none mix-blend-overlay opacity-50" />
      </div>

      {/* Navbar (Minimalist Light Aero Glass) */}
      <nav className="relative z-10 w-full px-8 py-5 flex justify-between items-center">
        <div className="text-xl font-semibold tracking-tight text-white flex items-center gap-3 [text-shadow:0_1px_3px_rgba(0,0,0,0.3),_0_2px_8px_rgba(0,0,0,0.2)]">
           {/* Modernized Vista Glass Orb Logo */}
           <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-[#4facfe] to-[#00f2fe] shadow-[0_2px_8px_rgba(0,0,0,0.2),_inset_0_2px_4px_rgba(255,255,255,0.8)] border border-white/60 flex items-center justify-center overflow-hidden">
             {/* Smooth Orb Top Gloss */}
             <div className="absolute top-0 inset-x-0 h-[60%] bg-gradient-to-b from-white/90 to-transparent rounded-b-full opacity-80" />
           </div>
           interview.me
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center -mt-16">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl w-full flex flex-col items-center"
        >
          {/* Headline - White fonts with crisp Vista-style drop shadows for contrast against light background */}
          <h1 className="text-4xl md:text-6xl font-medium mb-12 text-white leading-tight tracking-tight [text-shadow:0_2px_4px_rgba(0,100,150,0.4),_0_4px_16px_rgba(0,0,0,0.15)]">
            <span className="opacity-95 font-light">Get started:</span><br/>
            <span className="font-semibold text-white filter drop-shadow-[0_2px_2px_rgba(0,0,0,0.1)]">
              Who do you want to become?
            </span>
          </h1>

          {/* Light Aero Glass Form Container */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
            {/* 
              Crisp Light Aero Glass Panel 
              - backdrop blur
              - highly transparent white
              - bright top/left borders for 3D lighting edge
            */}
            <div 
              className={`relative p-2 rounded-[2rem] transition-all duration-500 backdrop-blur-2xl bg-white/30 border border-white/60 shadow-[0_16px_40px_rgba(0,0,0,0.08),_inset_0_2px_4px_rgba(255,255,255,0.8)]
                ${isFocused ? 'ring-4 ring-white/50 shadow-[0_0_40px_rgba(255,255,255,0.6)]' : ''}
              `}
            >
              <div className="relative flex items-center w-full bg-white/40 rounded-[1.5rem] border border-white/50 shadow-[inset_0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
                
                <Search className="absolute left-6 w-5 h-5 text-white drop-shadow-md" />
                
                <input
                  type="text"
                  placeholder="e.g., Senior Software Engineer"
                  value={job}
                  onChange={(e) => setJob(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  className="w-full pl-14 pr-36 py-4 sm:py-5 bg-transparent text-xl font-medium text-white placeholder-white/80 focus:outline-none [text-shadow:0_1px_3px_rgba(0,0,0,0.2)]"
                />
                
                {/* Modernized Glossy Button */}
                <div className="absolute right-2 top-2 bottom-2">
                  <button 
                    type="submit"
                    className="relative w-full h-full px-6 sm:px-8 rounded-[1.2rem] overflow-hidden bg-gradient-to-b from-[#4facfe] to-[#00f2fe] border border-white/50 shadow-[0_4px_12px_rgba(0,163,255,0.3),_inset_0_2px_4px_rgba(255,255,255,0.6)] active:scale-[0.97] transition-all hover:shadow-[0_6px_16px_rgba(0,163,255,0.4),_inset_0_2px_4px_rgba(255,255,255,0.8)] hover:brightness-105 group flex items-center justify-center gap-2"
                  >
                    {/* Modern smooth top highlight instead of harsh 50% cutoff */}
                    <div className="absolute inset-x-0 top-0 h-[60%] bg-gradient-to-b from-white/40 to-transparent opacity-80" />

                    <span className="relative z-10 text-white font-semibold text-lg [text-shadow:0_1px_2px_rgba(0,0,0,0.2)] tracking-wide flex items-center gap-2">
                      Start
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </form>

        </motion.div>
      </main>

    </div>
  );
}
