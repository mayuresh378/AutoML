import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Bot, Sparkles, ArrowRight, Lightbulb } from 'lucide-react';

interface Props {
  suggestions?: any[];
}

function extractText(s: any): string {
  if (typeof s === 'string') return s;
  if (!s) return '';
  return s.text || s.message || s.body || s.suggestion || s.title || '';
}

export default function AiInsights({ suggestions = [] }: Props) {
  const navigate = useNavigate();

  const insights = (suggestions || []).slice(0, 3).map(extractText).filter(Boolean);

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/30 via-zinc-900/60 to-purple-950/20 border border-purple-500/20 backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Bot className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">AutoML AI Insights</h3>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Explain AI Engine
        </span>
      </div>

      {insights.length > 0 ? (
        <div className="space-y-2.5 mb-4">
          {insights.map((text, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
              <Lightbulb className={`w-4 h-4 ${['text-amber-400', 'text-indigo-400', 'text-emerald-400'][idx % 3]} flex-shrink-0 mt-0.5`} />
              <span>{text}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500 font-mono mb-4">
          No insights available yet. Run experiments to generate AI-powered insights.
        </p>
      )}

      <button
        onClick={() => navigate('/app/explain')}
        className="w-full py-1.5 px-3 rounded-lg text-xs font-medium bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span>View Full Explainability Report</span>
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
