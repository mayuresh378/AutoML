import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Microchip, Cpu, MemoryStick, HardDrive } from 'lucide-react';
import { api } from '../lib/api';
import { staggerContainer, staggerItem } from '../lib/animations';

const ICONS: Record<string, React.FC<any>> = { gpu: Microchip, cpu: Cpu, memory: MemoryStick, storage: HardDrive };
const barColor = (v: number) => (v > 80 ? 'bg-danger' : v > 60 ? 'bg-warning' : 'bg-primary');

export function MetricGrid() {
  const [metrics, setMetrics] = useState<any>({});

  useEffect(() => {
    api.monitoring.metrics().then(setMetrics).catch(() => {});
    const id = setInterval(() => api.monitoring.metrics().then(setMetrics).catch(() => {}), 10000);
    return () => clearInterval(id);
  }, []);

  const entries = Object.entries(metrics) as Array<[string, { label: string; value: number; detail: string }]>;

  if (entries.length === 0) return null;

  return (
    <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-3" variants={staggerContainer} initial="hidden" animate="visible">
      {entries.map(([key, metric], i) => {
        const Icon = ICONS[key] || Microchip;
        return (
          <motion.div
            key={key}
            variants={staggerItem}
            className="card-hover rounded-xl border border-border bg-card/60 p-4 hover:border-border-strong transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{metric.label}</span>
              </div>
              <span className="font-mono text-sm text-zinc-100 tabular-nums">{metric.value}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${metric.value}%` }}
                transition={{ duration: 0.8, delay: 0.15 + i * 0.05, ease: 'easeOut' }}
                className={`h-full rounded-full ${barColor(metric.value)}`}
              />
            </div>
            <div className="mt-2 text-[11px] text-zinc-600">{metric.detail}</div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
