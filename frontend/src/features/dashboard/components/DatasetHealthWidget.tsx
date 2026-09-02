import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Database, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function DatasetHealthWidget() {
  const navigate = useNavigate();

  const total = 12;
  const healthy = 10;
  const warnings = 2;
  const healthyPercent = (healthy / total) * 100;
  const warningPercent = (warnings / total) * 100;

  return (
    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">Dataset Health</h3>
        </div>
        <span className="text-xs font-mono text-zinc-400">{total} Datasets Monitored</span>
      </div>

      <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden flex gap-0.5 mb-3 p-0.5 border border-zinc-800">
        <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${healthyPercent}%` }} />
        <div className="h-full bg-amber-500 rounded-r-full" style={{ width: `${warningPercent}%` }} />
      </div>

      <div className="flex items-center justify-between text-xs font-mono mb-4">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {healthy} Healthy
        </span>
        <span className="flex items-center gap-1.5 text-amber-400">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          {warnings} Warnings
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-200">customer_data.csv</span>
            <p className="text-[11px] text-amber-300/80">8.4% missing values detected in target feature</p>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-200">sales_quarterly.csv</span>
            <p className="text-[11px] text-amber-300/80">14 duplicate rows identified</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => navigate('/app/datasets')}
        className="w-full py-1.5 px-3 rounded-lg text-xs font-medium bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span>Open Data Quality Center</span>
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
