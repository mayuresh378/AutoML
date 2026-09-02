import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Database, Cpu, Server, TrendingUp, ArrowUpRight } from 'lucide-react';
import AnimatedNumber from '../../../components/motion/AnimatedNumber';

interface KpiData {
  experimentsCount: number;
  datasetsCount: number;
  modelsCount: number;
  deploymentsCount: number;
}

export default function KpiCardsV2({ data }: { data: KpiData }) {
  const navigate = useNavigate();

  const cards = [
    {
      key: 'experiments',
      title: 'EXPERIMENTS',
      value: data.experimentsCount || 18,
      trend: '↑ 24% this month',
      path: '/app/experiments',
      icon: FlaskConical,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      breakdown: [
        { label: 'completed', count: 12, color: 'text-emerald-400' },
        { label: 'running', count: 4, color: 'text-amber-400' },
        { label: 'failed', count: 2, color: 'text-rose-400' },
      ],
    },
    {
      key: 'datasets',
      title: 'DATASETS',
      value: data.datasetsCount || 12,
      trend: '↑ 4 this month',
      path: '/app/datasets',
      icon: Database,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      breakdown: [
        { label: 'healthy', count: 10, color: 'text-emerald-400' },
        { label: 'need attention', count: 2, color: 'text-amber-400' },
      ],
    },
    {
      key: 'models',
      title: 'MODELS',
      value: data.modelsCount || 18,
      trend: '↑ 6 this month',
      path: '/app/models',
      icon: Cpu,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      breakdown: [
        { label: 'Best accuracy', count: '96.7%', color: 'text-emerald-400 font-semibold' },
      ],
    },
    {
      key: 'deployments',
      title: 'DEPLOYMENTS',
      value: data.deploymentsCount || 3,
      trend: '● 3 healthy',
      path: '/app/deployments',
      icon: Server,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      breakdown: [
        { label: 'uptime', count: '99.98%', color: 'text-emerald-400' },
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
