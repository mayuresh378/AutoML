import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Play, CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react';
import SectionCard, { SectionRefresh } from './SectionCard';
import { useTrainingQueue, useExperiments } from '../../../hooks/useApi';
import { getErrorMessage } from '../../../services/http';
import type { TrainingJob } from '../../../types/api';

function statusOf(job: TrainingJob): string {
  return (job.status as string).toLowerCase();
}

function isActiveStatus(status: string): boolean {
  return status === 'training' || status === 'running' || status === 'active';
}

function formatElapsed(createdAt?: string): string {
  if (!createdAt) return '';
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return '';
  const s = Math.max(0, Math.floor((Date.now() - start) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function TrainingActivity() {
  const navigate = useNavigate();
  const queue = useTrainingQueue();
  const experiments = useExperiments();
  const isFetching = queue.isFetching || experiments.isFetching;

  const summary = useMemo(() => {
    const exps = experiments.data ?? [];
    const jobs = queue.data ?? [];
    return {
      active: jobs.filter((j) => isActiveStatus(statusOf(j))).length,
      queued: jobs.filter((j) => statusOf(j) === 'queued').length,
      completed: exps.filter((e) => e.status === 'completed' || e.status === 'success').length,
      failed: exps.filter((e) => e.status === 'failed').length,
    };
  }, [queue.data, experiments.data]);

  const activeJobs = (queue.data ?? []).filter((j) => {
    const s = statusOf(j);
    return isActiveStatus(s) || s === 'queued';
  });

  const updatedAt = new Date();

  return (
    <SectionCard
      title="Training Activity"
      icon={<Loader2 className="w-4 h-4 text-indigo-400" />}
      action={
        <SectionRefresh refetch={() => { queue.refetch(); experiments.refetch(); }} isFetching={isFetching} updatedAt={updatedAt} />
      }
      loading={queue.isLoading || experiments.isLoading}
      isError={queue.isError || experiments.isError}
      error={getErrorMessage(queue.error || experiments.error, 'Failed to load training jobs.')}
      onRetry={() => { queue.refetch(); experiments.refetch(); }}
      empty={activeJobs.length === 0 && summary.completed === 0}
      emptyIcon={<Play className="w-8 h-8 text-indigo-400" />}
      emptyTitle="No training jobs running"
      emptyDescription="Start your first AutoML experiment to train a model."
      emptyAction={{ label: 'Start Training', onClick: () => navigate('/app/training') }}
    >
      {summary.completed > 0 && activeJobs.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-zinc-400">No training jobs currently running.</p>
          <button
            onClick={() => navigate('/app/training')}
            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            <Play className="w-3 h-3" /> Start Training
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary counts */}
          <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
            <div className="p-2.5 rounded-lg bg-emerald-500/[0.07] border border-emerald-500/15 text-center">
              <span className="text-emerald-400 font-bold text-base block tabular-nums">{summary.active}</span>
              <span className="text-zinc-500">active</span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/[0.07] border border-amber-500/15 text-center">
              <span className="text-amber-400 font-bold text-base block tabular-nums">{summary.queued}</span>
              <span className="text-zinc-500">queued</span>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/[0.07] border border-indigo-500/15 text-center">
              <span className="text-indigo-400 font-bold text-base block tabular-nums">{summary.completed}</span>
              <span className="text-zinc-500">completed</span>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500/[0.07] border border-rose-500/15 text-center">
              <span className="text-rose-400 font-bold text-base block tabular-nums">{summary.failed}</span>
              <span className="text-zinc-500">failed</span>
            </div>
          </div>

          {activeJobs.map((job, idx) => {
            const progress = Math.min(100, Math.max(0, job.progress ?? 0));
            const label = job.experiment_name || 'Training job';
            const algorithm = job.algorithm || 'AutoML';
            const isQueued = statusOf(job) === 'queued';
            const isRunning = !isQueued;
            return (
              <div key={job.id || idx} className="p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/80">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {isRunning ? (
                      <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span className="text-xs font-medium text-zinc-100 truncate">{label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-zinc-400 truncate">{algorithm}</span>
                    {isQueued ? (
                      <span className="text-[11px] font-mono font-semibold text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Queued
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono font-semibold text-indigo-400">{progress}%</span>
                    )}
                  </div>
                </div>
                {isRunning ? (
                  <div className="h-2 w-full bg-zinc-800/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, progress)}%` }}
                    />
                  </div>
                ) : (
                  <p className="text-[11px] font-mono text-amber-300/70">Waiting in queue</p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] font-mono text-zinc-500">Elapsed {formatElapsed(job.created_at)}</span>
                  <button
                    onClick={() => navigate('/app/training')}
                    className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    View <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}