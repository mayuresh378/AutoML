import { useNavigate } from 'react-router-dom';
import { Bot, Sparkles, ArrowRight, Lightbulb } from 'lucide-react';
import SectionCard, { SectionRefresh } from './SectionCard';
import { useAISuggestions } from '../../../hooks/useApi';
import { getErrorMessage } from '../../../services/http';

function extractText(s: any): string {
  if (typeof s === 'string') return s;
  if (!s) return '';
  return s.text || s.message || s.body || s.suggestion || s.title || '';
}

export default function AiInsights() {
  const navigate = useNavigate();
  const suggestions = useAISuggestions();
  const updatedAt = new Date();

  const insights = (suggestions.data ?? []).slice(0, 3).map(extractText).filter(Boolean);

  return (
    <SectionCard
      title="AutoML AI Insights"
      icon={<Bot className="w-4 h-4 text-purple-400" />}
      action={<SectionRefresh refetch={suggestions.refetch} isFetching={suggestions.isFetching} updatedAt={updatedAt} />}
      loading={suggestions.isLoading}
      isError={suggestions.isError}
      error={getErrorMessage(suggestions.error, 'AI insights are unavailable.')}
      onRetry={suggestions.refetch}
      empty={insights.length === 0}
      emptyIcon={<Sparkles className="w-8 h-8 text-purple-400" />}
      emptyTitle="No insights available yet"
      emptyDescription="Run experiments to generate AI-powered insights."
    >
      <>
        <div className="space-y-2.5 mb-4">
          {insights.map((text, idx) => (
            <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300">
              <Lightbulb className={`w-4 h-4 ${['text-amber-400', 'text-indigo-400', 'text-emerald-400'][idx % 3]} flex-shrink-0 mt-0.5`} />
              <span>{text}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate('/app/explain')}
          className="w-full py-1.5 px-3 rounded-lg text-xs font-medium bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <span>View Full Explainability Report</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </>
    </SectionCard>
  );
}