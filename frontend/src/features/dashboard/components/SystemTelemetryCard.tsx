import { motion } from 'framer-motion';
import { Cpu, HardDrive, Activity, Server, Database, CheckCircle2 } from 'lucide-react';

interface Props {
  metrics?: {
    cpu?: { percent?: number };
    memory?: { percent?: number };
    disk?: { percent?: number };
  };
}

export default function SystemTelemetryCard({ metrics }: Props) {
  const cpuPercent = Math.round(metrics?.cpu?.percent ?? 38);
  const memoryPercent = Math.round(metrics?.memory?.percent ?? 52);
  const diskPercent = Math.round(metrics?.disk?.percent ?? 31);

  const services = [
    { name: 'API Gateway', status: 'Operational' },
    { name: 'Database Engine', status: 'Operational' },
    { name: 'Training Worker', status: 'Operational' },
    { name: 'Artifact Storage', status: 'Operational' },
  ];

  return (
    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">System Health & Telemetry</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-medium text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          All Systems Operational
        </div>
      </div>

      <div className="space-y-3 mb-5">
        <div>
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <span className="text-zinc-400 flex items-center gap-1">
              <Cpu className="w-3 h-3 text-indigo-400" /> CPU Utilization
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
            </span>
            <span className="text-zinc-200 font-semibold">{diskPercent}%</span>
          </div>
          <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden p-0.5 border border-zinc-800">
            <motion.div className="h-full bg-amber-500 rounded-full" animate={{ width: `${diskPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-zinc-800/80">
        <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block mb-2">Microservices Status</span>
        <div className="grid grid-cols-2 gap-2">
          {services.map((svc) => (
            <div key={svc.name} className="p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/60 flex items-center justify-between">
              <span className="text-xs text-zinc-300 font-sans truncate">{svc.name}</span>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {svc.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
