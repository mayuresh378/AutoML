import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Loader2, Clock, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

interface JobItem {
  id?: string;
  experiment_name?: string;
  dataset_name?: string;
  target_column?: string;
  algorithm?: string;
  status?: string;
  progress?: number;
  created_at?: string;
}

export default function RunningJobs({ jobs = [] }: { jobs?: JobItem[] }) {
  const navigate = useNavigate();

  const activeJobs = (jobs || []).filter(
    (j) => j.status === 'running' || j.status === 'queued',
  );

  return (
    <div className="mb-6 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200 tracking-tight uppercase">
            Running Training Jobs
          </h3>
          <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 ml-1">
            {activeJobs.length} Active
          </span>
        </div>
        <button
          onClick={() => navigate('/app/training')}
          className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>View All Jobs</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {activeJobs.length === 0 ? (
        <div className="p-4 rounded-lg bg-zinc-950/40 border border-zinc-800/60 text-center">
          <p className="text-xs text-zinc-400 font-mono">
            No training jobs currently running
          </p>
          <button
            onClick={() => navigate('/app/training')}
            className="mt-2 inline-block px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Start a Training Job
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {activeJobs.map((job, idx) => {
            const progress = job.progress ?? 0;
            const label = job.experiment_name || 'Training job';
            const stage = job.algorithm ? `Algorithm: ${job.algorithm}` : job.status === 'queued' ? 'Queued' : 'Running';
            const eta = job.status === 'queued' ? 'Waiting in queue' : 'In progress';
            return (
              <div key={job.id || idx} className="p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/80">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-100">{label}</span>
                    <span className="text-[11px] font-mono text-zinc-400">· {stage}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {job.status === 'queued' ? (
                      <span className="text-xs font-mono font-semibold text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Queued
                      </span>
                    ) : (
                      <span className="text-xs font-mono font-semibold text-indigo-400">{progress}%</span>
                    )}
                    <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      {eta}
                    </span>
                    <button
                      onClick={() => navigate('/app/training')}
                      className="px-2 py-1 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                </div>

                {job.status === 'running' && (
                  <div className="h-2 w-full bg-zinc-800/60 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
