import { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowUpDown } from 'lucide-react';
import { api } from '../lib/api';
import { useUIStore } from '../store/useUIStore';
import { staggerContainer, staggerItem } from '../lib/animations';

const ExperimentsTable = memo(function ExperimentsTable() {
  const [experiments, setExperiments] = useState<any[]>([]);
  const setActivePage = useUIStore((s) => s.setActivePage);

  useEffect(() => {
    api.experiments.list().then(r => setExperiments(r.experiments.slice(0, 5))).catch(() => {});
  }, []);

  return (
    <div className="card-hover rounded-xl border border-border bg-card/60 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <span className="text-sm font-medium text-zinc-100">Recent experiments</span>
        <button className="btn-press text-[11px] text-primary hover:text-primary/80 transition-colors" onClick={() => setActivePage('Experiments')}>View all</button>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] text-zinc-600 border-b border-border">
              <th className="font-medium px-4 py-2.5"><span className="inline-flex items-center gap-1">Run <ArrowUpDown className="h-2.5 w-2.5" /></span></th>
              <th className="font-medium px-4 py-2.5">Model</th>
              <th className="font-medium px-4 py-2.5">Score</th>
              <th className="font-medium px-4 py-2.5">Time</th>
              <th className="font-medium px-4 py-2.5 text-right">Status</th>
            </tr>
          </thead>
          <motion.tbody variants={staggerContainer} initial="hidden" animate="visible">
            {experiments.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">No experiments yet.</td></tr>
            )}
            {experiments.map((exp: any) => (
              <motion.tr key={exp.id} variants={staggerItem} className="border-b border-border last:border-0 hover:bg-white/[0.04] hover:transition-colors">
                <td className="px-4 py-2.5 text-[13px] text-zinc-200 font-medium whitespace-nowrap">{exp.name}</td>
                <td className="px-4 py-2.5 text-[13px] text-zinc-400 whitespace-nowrap">{exp.model}</td>
                <td className="px-4 py-2.5 text-[13px] font-mono text-zinc-300">{exp.cv_score ?? '—'}</td>
                <td className="px-4 py-2.5 text-[13px] font-mono text-zinc-300">{exp.training_time ?? '—'}s</td>
                <td className="px-4 py-2.5 text-right">
                  {exp.status === 'success' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-success"><CheckCircle2 className="h-3 w-3" /> Success</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-danger"><XCircle className="h-3 w-3" /> Failed</span>
                  )}
                </td>
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </div>
  );
});
export { ExperimentsTable };
