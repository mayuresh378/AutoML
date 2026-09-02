import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Rocket, Sparkles } from 'lucide-react';

interface Props {
  completedTodayCount?: number;
  readyModelCount?: number;
  attentionDatasetCount?: number;
}

export default function WorkspaceStatusBanner({
  completedTodayCount = 2,
  readyModelCount = 1,
  attentionDatasetCount = 1,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 mb-6 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-75" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">Everything is running normally</h3>
            <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Workspace Operational
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-3">
            <span>● {completedTodayCount} experiments completed today</span>
            <span>● {readyModelCount} model ready for deployment</span>
            <span>● {attentionDatasetCount} dataset needs attention</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-800/40 px-3 py-1.5 rounded-lg border border-zinc-800">
        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
        <span>AutoML Pipeline Engine v2.4</span>
      </div>
    </motion.div>
  );
}
