import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Trophy, Rocket, ArrowRight, Zap, Clock, ShieldCheck } from 'lucide-react';

interface Props {
  modelName?: string;
  accuracy?: string;
  f1Score?: string;
  precision?: string;
  trainingTime?: string;
}

export default function BestModelSpotlight({
  modelName = 'customer_churn_xgb_v3',
  accuracy = '94.8%',
  f1Score = '92.3%',
  precision = '93.1%',
  trainingTime = '2m 34s',
}: Props) {
  const navigate = useNavigate();

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-zinc-900/60 to-zinc-900/60 border border-indigo-500/30 backdrop-blur-md relative overflow-hidden shadow-lg mb-6">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Trophy className="w-4 h-4" />
          </div>
          <span className="text-xs font-mono font-bold tracking-wider text-amber-400 uppercase">
            BEST MODEL
          </span>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" /> Production Grade
        </span>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-bold text-white tracking-tight font-mono">{modelName}</h3>
        <p className="text-xs text-zinc-400 mt-0.5">Automated XGBoost Classifier with tuned hyperparameters</p>
      </div>

      <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 mb-4">
        <div>
          <span className="text-[10px] font-mono text-zinc-400 block">Accuracy</span>
          <span className="text-sm font-bold font-mono text-emerald-400">{accuracy}</span>
        </div>
        <div>
          <span className="text-[10px] font-mono text-zinc-400 block">F1 Score</span>
          <span className="text-sm font-bold font-mono text-indigo-400">{f1Score}</span>
        </div>
        <div>
          <span className="text-[10px] font-mono text-zinc-400 block">Precision</span>
          <span className="text-sm font-bold font-mono text-cyan-400">{precision}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-zinc-400 flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3 text-zinc-500" />
          Training time: {trainingTime}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/app/models')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            View Model
          </button>
          <button
            onClick={() => navigate('/app/deployments')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
          >
            <Rocket className="w-3 h-3" />
            <span>Deploy</span>
          </button>
        </div>
      </div>
    </div>
  );
}
