import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, FlaskConical, Timer, Database, Target } from 'lucide-react';
import { useExperiments } from '../../../hooks/useApi';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import type { Experiment } from '../../../types/api';

const METRIC_KEYS: Record<string, string[]> = {
  classification: ['accuracy', 'f1', 'precision', 'recall', 'roc_auc'],
  regression: ['r2_score', 'rmse', 'mse', 'mae'],
  clustering: ['silhouette_score', 'calinski_harabasz', 'davies_bouldin'],
  time_series: ['r2_score', 'accuracy', 'mape'],
};

function getPrimaryKey(exp: Experiment): string {
  const keys = METRIC_KEYS[exp.task_type || 'classification'] || METRIC_KEYS.classification;
  if (!exp.metrics) return 'cv_score';
  return keys.find((k) => typeof exp.metrics?.[k] === 'number') || 'cv_score';
}

function getScore(exp: Experiment): number | null {
  const key = getPrimaryKey(exp);
  const m = exp.metrics?.[key];
  if (typeof m === 'number') return m;
  if (typeof exp.cv_score === 'number') return exp.cv_score;
  return null;
}

function getCvScore(exp: Experiment): number | null {
  return typeof exp.cv_score === 'number' ? exp.cv_score : null;
}

function isPercentMetric(key: string): boolean {
  return ['accuracy', 'f1', 'precision', 'recall', 'roc_auc', 'cv_score'].includes(key);
}

function formatScore(value: number | null, percent: boolean): string {
  if (value === null || value === undefined) return '—';
  if (percent) return `${(value * 100).toFixed(2)}%`;
  return value.toFixed(4);
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

const RANK_STYLES = [
  { ring: 'border-amber-400/60', bg: 'from-amber-400/20 to-yellow-500/5', text: 'text-amber-400', icon: <Trophy className="w-6 h-6" /> },
  { ring: 'border-slate-400/50', bg: 'from-slate-400/20 to-slate-500/5', text: 'text-slate-300', icon: <Medal className="w-6 h-6" /> },
  { ring: 'border-orange-500/50', bg: 'from-orange-500/20 to-orange-600/5', text: 'text-orange-400', icon: <Medal className="w-6 h-6" /> },
];

export default function LeaderboardPage() {
  const { data: experiments = [], isLoading } = useExperiments();

  const ranked = useMemo(() => {
    const done = experiments
      .filter((e) => e.status === 'completed' || e.status === 'success')
      .map((e) => ({ exp: e, score: getScore(e) }))
      .filter((r): r is { exp: Experiment; score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score);
    return done;
  }, [experiments]);

  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <PageContainer maxWidth="xl">
      <PageHeader title="Leaderboard" description="Best performing experiments ranked by their primary metric" />

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      ) : ranked.length === 0 ? (
        <EmptyState
          icon={<Trophy className="w-8 h-8" />}
          title="No ranked experiments yet"
          description="Completed experiments with a score will appear here, ranked by primary metric."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {podium.map(({ exp, score }, i) => {
              const key = getPrimaryKey(exp);
              const rank = RANK_STYLES[i];
              return (
                <motion.div
                  key={exp.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className={`rounded-2xl border p-6 bg-gradient-to-b ${rank.bg} border ${rank.ring} flex flex-col gap-3`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-2 text-sm font-bold ${rank.text}`}>
                      {rank.icon}
                      #{i + 1}
                    </span>
                    <span className="text-xs font-mono text-zinc-400">{key}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-zinc-100 truncate">{exp.model}</div>
                    <div className="text-xs text-zinc-500 truncate">{exp.name}</div>
                  </div>
                  <div className="text-3xl font-bold tracking-tight text-zinc-50">
                    {formatScore(score, isPercentMetric(key))}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span className="inline-flex items-center gap-1"><Database className="w-3 h-3" />{exp.dataset || '—'}</span>
                    <span className="inline-flex items-center gap-1"><Target className="w-3 h-3" />{exp.target || '—'}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Rank</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Model</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Dataset</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Task</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Primary Metric</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">CV Score</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Training Time</th>
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {podium.map(({ exp, score }, i) => (
                    <RankRow key={exp.id} exp={exp} score={score} rank={i + 1} />
                  ))}
                  {rest.map(({ exp, score }, i) => (
                    <RankRow key={exp.id} exp={exp} score={score} rank={i + 4} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-zinc-500 flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5" />
            {ranked.length} ranked experiment{ranked.length === 1 ? '' : 's'} · <Timer className="w-3.5 h-3.5" /> scored by primary metric for each task type
          </p>
        </div>
      )}
    </PageContainer>
  );
}

function RankRow({ exp, score, rank }: { exp: Experiment; score: number; rank: number }) {
  const key = getPrimaryKey(exp);
  const percent = isPercentMetric(key);
  const rankStyle = rank <= 3 ? RANK_STYLES[rank - 1].text : 'text-zinc-500';
  return (
    <tr className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3">
        <span className={`font-bold ${rankStyle}`}>#{rank}</span>
      </td>
      <td className="px-4 py-3">
        <div className="font-semibold text-zinc-200">{exp.model}</div>
        <div className="text-xs text-zinc-500">{exp.name}</div>
      </td>
      <td className="px-4 py-3 text-zinc-400">{exp.dataset || '—'}</td>
      <td className="px-4 py-3 text-zinc-400 capitalize">{exp.task_type || '—'}</td>
      <td className="px-4 py-3">
        <span className="font-mono font-semibold text-primary">{formatScore(score, percent)}</span>
        <span className="text-xs text-zinc-500 ml-1.5">({key})</span>
      </td>
      <td className="px-4 py-3 font-mono text-zinc-400">{formatScore(getCvScore(exp), true)}</td>
      <td className="px-4 py-3 text-zinc-400">{formatDuration(exp.training_time)}</td>
      <td className="px-4 py-3 text-zinc-400">{formatDate(exp.run_at || exp.created_at)}</td>
    </tr>
  );
}
