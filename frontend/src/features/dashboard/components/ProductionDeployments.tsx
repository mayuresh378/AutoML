import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, ArrowRight, Rocket } from 'lucide-react';
import SectionCard, { SectionRefresh } from './SectionCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useDeployments } from '../../../hooks/useApi';
import { getErrorMessage } from '../../../services/http';

export default function ProductionDeployments() {
  const navigate = useNavigate();
  const deployments = useDeployments();
  const updatedAt = new Date();

  const stats = useMemo(() => {
    const list = deployments.data ?? [];
    const active = list.filter((d) => d.status === 'running' || d.status === 'active');
    const failed = list.filter((d) => d.status === 'failed');
    const recent = [...list]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 3);
    return { total: list.length, active: active.length, failed: failed.length, recent };
  }, [deployments.data]);

  return (
    <SectionCard
      title="Production"
      description="Active model deployments"
      icon={<Server className="w-4 h-4 text-emerald-400" />}
      action={
        <button
          onClick={() => navigate('/app/deployments')}
          className="flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
        >
          <Rocket className="w-3 h-3" /> Deploy <ArrowRight className="w-3 h-3" />
        </button>
      }
      loading={deployments.isLoading}
      isError={deployments.isError}
      error={getErrorMessage(deployments.error, 'Failed to load deployments.')}
      onRetry={deployments.refetch}
      empty={stats.total === 0}
      emptyTitle="No deployments yet"
      emptyDescription="Deploy a ready model to expose it as an inference endpoint."
      emptyAction={{ label: 'Deploy Model', onClick: () => navigate('/app/deployments') }}
      skeleton={
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/[0.04] rounded-lg animate-pulse" />
            ))}
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/[0.04] rounded-lg animate-pulse" />
          ))}
        </div>
      }
    >
      <>
        <div className="grid grid-cols-3 gap-2 text-[11px] font-mono mb-4">
          <div className="p-2.5 rounded-lg bg-emerald-500/[0.07] border border-emerald-500/15 text-center">
            <span className="text-emerald-400 font-bold text-base block tabular-nums">{stats.total}</span>
            <span className="text-zinc-500">total</span>
          </div>
          <div className="p-2.5 rounded-lg bg-indigo-500/[0.07] border border-indigo-500/15 text-center">
            <span className="text-indigo-400 font-bold text-base block tabular-nums">{stats.active}</span>
            <span className="text-zinc-500">active</span>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-500/[0.07] border border-rose-500/15 text-center">
            <span className="text-rose-400 font-bold text-base block tabular-nums">{stats.failed}</span>
            <span className="text-zinc-500">unhealthy</span>
          </div>
        </div>

        {stats.recent.length > 0 && (
          <div className="space-y-2">
            {stats.recent.map((d) => {
              const requests = d.requests_total ?? d.requests_count ?? null;
              const latency = d.avg_latency_ms ?? null;
              return (
                <div
                  key={d.id}
                  onClick={() => navigate('/app/deployments')}
                  className="p-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800/70 hover:border-zinc-700/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-100 truncate">
                      {d.name || d.endpoint_name || d.model_name || d.id}
                    </span>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono text-zinc-500">
                    {d.model_name && <span className="truncate">{d.model_name}</span>}
                    {d.environment && <span className="text-zinc-600">· {d.environment}</span>}
                    {requests != null && <span>· {requests.toLocaleString()} req</span>}
                    {latency != null && <span>· {Math.round(latency)}ms</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    </SectionCard>
  );
}