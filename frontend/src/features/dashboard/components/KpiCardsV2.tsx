import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Database, Cpu, Server, TrendingUp } from 'lucide-react';
import AnimatedNumber from '../../../components/motion/AnimatedNumber';

interface KpiData {
  experimentsCount: number;
  datasetsCount: number;
  modelsCount: number;
  deploymentsCount: number;
  completedCount: number;
  runningCount: number;
  failedCount: number;
  healthyDatasets: number;
  needsAttentionDatasets: number;
  bestAccuracy: number | null;
  healthyDeployments: number;
}

export default function KpiCardsV2({
  data,
  stats,
}: {
  data: KpiData;
  stats?: {
    total_predictions?: number;
    total_models?: number;
    total_datasets?: number;
    total_experiments?: number;
    avg_training_time?: number;
    success_rate?: number;
    modelsTrained?: number;
    activeDeployments?: number;
  } | null;
}) {
  const navigate = useNavigate();

  const experimentsCount = data.experimentsCount || 0;
  const datasetsCount = data.datasetsCount || 0;
  const modelsCount = data.modelsCount || 0;
  const deploymentsCount = data.deploymentsCount || 0;
  const completedCount = data.completedCount;
  const runningCount = data.runningCount;
  const failedCount = data.failedCount;

  const cards = [
    {
      key: 'experiments',
      title: 'EXPERIMENTS',
      value: experimentsCount,
      trend: 'this month',
      path: '/app/experiments',
      icon: FlaskConical,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      breakdown: [
        { label: 'completed', count: completedCount, color: 'text-emerald-400' },
        { label: 'running', count: runningCount, color: 'text-amber-400' },
        { label: 'failed', count: failedCount, color: 'text-rose-400' },
      ],
    },
    {
      key: 'datasets',
      title: 'DATASETS',
      value: datasetsCount,
      trend: 'monitored',
      path: '/app/datasets',
      icon: Database,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      breakdown: [
        { label: 'ready', count: data.healthyDatasets, color: 'text-emerald-400' },
        { label: 'attention', count: data.needsAttentionDatasets, color: 'text-amber-400' },
      ],
    },
    {
      key: 'models',
      title: 'MODELS',
      value: modelsCount,
      trend: 'trained',
      path: '/app/models',
      icon: Cpu,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      breakdown: data.bestAccuracy != null
        ? [{ label: 'Best score', count: typeof data.bestAccuracy === 'number' ? `${(data.bestAccuracy * 100).toFixed(1)}%` : String(data.bestAccuracy), color: 'text-emerald-400 font-semibold' }]
        : [{ label: 'loaded', count: modelsCount, color: 'text-emerald-400' }],
    },
    {
      key: 'deployments',
      title: 'DEPLOYMENTS',
      value: deploymentsCount,
      trend: 'deployed',
      path: '/app/deployments',
      icon: Server,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      breakdown: [
        { label: 'healthy', count: data.healthyDeployments, color: 'text-emerald-400' },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.key}
            onClick={() => navigate(card.path)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={{ y: -4, boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}
            className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700/80 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono font-semibold text-zinc-400 tracking-wider">
                  {card.title}
                </span>
                <div className={`p-2 rounded-lg border ${card.bg}`}>
                  <Icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>

              <div className="flex items-baseline justify-between mb-3">
                <span className="text-3xl font-bold tracking-tight text-white">
                  {typeof card.value === 'number' ? <AnimatedNumber value={card.value} /> : card.value}
                </span>
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <TrendingUp className="w-3 h-3" />
                  {card.trend}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800/60 flex items-center gap-2 text-xs text-zinc-400 font-mono overflow-x-auto">
              {card.breakdown.map((item, idx) => (
                <span key={idx} className="flex items-center gap-1 flex-shrink-0">
                  {idx > 0 && <span className="text-zinc-600">·</span>}
                  <span className={item.color}>{item.count}</span>
                  <span>{item.label}</span>
                </span>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
