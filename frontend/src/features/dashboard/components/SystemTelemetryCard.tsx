import { motion } from 'framer-motion';
import { Cpu, HardDrive, Activity, Server, CheckCircle2, WifiOff } from 'lucide-react';

interface Props {
  metrics?: {
    cpu?: number;
    cpu_cores?: number;
    load_avg?: number;
    ram?: number;
    ram_total_gb?: number;
    ram_used_gb?: number;
    disk?: number;
    disk_free_gb?: number;
  } | null;
  healthCheck?: {
    data?: {
      database?: string;
      disk_usage_percent?: number;
      models_count?: number;
      datasets_count?: number;
      version?: string;
      environment?: string;
    } | null;
    message?: string;
  } | null;
}

export default function SystemTelemetryCard({ metrics, healthCheck }: Props) {
  const cpuPercent = Math.round(metrics?.cpu ?? 0);
  const memoryPercent = Math.round(metrics?.ram ?? 0);
  const diskPercent = Math.round(metrics?.disk ?? healthCheck?.data?.disk_usage_percent ?? 0);
  const dbConnected = healthCheck?.data?.database === 'connected';
  const allHealthy = dbConnected;

  const services = [
    { name: 'API Gateway', status: 'Operational' },
    { name: 'Database Engine', status: dbConnected ? 'Operational' : 'Unreachable' },
    { name: 'Training Worker', status: 'Operational' },
    { name: 'Artifact Storage', status: metrics?.disk != null && metrics.disk > 90 ? 'Low Space' : 'Operational' },
  ];

  return (
    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">System Health & Telemetry</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium ${allHealthy ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
          {allHealthy ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              All Systems Operational
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              Degraded
            </>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-5">
        <div>
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <span className="text-zinc-400 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-indigo-400" /> CPU Utilization
              {metrics?.cpu_cores ? <span className="text-zinc-600">({metrics.cpu_cores} cores)</span> : null}
            </span>
            <span className="text-zinc-200 font-semibold">{cpuPercent}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
            <motion.div className="h-full bg-indigo-500 rounded-full" animate={{ width: `${cpuPercent}%` }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <span className="text-zinc-400 flex items-center gap-1">
              <Server className="w-3 h-3 text-cyan-400" /> RAM Memory
              {metrics?.ram_total_gb ? <span className="text-zinc-600">({metrics.ram_total_gb}GB)</span> : null}
            </span>
            <span className="text-zinc-200 font-semibold">{memoryPercent}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
            <motion.div className="h-full bg-cyan-500 rounded-full" animate={{ width: `${memoryPercent}%` }} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <span className="text-zinc-400 flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-amber-400" /> Storage Capacity
              {metrics?.disk_free_gb != null ? <span className="text-zinc-600">({metrics.disk_free_gb}GB free)</span> : null}
            </span>
            <span className="text-zinc-200 font-semibold">{diskPercent}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
            <motion.div className="h-full bg-amber-500 rounded-full" animate={{ width: `${diskPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-zinc-800/80">
        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block mb-2">System Status</span>
        <div className="grid grid-cols-2 gap-2">
          {services.map((svc) => (
            <div key={svc.name} className="p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/60 flex items-center justify-between">
              <span className="text-xs text-zinc-300 font-sans truncate">{svc.name}</span>
              <span className={`text-[10px] font-mono flex items-center gap-1 ${svc.status === 'Operational' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {svc.status === 'Operational' ? <CheckCircle2 className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {svc.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
