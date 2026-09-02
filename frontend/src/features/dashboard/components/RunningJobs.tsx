import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Loader2, Play, Clock, ArrowRight } from 'lucide-react';

interface Job {
  id: string;
  name: string;
  progress: number;
  stage: string;
  eta: string;
}

const ACTIVE_JOBS: Job[] = [
  {
    id: 'job-1',
    name: 'Customer Churn AutoML',
    progress: 78,
    stage: 'Hyperparameter Tuning (Trial 14/20)',
    eta: '~1m 24s remaining',
  },
  {
    id: 'job-2',
    name: 'House Price Regression',
    progress: 42,
    stage: 'Training Model 7/20: Random Forest Regressor',
    eta: '~3m 10s remaining',
  },
];

export default function RunningJobs() {
  const navigate = useNavigate();

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
            {ACTIVE_JOBS.length} Active
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

      <div className="space-y-4">
        {ACTIVE_JOBS.map((job) => (
          <div key={job.id} className="p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-100">{job.name}</span>
                <span className="text-[11px] font-mono text-zinc-400">· {job.stage}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-indigo-400">{job.progress}%</span>
                <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-400" />
                  {job.eta}
                </span>
                <button
                  onClick={() => navigate('/app/training')}
                  className="px-2 py-1 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  View
                </button>
              </div>
            </div>

            <div className="h-2 w-full bg-zinc-800/60 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${job.progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
