import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Filter, Calendar } from 'lucide-react';

export default function ExperimentPerformanceChart() {
  const [metric, setMetric] = useState('Accuracy');
  const [timeRange, setTimeRange] = useState('7d');

  const dataPointsMap: Record<string, number[]> = {
    Accuracy: [88, 90, 92, 89, 94, 96.7, 95.8],
    'F1 Score': [85, 87, 89, 88, 92, 94.2, 93.5],
    Precision: [87, 89, 91, 90, 93, 95.1, 94.8],
    Recall: [83, 86, 88, 87, 91, 93.0, 92.4],
    RMSE: [1.2, 0.9, 0.7, 0.8, 0.5, 0.32, 0.38],
    MAE: [0.95, 0.78, 0.62, 0.68, 0.45, 0.28, 0.31],
  };

  const currentData = dataPointsMap[metric] || dataPointsMap['Accuracy'];
  const maxVal = Math.max(...currentData);
  const minVal = Math.min(...currentData);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

        <div className="flex items-center gap-2">
          {/* Metric Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
            <Filter className="w-3 h-3 text-zinc-500 ml-1" />
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="bg-transparent text-xs font-mono text-zinc-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="Accuracy" className="bg-zinc-900">Accuracy</option>
              <option value="F1 Score" className="bg-zinc-900">F1 Score</option>
              <option value="Precision" className="bg-zinc-900">Precision</option>
              <option value="Recall" className="bg-zinc-900">Recall</option>
              <option value="RMSE" className="bg-zinc-900">RMSE</option>
              <option value="MAE" className="bg-zinc-900">MAE</option>
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
              <option value="7d" className="bg-zinc-900">Last 7 Days</option>
              <option value="30d" className="bg-zinc-900">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="h-44 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-zinc-800/80">
        {currentData.map((val, idx) => {
          const heightPct = Math.max(15, ((val - minVal * 0.8) / (maxVal - minVal * 0.8 || 1)) * 100);
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
              <span className="text-[10px] font-mono text-indigo-300 opacity-0 group-hover:opacity-100 transition-opacity">
                {val}
              </span>
              <motion.div
                className="w-full bg-gradient-to-t from-indigo-600/40 via-indigo-500 to-cyan-400 rounded-t-md hover:brightness-125 transition-all cursor-pointer relative"
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}%` }}
                transition={{ duration: 0.6, delay: idx * 0.05 }}
              />
              <span className="text-[11px] font-mono text-zinc-400">{days[idx]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
