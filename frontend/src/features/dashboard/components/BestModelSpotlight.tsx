import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Trophy, Rocket, Clock, ShieldCheck, Box } from 'lucide-react';
import SectionCard, { SectionRefresh } from './SectionCard';
import { useModels } from '../../../hooks/useApi';
import { getErrorMessage } from '../../../services/http';
import type { Model } from '../../../types/api';

function formatScore(v: number | null | undefined, decimals = 1): string | null {
  if (v == null) return null;
  return `${(v * 100).toFixed(decimals)}%`;
}

function bestMetric(m: Model): { label: string; value: string } | null {
  const metrics = m.metrics || {};
  const candidates: Array<[string, number | null | undefined]> = [
    ['Accuracy', metrics.accuracy],
    ['F1', metrics.f1_score],
    ['R²', metrics.r2_score],
  ];
  for (const [label, v] of candidates) {
    if (typeof v === 'number' && v <= 1) return { label, value: formatScore(v) as string };
  }
  if (m.cv_score != null && m.cv_score <= 1) return { label: 'CV Score', value: formatScore(m.cv_score) as string };
  if (typeof metrics.rmse === 'number') return { label: 'RMSE', value: Number(metrics.rmse).toFixed(3) };
  return null;
}

const EMPTY_ACTION = 'Train your first model to see it here.';

export default function BestModelSpotlight() {
  const navigate = useNavigate();
  const models = useModels();
  const updatedAt = new Date();

  const best = useMemo<Model | null>(() => {
    const list = (models.data ?? []).filter(
      (m) => m.status === 'ready' || m.status === 'production' || m.status === 'registered',
    );
    return [...list].sort(
      (a, b) =>
        (b.cv_score ?? b.metrics?.accuracy ?? 0) - (a.cv_score ?? a.metrics?.accuracy ?? 0),
    )[0] || null;
  }, [models.data]);

  const metric = best ? bestMetric(best) : null;
  const isProduction = best?.status === 'production';

  return (
    <SectionCard
      title="Best Model"
      icon={<Trophy className="w-4 h-4 text-amber-400" />}
      description="Top-performing model in your registry"
      action={<SectionRefresh refetch={models.refetch} isFetching={models.isFetching} updatedAt={updatedAt} />}
      loading={models.isLoading}
      isError={models.isError}
      error={getErrorMessage(models.error, 'Failed to load models.')}
      onRetry={models.refetch}
      empty={!best}
      emptyIcon={<Box className="w-8 h-8 text-indigo-400" />}
      emptyTitle="No model yet"
      emptyDescription={EMPTY_ACTION}
      emptyAction={{ label: 'Start Training', onClick: () => navigate('/app/training') }}
      skeleton={
        <div className="space-y-3">
          <div className="h-10 w-3/4 bg-white/[0.05] rounded-lg animate-pulse" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/[0.04] rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-8 w-full bg-white/[0.04] rounded-lg animate-pulse" />
        </div>
      }
    >
      {best && (
        <div className="relative">
          {isProduction && (
            <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 mb-2 w-fit">
              <ShieldCheck className="w-3 h-3" /> In Production
            </span>
          )}
          <h3 className="text-lg font-bold text-white tracking-tight font-mono truncate">{best.name}</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            {best.algorithm || best.model_type || 'AutoML'}
            {best.version ? ` · v${best.version}` : ''}
            {best.deployment_status ? ` · ${best.deployment_status}` : ''}
          </p>

          <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800/80 mt-3">
            <div>
              <span className="text-[10px] font-mono text-zinc-400 block">Performance</span>
              <span className="text-sm font-bold font-mono text-emerald-400">{metric?.value ?? '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-zinc-400 block">Metric</span>
              <span className="text-sm font-bold font-mono text-indigo-400">{metric?.label ?? '—'}</span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-zinc-400 block">Created</span>
              <span className="text-sm font-bold font-mono text-zinc-200">
                {best.created_at ? new Date(best.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-zinc-400 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-zinc-500" />
              {best.updated_at
                ? `Updated ${new Date(best.updated_at).toLocaleDateString()}`
                : 'Ready for deployment'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/app/models`)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                View Model
              </button>
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/app/deployments')}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <Rocket className="w-3 h-3" />
                <span>Deploy</span>
              </motion.button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}