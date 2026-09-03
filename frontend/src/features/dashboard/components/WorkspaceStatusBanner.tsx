import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Rocket, Sparkles, WifiOff } from 'lucide-react';

interface Props {
  completedTodayCount?: number;
  readyModelCount?: number;
  attentionDatasetCount?: number;
  online?: boolean;
}

export default function WorkspaceStatusBanner({
  completedTodayCount = 0,
  readyModelCount = 0,
  attentionDatasetCount = 0,
  online = true,
}: Props) {
  const hasAttention = attentionDatasetCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 mb-6 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center">
          <span className={`w-3 h-3 rounded-full ${online ? 'bg-emerald-500' : 'bg-rose-500'} animate-ping opacity-75`} />
          <span className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-rose-500'} absolute`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">
              {online ? 'Everything is running normally' : 'Workspace connection issues'}
            </h3>
            <span className={`px-2 py-0.5 text-[10px] font-mono font-medium rounded-full border ${
              online
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {online ? 'Workspace Operational' : <span className="flex items-center gap-1"><WifiOff className="w-2.5 h-2.5" /> Offline</span>}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-3">
            {completedTodayCount > 0 ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className={`w-3 h-3 ${hasAttention ? 'text-amber-400' : 'text-emerald-400'}`} />
                {completedTodayCount} experiment{completedTodayCount === 1 ? '' : 's'} completed today
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-zinc-500" />
                No experiments completed today
              </span>
            )}
            <span>● {readyModelCount} model{readyModelCount === 1 ? '' : 's'} ready for deployment</span>
            {hasAttention ? (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                {attentionDatasetCount} dataset{attentionDatasetCount === 1 ? '' : 's'} need{attentionDatasetCount === 1 ? 's' : ''} attention
              </span>
            ) : (
              <span>● 0 datasets need attention</span>
            )}
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
