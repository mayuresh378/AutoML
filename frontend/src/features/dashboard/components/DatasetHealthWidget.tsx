import { useNavigate } from 'react-router-dom';
import { Database, AlertTriangle, ArrowRight } from 'lucide-react';

interface Props {
  datasets?: any[];
}

export default function DatasetHealthWidget({ datasets = [] }: Props) {
  const navigate = useNavigate();

  const allDatasets = datasets || [];
  const healthy = allDatasets.filter((d) => d.status === 'ready' || d.status === 'uploaded').length;
  const warnings = allDatasets.filter((d) => d.status === 'error' || d.status === 'processing').length;
  const total = allDatasets.length;
  const healthyPercent = total > 0 ? (healthy / total) * 100 : 0;
  const warningPercent = total > 0 ? (warnings / total) * 100 : 0;

  const attentionDatasets = allDatasets.filter((d) => d.status === 'error').slice(0, 2);

  return (
    <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">Dataset Health</h3>
        </div>
        <span className="text-xs font-mono text-zinc-400">{total} Datasets Monitored</span>
      </div>

      {total > 0 ? (
        <>
          <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden flex gap-0.5 mb-3 p-0.5 border border-zinc-800">
            {healthyPercent > 0 && (
              <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${healthyPercent}%` }} />
            )}
            {warningPercent > 0 && (
              <div className="h-full bg-amber-500 rounded-r-full" style={{ width: `${warningPercent}%` }} />
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-mono mb-4">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {healthy} Healthy
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {warnings} Warnings
            </span>
          </div>
        </>
      ) : (
        <p className="text-xs text-zinc-500 font-mono mb-4">No datasets uploaded yet</p>
      )}

      {attentionDatasets.length > 0 && (
        <div className="space-y-2 mb-4">
          {attentionDatasets.map((d, i) => (
            <div key={d.id || i} className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-200">{d.name || d.filename || 'unknown'}</span>
                <p className="text-[11px] text-amber-300/80">Dataset is in error state</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate('/app/datasets')}
        className="w-full py-1.5 px-3 rounded-lg text-xs font-medium bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <span>Open Data Quality Center</span>
        <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
