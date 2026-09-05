import { motion } from 'framer-motion';
import { Activity, Cpu, Server, HardDrive, Database, Wifi, WifiOff } from 'lucide-react';
import SectionCard, { SectionRefresh } from './SectionCard';
import { useMonitoringDashboard, useHealthCheck } from '../../../hooks/useApi';
import { getErrorMessage } from '../../../services/http';

function UsageBar({ label, hint, value, color, icon }: {
  label: string;
  hint?: string;
  value: number | null;
  color: 'indigo' | 'cyan' | 'amber';
  icon: React.ReactNode;
}) {
  if (value == null) return null;
  const barColor =
    color === 'indigo' ? 'bg-indigo-500' : color === 'cyan' ? 'bg-cyan-500' : 'bg-amber-500';
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-mono mb-1">
        <span className="text-zinc-400 flex items-center gap-1">
          {icon} {label}
          {hint ? <span className="text-zinc-600">{hint}</span> : null}
        </span>
        <span className="text-zinc-200 font-semibold">{Math.round(value)}%</span>
      </div>
      <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
        <motion.div
          className={`h-full ${barColor} rounded-full`}
          animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default function SystemMonitoring() {
  const dashboard = useMonitoringDashboard();
  const healthCheck = useHealthCheck();
  const updatedAt = new Date();

  const metrics = dashboard.data;
  const health = healthCheck.data;
  const dbConnected =
    healthCheck.isSuccess && health?.data?.database === 'connected';

  const isDegraded = dashboard.isError && !dashboard.isLoading;

  return (
    <SectionCard
      title="System Status"
      description="Live resource usage"
      icon={<Activity className="w-4 h-4 text-emerald-400" />}
      action={
        <SectionRefresh
          refetch={() => { dashboard.refetch(); healthCheck.refetch(); }}
          isFetching={dashboard.isFetching || healthCheck.isFetching}
          updatedAt={updatedAt}
        />
      }
      loading={dashboard.isLoading || healthCheck.isLoading}
      isError={isDegraded}
      error={getErrorMessage(dashboard.error, 'Monitoring data is unavailable.')}
      onRetry={() => { dashboard.refetch(); healthCheck.refetch(); }}
      empty={!metrics && !health}
      emptyTitle="System metrics unavailable"
      emptyDescription="Live resource usage is not available right now. Metrics require backend access."
      skeleton={
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3.5 w-1/2 bg-white/[0.05] rounded animate-pulse" />
              <div className="h-2 w-full bg-white/[0.04] rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      }
    >
      <div className="space-y-3 mb-4">
        <UsageBar label="CPU Utilization" hint={metrics?.cpu_cores ? `(${metrics.cpu_cores} cores)` : ''} value={metrics?.cpu ?? null} color="indigo" icon={<Cpu className="w-3 h-3 text-indigo-400" />} />
        <UsageBar label="RAM Memory" hint={metrics?.ram_total_gb ? `(${metrics.ram_total_gb}GB)` : ''} value={metrics?.ram ?? null} color="cyan" icon={<Server className="w-3 h-3 text-cyan-400" />} />
        <UsageBar label="Storage Capacity" hint={metrics?.disk_free_gb != null ? `(${metrics.disk_free_gb}GB free)` : ''} value={metrics?.disk ?? health?.data?.disk_usage_percent ?? null} color="amber" icon={<HardDrive className="w-3 h-3 text-amber-400" />} />
      </div>

      <div className="pt-3 border-t border-zinc-800/80">
        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block mb-2">Services</span>
        <div className="space-y-2">
          <div className="p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/60 flex items-center justify-between">
            <span className="text-xs text-zinc-300 truncate">API Gateway</span>
            {healthCheck.isSuccess && (health?.status === 'ok' || health?.message === 'healthy') ? (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <Wifi className="w-3 h-3" /> Operational
              </span>
            ) : (
              <span className="text-[10px] font-mono text-rose-400 flex items-center gap-1">
                <WifiOff className="w-3 h-3" /> Unreachable
              </span>
            )}
          </div>
          <div className="p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/60 flex items-center justify-between">
            <span className="text-xs text-zinc-300 truncate">Database Engine</span>
            {dbConnected ? (
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <Database className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="text-[10px] font-mono text-rose-400 flex items-center gap-1">
                <WifiOff className="w-3 h-3" /> Unreachable
              </span>
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}