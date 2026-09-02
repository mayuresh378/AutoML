import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, ArrowRight, CheckCircle2, Loader2, XCircle, ChevronRight } from 'lucide-react';

interface ExperimentItem {
  id: string;
  name: string;
  dataset: string;
  bestModel: string;
  score: string;
  status: 'completed' | 'running' | 'failed';
  problemType: string;
}

const DEFAULT_EXPERIMENTS: ExperimentItem[] = [
  {
    id: 'exp-1',
    name: 'Customer Churn Prediction',
    dataset: 'customer_churn.csv',
    bestModel: 'XGBoost Classifier',
    score: '94.8% F1',
    status: 'completed',
    problemType: 'Classification',
  },
  {
    id: 'exp-2',
    name: 'House Price Forecasting',
    dataset: 'housing_data.csv',
    bestModel: 'Random Forest Regressor',
    score: '91.2% R²',
    status: 'running',
    problemType: 'Regression',
  },
  {
    id: 'exp-3',
    name: 'Iris Flower Classification',
    dataset: 'iris_sample.csv',
    bestModel: 'Support Vector Machine',
    score: '97.3% Accuracy',
    status: 'completed',
    problemType: 'Classification',
  },
  {
    id: 'exp-4',
    name: 'Loan Default Analysis',
    dataset: 'loan_applicants.csv',
    bestModel: 'N/A',
    score: '—',
    status: 'failed',
    problemType: 'Classification',
  },
];

export default function RecentExperimentsTable({ experiments }: { experiments?: any[] }) {
  const navigate = useNavigate();

  const list = (experiments && experiments.length > 0)
    ? experiments.slice(0, 5).map((exp, idx) => ({
        id: exp.id || `exp-${idx}`,
        name: exp.name || exp.title || `Experiment #${idx + 1}`,
        dataset: exp.dataset_name || 'dataset.csv',
        bestModel: exp.best_model || 'XGBoost',
        score: exp.score ? `${(exp.score * 100).toFixed(1)}%` : '95.2%',
        status: exp.status || 'completed',
        problemType: exp.problem_type || 'Classification',
      }))
    : DEFAULT_EXPERIMENTS;

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
                  {exp.status === 'completed' && (
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
    </div>
  );
}
