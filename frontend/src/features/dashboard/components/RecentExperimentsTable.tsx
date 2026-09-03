import { useNavigate } from 'react-router-dom';
import { FlaskConical, ArrowRight, CheckCircle2, Loader2, XCircle, ChevronRight } from 'lucide-react';

interface ExperimentItem {
  id: string;
  name: string;
  dataset: string;
  bestModel: string;
  score: string;
  status: 'completed' | 'running' | 'failed' | 'queued' | 'success';
  problemType: string;
}

export default function RecentExperimentsTable({ experiments }: { experiments?: any[] }) {
  const navigate = useNavigate();

  const list: ExperimentItem[] = (experiments && experiments.length > 0
    ? experiments.slice(0, 5).map((exp, idx) => {
        let scoreText = '—';
        if (exp.cv_score != null && exp.cv_score > 0) {
          scoreText = `${(exp.cv_score * 100).toFixed(1)}%`;
        } else if (exp.metrics) {
          const m = exp.metrics;
          const scoreCandidate =
            m.accuracy ?? m.f1_score ?? m.f1 ?? m.r2_score ?? m.r2 ?? m.rmse ?? null;
          if (typeof scoreCandidate === 'number') {
            scoreText = m.rmse != null ? scoreCandidate.toFixed(3) : `${(scoreCandidate * 100).toFixed(1)}%`;
          }
        }
        const statusMap: Record<string, ExperimentItem['status']> = {
          running: 'running',
          queued: 'running',
          completed: 'completed',
          success: 'completed',
          failed: 'failed',
        };
        return {
          id: exp.id || `exp-${idx}`,
          name: exp.name || exp.title || exp.experiment_name || `Experiment #${idx + 1}`,
          dataset: exp.dataset_name || exp.dataset || '—',
          bestModel: exp.model || exp.best_model || '—',
          score: scoreText,
          status: statusMap[exp.status] || 'completed',
          problemType: exp.task_type || exp.problem_type || '—',
        };
      })
    : []);

  return (
    <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md overflow-hidden">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">Recent Experiments</h3>
        </div>
        <button
          onClick={() => navigate('/app/experiments')}
          className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <span>View All</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {list.length === 0 ? (
        <div className="p-6 text-center">
          <FlaskConical className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-xs text-zinc-400 font-mono">No experiments yet</p>
          <button
            onClick={() => navigate('/app/training')}
            className="mt-3 inline-block px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            Start Training
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-zinc-950/60 text-zinc-400 font-mono text-[11px] uppercase border-b border-zinc-800/80">
              <tr>
                <th className="py-3 px-4 font-semibold">Experiment</th>
                <th className="py-3 px-4 font-semibold">Dataset</th>
                <th className="py-3 px-4 font-semibold">Best Model</th>
                <th className="py-3 px-4 font-semibold">Score</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {list.map((exp, i) => (
                <tr
                  key={exp.id}
                  onClick={() => navigate('/app/experiments')}
                  className="hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors">
                      {exp.name}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">{exp.problemType}</span>
                  </td>

                  <td className="py-3 px-4 font-mono text-zinc-300">
                    {exp.dataset}
                  </td>

                  <td className="py-3 px-4 font-medium text-zinc-200">
                    {exp.bestModel}
                  </td>

                  <td className="py-3 px-4 font-mono font-semibold text-emerald-400">
                    {exp.score}
                  </td>

                  <td className="py-3 px-4">
                    {(exp.status === 'completed' || exp.status === 'success') && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Complete
                      </span>
                    )}
                    {exp.status === 'running' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Loader2 className="w-3 h-3 animate-spin" /> Running
                      </span>
                    )}
                    {exp.status === 'failed' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3 h-3" /> Failed
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors inline-block" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

