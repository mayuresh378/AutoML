import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Filter, Calendar } from 'lucide-react';

interface Props {
  experiments?: any[];
}

interface DataPoint {
  label: string;
  value: number;
}

function extractScore(exp: any, wantRmse = false): { value: number; label: string } | null {
  const m = exp.metrics || {};
  const rmse = m.rmse ?? m.root_mean_squared_error ?? null;
  if (wantRmse) {
    if (typeof rmse === 'number' && rmse > 0) {
      return { value: Math.round(rmse * 100) / 100, label: 'RMSE' };
    }
    return null;
  }
  if (exp.cv_score != null && exp.cv_score > 0 && exp.cv_score <= 1) {
    return { value: Math.round(exp.cv_score * 100), label: 'Accuracy' };
  }
  const accuracy = m.accuracy ?? m.f1_score ?? m.f1 ?? m.r2_score ?? m.accuracy_score ?? null;
  if (typeof accuracy === 'number' && accuracy <= 1) {
    return { value: Math.round(accuracy * 100), label: 'Accuracy' };
  }
  return null;
}

export default function ExperimentPerformanceChart({ experiments = [] }: Props) {
  const [metric, setMetric] = useState('accuracy');
  const [timeRange, setTimeRange] = useState('7d');

  const points = useMemo<DataPoint[]>(() => {
    const wantRmse = metric === 'rmse';
    const list = (experiments || []).filter((e) => extractScore(e, wantRmse));
    const sorted = [...list].sort(
      (a, b) => new Date(a.created_at || a.run_at || 0).getTime() - new Date(b.created_at || b.run_at || 0).getTime(),
    );
    return sorted.map((e) => {
      const score = extractScore(e, wantRmse);
      return {
        label: e.name || e.experiment_name || 'Exp',
        value: score?.value ?? 0,
      };
    });
  }, [experiments, metric, timeRange]);

  if (points.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Experiment Performance
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">Historical validation metrics across automated model runs</p>
          </div>
        </div>
        <div className="h-44 flex items-center justify-center">
          <p className="text-xs text-zinc-500 font-mono">No experiment data available yet</p>
        </div>
      </div>
    );
  }

  const displayData = points.slice(-7);
  const values = displayData.map((p) => p.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);

  return (
    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            Experiment Performance
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">Real validation metrics from training runs</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Metric Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
            <Filter className="w-3 h-3 text-zinc-500 ml-1" />
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="bg-transparent text-xs font-mono text-zinc-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="accuracy" className="bg-zinc-900">Accuracy / F1</option>
              <option value="rmse" className="bg-zinc-900">RMSE</option>
            </select>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
            <Calendar className="w-3 h-3 text-zinc-500 ml-1" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-transparent text-xs font-mono text-zinc-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="7d" className="bg-zinc-900">Last 7</option>
              <option value="30d" className="bg-zinc-900">Last 30</option>
            </select>
          </div>
        </div>
      </div>

      <div className="h-44 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-zinc-800/80">
        {displayData.map((point, idx) => {
          const heightPct = Math.max(15, ((point.value - minVal * 0.8) / (maxVal - minVal * 0.8 || 1)) * 100);
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end min-w-0">
              <span className="text-[10px] font-mono text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-full">
                {point.value}
              </span>
              <motion.div
                className="w-full bg-gradient-to-t from-indigo-600/40 via-indigo-500 to-cyan-400 rounded-t-md hover:brightness-125 transition-all cursor-pointer relative"
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}%` }}
                transition={{ duration: 0.6, delay: idx * 0.05 }}
                title={point.label}
              />
              <span className="text-[11px] font-mono text-zinc-400 truncate max-w-full">{point.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
