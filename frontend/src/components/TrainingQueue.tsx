import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { staggerContainer, staggerItem } from '../lib/animations';

export function TrainingQueue() {
  const [experiments, setExperiments] = useState<any[]>([]);

  useEffect(() => {
    api.experiments.list().then(r => setExperiments(r.experiments.slice(0, 5))).catch(() => {});
    const id = setInterval(() => api.experiments.list().then(r => setExperiments(r.experiments.slice(0, 5))).catch(() => {}), 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card-hover rounded-xl border border-border bg-card/60">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <span className="text-sm font-medium text-zinc-100">Recent experiments</span>
        <span className="text-[11px] font-mono text-zinc-500">{experiments.length} runs</span>
      </div>
      <motion.div className="divide-y divide-border" variants={staggerContainer} initial="hidden" animate="visible">
        {experiments.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">No experiments yet.</div>
        )}
        {experiments.map((exp: any) => (
          <motion.div
            key={exp.id}
            variants={staggerItem}
            className="px-4 py-3"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <FlaskConical className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-[13px] text-zinc-200 truncate">{exp.name}</span>
                <span className="text-[11px] text-zinc-600 shrink-0 hidden sm:inline">→ {exp.model}</span>
              </div>
              <span className="text-[11px] font-mono shrink-0 text-primary">
                {exp.cv_score}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (exp.cv_score || 0) * 100)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                />
              </div>
              <span className="text-[10px] font-mono text-zinc-600 w-16 text-right shrink-0">
                {exp.status}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
