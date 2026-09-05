import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, ArrowRight, CheckCircle2, Loader2, XCircle, ChevronRight } from 'lucide-react';
import SectionCard, { SectionRefresh } from './SectionCard';
import { useExperiments } from '../../../hooks/useApi';
import { getErrorMessage } from '../../../services/http';
import type { Experiment } from '../../../types/api';

type ExpLike = Experiment & Record<string, any>;

function scoreText(exp: ExpLike): string {
  if (exp.cv_score != null && exp.cv_score > 0) return `${(exp.cv_score * 100).toFixed(1)}%`;
  const m = exp.metrics;
  if (!m) return '—';
  const candidate = m.accuracy ?? m.f1_score ?? m.f1 ?? m.r2_score ?? m.r2 ?? m.rmse ?? null;
  if (typeof candidate !== 'number') return '—';
  return m.rmse != null ? candidate.toFixed(3) : `${(candidate * 100).toFixed(1)}%`;
}

export default function RecentExperimentsTable() {
  const navigate = useNavigate();
  const experiments = useExperiments();
  const updatedAt = new Date();

  const rows = useMemo(() => {
    return [...((experiments.data ?? []) as ExpLike[])]
      .sort(
        (a, b) =>
          new Date(b.created_at || b.run_at || 0).getTime() -
          new Date(a.created_at || a.run_at || 0).getTime(),
      )
      .slice(0, 5);
  }, [experiments.data]);

  return (
    <SectionCard
      title="Recent Experiments"
      description="Latest AutoML runs"
      icon={<FlaskConical className="w-4 h-4 text-indigo-400" />}
      action={
        <div className="flex items-center gap-1.5">
          <SectionRefresh refetch={experiments.refetch} isFetching={experiments.isFetching} updatedAt={updatedAt} />
          {rows.length > 0 && (
            <button
              onClick={() => navigate('/app/experiments')}
              className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      }
      loading={experiments.isLoading}
      isError={experiments.isError}
      error={getErrorMessage(experiments.error, 'Failed to load experiments.')}
      onRetry={experiments.refetch}
      empty={rows.length === 0}
      emptyIcon={<FlaskConical className="w-8 h-8 text-indigo-400" />}
      emptyTitle="No experiments yet"
      emptyDescription="Start your first AutoML experiment to train a model."
      emptyAction={{ label: 'Start Training', onClick: () => navigate('/app/training') }}
      skeleton={
        <div className="space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 py-2.5 px-3">
              <div className="h-4 bg-white/[0.05] rounded animate-pulse" />
              <div className="h-4 bg-white/[0.04] rounded animate-pulse" />
              <div className="h-4 bg-white/[0.04] rounded animate-pulse" />
              <div className="h-4 bg-white/[0.04] rounded animate-pulse" />
            </div>
          ))}
        </div>
      }
    >
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-zinc-950/60 text-zinc-400 font-mono text-[11px] uppercase border-b border-zinc-800/80">
            <tr>
              <th className="py-3 px-3 font-semibold">Experiment</th>
              <th className="py-3 px-3 font-semibold">Dataset</th>
              <th className="py-3 px-3 font-semibold">Best Model</th>
              <th className="py-3 px-3 font-semibold">Score</th>
              <th className="py-3 px-3 font-semibold">Status</th>
              <th className="py-3 px-3 text-right font-semibold w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {rows.map((exp) => {
              const status = exp.status;
              const name = exp.name || exp.experiment_name || 'Experiment';
              return (
                <tr
                  key={exp.id}
                  onClick={() => navigate('/app/experiments')}
                  className="hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-3">
                    <div className="font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors truncate max-w-[180px]">
                      {name}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {exp.task_type || exp.problem_type || '—'}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-zinc-300 truncate max-w-[140px]">
                    {exp.dataset_name || exp.dataset || '—'}
                  </td>
                  <td className="py-3 px-3 font-medium text-zinc-200 truncate max-w-[140px]">
                    {exp.model || exp.best_model || '—'}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-emerald-400">{scoreText(exp)}</td>
                  <td className="py-3 px-3">
                    {(status === 'completed' || status === 'success') && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Done
                      </span>
                    )}
                    {(status === 'running' || status === 'queued') && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Loader2 className="w-3 h-3 animate-spin" /> {status}
                      </span>
                    )}
                    {status === 'failed' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3 h-3" /> Failed
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors inline-block" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}