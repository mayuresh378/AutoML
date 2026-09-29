import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Database, Cpu, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import AnimatedNumber from '../../../components/motion/AnimatedNumber';
import { MetricSkeleton } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import {
  useDatasets,
  useModels,
  useAnalytics,
} from '../../../hooks/useApi';
import { getErrorMessage } from '../../../services/http';

interface BreakdownItem {
  label: string;
  value: string;
  color: string;
}

interface MetricCardDef {
  key: string;
  label: string;
  value: number;
  icon: typeof Database;
  colorText: string;
  colorBg: string;
  path: string;
  breakdown: BreakdownItem[];
  trend: number | null;
}

function computeDelta(recent: number, previous: number): number | null {
  if (previous <= 0) return recent > 0 ? null : null;
  return Math.round(((recent - previous) / previous) * 100);
}

function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta === 0) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-mono font-medium text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
        <Minus className="w-3 h-3" /> 0%
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className={`flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full border ${
      up
        ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
    }`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(delta)}%
    </span>
  );
}

export default function MetricCards() {
  const navigate = useNavigate();
  const datasets = useDatasets();
  const models = useModels();
  const analytics = useAnalytics();

  const isLoading =
    datasets.isLoading || models.isLoading;
  const hasError = datasets.isError || models.isError;
  const refetch = () => {
    datasets.refetch();
    models.refetch();
  };

  const cards = useMemo<MetricCardDef[]>(() => {
    const dsList = datasets.data ?? [];
    const modelList = models.data ?? [];
    const analyticsData = analytics.data;

    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    const dsReady = dsList.filter((d) => d.status === 'ready' || d.status === 'uploaded').length;
    const dsAttention = dsList.filter((d) => d.status === 'error' || d.status === 'processing').length;

    const readyModels = modelList.filter(
      (m) => m.status === 'ready' || m.status === 'production' || m.status === 'registered',
    );

    let dsTrend: number | null = null;
    if (analyticsData && Array.isArray(analyticsData.dataset_growth) && analyticsData.dataset_growth.length) {
      const cutoff = (d: string) => new Date(d + 'T00:00:00Z').getTime();
      const bound = daysAgo(7).getTime();
      const prevBound = daysAgo(14).getTime();
      const recent = analyticsData.dataset_growth.filter((t) => cutoff(t.date) >= bound).length;
      const previous = analyticsData.dataset_growth.filter((t) => cutoff(t.date) >= prevBound && cutoff(t.date) < bound).length;
      dsTrend = computeDelta(recent, previous);
    } else {
      const recent = dsList.filter((d) => d.created_at && new Date(d.created_at) >= daysAgo(7)).length;
      const previous = dsList.filter((d) => d.created_at && new Date(d.created_at) >= daysAgo(14) && new Date(d.created_at) < daysAgo(7)).length;
      dsTrend = computeDelta(recent, previous);
    }

    const bestModel = [...readyModels].sort(
      (a, b) => (b.cv_score ?? b.metrics?.accuracy ?? 0) - (a.cv_score ?? a.metrics?.accuracy ?? 0),
    )[0];
    const bestScore =
      bestModel?.cv_score != null
        ? `${Math.round(bestModel.cv_score * 100)}%`
        : bestModel?.metrics?.accuracy != null
          ? `${Math.round(bestModel.metrics.accuracy * 100)}%`
          : null;

    return [
      {
        key: 'datasets',
        label: 'Datasets',
        value: dsList.length,
        icon: Database,
        colorText: 'text-cyan-400',
        colorBg: 'bg-cyan-500/10 border-cyan-500/20',
        path: '/app/datasets',
        trend: dsTrend,
        breakdown: [
          { label: 'ready', value: String(dsReady), color: 'text-emerald-400' },
          { label: 'attention', value: String(dsAttention), color: 'text-amber-400' },
        ],
      },
      {
        key: 'models',
        label: 'Models',
        value: modelList.length,
        icon: Cpu,
        colorText: 'text-emerald-400',
        colorBg: 'bg-emerald-500/10 border-emerald-500/20',
        path: '/app/models',
        trend: null,
        breakdown: bestScore
          ? [{ label: 'best score', value: bestScore, color: 'text-emerald-400 font-semibold' }]
          : [{ label: 'ready', value: String(readyModels.length), color: 'text-emerald-400' }],
      },
    ];
  }, [datasets.data, models.data, analytics.data]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <MetricSkeleton key={i} />)}
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        <ErrorState
          title="Unable to load this section"
          message={getErrorMessage(datasets.error || models.error, 'Failed to load dashboard metrics.')}
          onRetry={refetch}
          className="py-8"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.key}
            onClick={() => navigate(card.path)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 200, damping: 22 }}
            whileHover={{ y: -3 }}
            className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono font-semibold text-zinc-400 tracking-wider uppercase">
                {card.label}
              </span>
              <div className={`p-2 rounded-lg border ${card.colorBg}`}>
                <Icon className={`w-4 h-4 ${card.colorText}`} />
              </div>
            </div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-3xl font-bold tracking-tight text-white tabular-nums">
                <AnimatedNumber value={card.value} />
              </span>
              <TrendBadge delta={card.trend} />
            </div>
            <div className="pt-3 border-t border-zinc-800/60 flex items-center gap-2 text-xs text-zinc-400 font-mono overflow-x-auto">
              {card.breakdown.map((item, idx) => (
                <span key={idx} className="flex items-center gap-1 flex-shrink-0">
                  {idx > 0 && <span className="text-zinc-600">·</span>}
                  <span className={item.color}>{item.value}</span>
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