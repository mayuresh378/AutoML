import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Zap, CheckCircle2, AlertTriangle, Rocket, ArrowRight } from 'lucide-react';

interface Recommendation {
  id: string;
  type: 'success' | 'warning' | 'deploy';
  title: string;
  subtitle: string;
  actionText: string;
  targetRoute: string;
}

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: '1',
    type: 'success',
    title: 'Iris experiment completed',
    subtitle: 'Best model: Random Forest — 96.7% F1 Accuracy',
    actionText: 'View Results',
    targetRoute: '/app/experiments',
  },
  {
    id: '2',
    type: 'warning',
    title: 'Dataset "customer_data.csv"',
    subtitle: '8.4% missing values detected in target features',
    actionText: 'Fix Dataset',
    targetRoute: '/app/cleaning',
  },
  {
    id: '3',
    type: 'deploy',
    title: 'Model ready for deployment',
    subtitle: 'churn_xgb_v3 — Production Stage Approved',
    actionText: 'Deploy Model',
    targetRoute: '/app/deployments',
  },
];

export default function RecommendedActions() {
  const navigate = useNavigate();

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-semibold text-zinc-200 tracking-tight uppercase">Recommended Actions</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {RECOMMENDATIONS.map((rec, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={{ y: -3 }}
            className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700/80 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                {rec.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                {rec.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                {rec.type === 'deploy' && <Rocket className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
                <h4 className="text-xs font-semibold text-zinc-100 truncate">{rec.title}</h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mb-4">{rec.subtitle}</p>
            </div>

            <button
              onClick={() => navigate(rec.targetRoute)}
              className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                rec.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20'
                  : rec.type === 'warning'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20'
                  : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20'
              }`}
            >
              <span>{rec.actionText}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
