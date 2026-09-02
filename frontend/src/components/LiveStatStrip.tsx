import { useState, useEffect } from 'react';
import { motion, useSpring, useTransform, useMotionValue } from 'framer-motion';
import { api } from '../lib/api';

const STAT_DEFS = [
  { key: 'modelsTrained', label: 'Models trained', suffix: '' },
  { key: 'activeDeployments', label: 'Active deployments', suffix: '' },
  { key: 'inferenceRequestsToday', label: 'Requests today', suffix: '' },
  { key: 'avgLatencyMs', label: 'Avg latency', suffix: 'ms' },
] as const;

function AnimatedStat({ value, suffix }: { value: number; suffix: string }) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 60, damping: 20 });
  const rounded = useTransform(spring, (v) => Math.round(v).toLocaleString());

  useEffect(() => { motionValue.set(value); }, [value]);

  return (
    <span className="font-mono text-xl font-semibold text-white tabular-nums">
      <motion.span>{rounded}</motion.span>{suffix}
    </span>
  );
}

export function LiveStatStrip() {
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    api.monitoring.stats().then((r: any) => setStats(r)).catch(() => {});
    const id = setInterval(() => api.monitoring.stats().then((r: any) => setStats(r)).catch(() => {}), 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="flex flex-wrap gap-x-8 gap-y-3"
    >
      {STAT_DEFS.map((s) => (
        <div key={s.key}>
          <AnimatedStat value={stats[s.key] ?? 0} suffix={s.suffix} />
          <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </motion.div>
  );
}
