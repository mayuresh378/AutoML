import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, AlertTriangle, ArrowRight, FolderOpen } from 'lucide-react';
import SectionCard, { SectionRefresh } from './SectionCard';
import { useDatasets } from '../../../hooks/useApi';
import { getErrorMessage } from '../../../services/http';

function nf(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);
}

export default function DatasetEcosystem() {
  const navigate = useNavigate();
  const datasets = useDatasets();
  const updatedAt = new Date();

  const stats = useMemo(() => {
    const list = datasets.data ?? [];
    const now = Date.now();
    const week = now - 7 * 24 * 60 * 60 * 1000;
    const ready = list.filter((d) => d.status === 'ready' || d.status === 'uploaded').length;
    const attention = list.filter((d) => d.status === 'error' || d.status === 'processing').length;
    const recent = list.filter((d) => d.created_at && new Date(d.created_at).getTime() >= week).length;
    const rows = list.reduce((acc, d) => acc + (d.rows || 0), 0);
    const columns = list.reduce((acc, d) => acc + (d.columns?.length || 0), 0);
    const attentionList = list.filter((d) => d.status === 'error').slice(0, 2);
    return { total: list.length, ready, attention, recent, rows, columns, attentionList };
  }, [datasets.data]);

  const healthyPct = stats.total > 0 ? (stats.ready / stats.total) * 100 : 0;
  const attentionPct = stats.total > 0 ? (stats.attention / stats.total) * 100 : 0;

  return (
    <SectionCard
      title="Dataset Ecosystem"
      description="Health and coverage of your datasets"
      icon={<Database className="w-4 h-4 text-cyan-400" />}
      action={<SectionRefresh refetch={datasets.refetch} isFetching={datasets.isFetching} updatedAt={updatedAt} />}
      loading={datasets.isLoading}
      isError={datasets.isError}
      error={getErrorMessage(datasets.error, 'Failed to load datasets.')}
      onRetry={datasets.refetch}
      empty={stats.total === 0}
      emptyIcon={<FolderOpen className="w-8 h-8 text-cyan-400" />}
      emptyTitle="No datasets yet"
      emptyDescription="Upload a dataset to start building your model ecosystem."
      emptyAction={{ label: 'Upload Dataset', onClick: () => navigate('/app/datasets') }}
    >
      <>
        <div className="grid grid-cols-4 gap-2 text-[11px] font-mono mb-4">
          <div className="text-center">
            <span className="text-cyan-400 font-bold text-base block tabular-nums">{stats.total}</span>
            <span className="text-zinc-500">total</span>
          </div>
          <div className="text-center">
            <span className="text-emerald-400 font-bold text-base block tabular-nums">{stats.ready}</span>
            <span className="text-zinc-500">ready</span>
          </div>
          <div className="text-center">
            <span className="text-indigo-400 font-bold text-base block tabular-nums">{stats.recent}</span>
            <span className="text-zinc-500">this week</span>
          </div>
          <div className="text-center">
            <span className={stats.attention > 0 ? 'text-amber-400 font-bold text-base block tabular-nums' : 'text-zinc-500 font-bold text-base block tabular-nums'}>
              {stats.attention}
            </span>
            <span className="text-zinc-500">attention</span>
          </div>
        </div>

        {stats.total > 0 && (
          <>
            <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden flex p-0.5 border border-zinc-800 mb-4">
              {healthyPct > 0 && (
                <div className="h-full bg-emerald-500 rounded-l-full transition-all duration-500" style={{ width: `${healthyPct}%` }} />
              )}
              {attentionPct > 0 && (
                <div className="h-full bg-amber-500 rounded-r-full transition-all duration-500" style={{ width: `${attentionPct}%` }} />
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center mb-4">
              <div className="p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/70">
                <span className="block text-sm font-bold font-mono text-zinc-200 tabular-nums">{nf(stats.rows)}</span>
                <span className="text-[10px] font-mono text-zinc-500">total rows</span>
              </div>
              <div className="p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/70">
                <span className="block text-sm font-bold font-mono text-zinc-200 tabular-nums">{stats.columns}</span>
                <span className="text-[10px] font-mono text-zinc-500">features</span>
              </div>
              <div className="p-2 rounded-lg bg-zinc-950/50 border border-zinc-800/70">
                <span className="block text-sm font-bold font-mono text-zinc-200 tabular-nums">{stats.total}</span>
                <span className="text-[10px] font-mono text-zinc-500">datasets</span>
              </div>
            </div>
          </>
        )}

        {stats.attentionList.length > 0 && (
          <div className="space-y-2 mb-4">
            {stats.attentionList.map((d) => (
              <div key={d.id} className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-xs">
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
          <span>Open Data Center</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </>
    </SectionCard>
  );
}