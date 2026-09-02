import { useMemo } from 'react';
import {
  Sparkles, BrainCircuit, Lightbulb, CheckCircle, TriangleAlert, Flag,
  Target, BarChart3, ShieldAlert, Layers, Database, ArrowUpRight,
} from 'lucide-react';
import type { DatasetAnalysisResult } from '../types';
import type { Recommendation } from '../../../../types/api';
import { gradeColor } from '../utils';
import { cn } from '../../../../lib/cn';

interface InsightsTabProps {
  analysis?: DatasetAnalysisResult;
}

const recIcons: Record<string, typeof Lightbulb> = {
  missing: TriangleAlert,
  outliers: BarChart3,
  duplicates: Layers,
  imbalance: Target,
  quality: ShieldAlert,
  cleaning: TriangleAlert,
  default: Lightbulb,
};

export function InsightsTab({ analysis }: InsightsTabProps) {
  const insights = analysis?.insights || [];
  const recommendations = useMemo(
    () => (analysis?.recommendations || []).sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'high' ? -1 : 1)),
    [analysis],
  );
  const qs = analysis?.quality_score;

  if (!analysis) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <BrainCircuit className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">Run the analysis to see AI-generated insights and recommendations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BrainCircuit className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-zinc-100">Insights</h3>
          <span className="text-xs text-zinc-500 ml-auto">Generated from statistical analysis</span>
        </div>
        {insights.length === 0 ? (
          <p className="text-sm text-zinc-500">No insights generated for this dataset.</p>
        ) : (
          <div className="space-y-2.5">
            {insights.map((ins, i) => (
              <div key={i} className="flex gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-zinc-300 leading-relaxed">{ins}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Recommendations</h3>
          <span className="text-xs text-zinc-500 ml-auto">{recommendations.length} action items</span>
        </div>
        {recommendations.length === 0 ? (
          <p className="text-sm text-zinc-500">No recommendations. The dataset looks in good shape.</p>
        ) : (
          <div className="space-y-2">
            {recommendations.map((r, i) => {
              const Icon = recIcons[r.action?.toLowerCase()] || recIcons.default;
              const high = r.priority === 'high';
              const medium = r.priority === 'medium';
              return (
                <div key={i} className="flex gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                  <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', high ? 'bg-red-500/10 text-red-400' : medium ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400')}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-200">{r.action}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide', high ? 'bg-red-500/10 text-red-400' : medium ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400')}>
                        {r.priority}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{r.message}</p>
                    {r.columns && r.columns.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {r.columns.map((c) => (
                          <span key={c} className="rounded bg-white/[0.05] border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">{c}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="self-center rounded-lg border border-border p-1.5 text-zinc-500 hover:text-primary hover:border-primary/40 transition-colors"
                    title="Inspect recommendation"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {qs?.deductions && qs.deductions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Flag className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Quality Deductions</h3>
          </div>
          <ul className="space-y-1.5">
            {qs.deductions.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full mt-1" style={{ backgroundColor: gradeColor(qs.grade) }} />
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.target_detection?.candidates && analysis.target_detection.candidates.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-fuchsia-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Target Candidates</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {analysis.target_detection.candidates.map((c) => (
              <div key={c.column} className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-300">{c.column}</span>
                <span className="ml-auto text-[10px] font-mono text-fuchsia-400">{c.score.toFixed(1)}/10</span>
              </div>
            ))}
          </div>
          {analysis.target && (
            <p className="text-xs text-zinc-500 mt-3 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Suggested target: <span className="font-mono text-fuchsia-300">{analysis.target}</span>
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-3">
        <Database className="w-4 h-4 text-zinc-500" />
        <p className="text-xs text-zinc-500">Insights are derived from the dataset analysis pipeline. Re-run analysis after cleaning to refresh these recommendations.</p>
      </div>
    </div>
  );
}
