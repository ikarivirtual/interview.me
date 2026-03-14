import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function ChatbotPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const position = searchParams.get("position") || "Interview";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-700 p-4 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <h1 className="text-xl font-semibold text-white">Interview: {position}</h1>
        <div className="w-16" /> {/* Spacer for alignment */}
      </div>

      {/* Chat Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="bg-slate-700 rounded-lg p-4 max-w-md w-fit">
          <p className="text-white">Hi! I'm your AI interview assistant for the <strong>{position}</strong> role. Let's get started!</p>
        </div>
        <div className="bg-slate-600 rounded-lg p-4 max-w-md w-fit text-slate-300 text-sm">
          <p>🔌 Backend Integration: DigitalOcean AI Agent (Coming Soon)</p>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-700 p-6">
        <div className="flex gap-2 max-w-2xl">
          <input
            type="text"
            placeholder="Type your message..."
            className="flex-1 bg-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2 font-medium transition">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}