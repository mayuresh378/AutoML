import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutGrid, Table, Braces, BarChart3, PieChart, Network, ShieldCheck,
  BrainCircuit, GitBranch, History, Search, RefreshCw, Upload, Download,
  Database, ArrowLeft, Clock, Tag, Target, Share2, X, Activity,
  Sparkles, FileSpreadsheet, SquareTerminal, Rows3, Columns3, Loader2,
  CheckCircle, AlertTriangle, FileUp, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { datasetsService } from '../../../services/datasets.service';
import { downloadUrl, getErrorMessage } from '../../../services/http';
import { PageContainer } from '../../../components/layout/PageContainer';
import { Tabs } from '../../../components/ui/Tabs';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { cn } from '../../../lib/cn';
import {
  useExplorerDatasets, useExplorerAnalyze, useExplorerProfile, useExplorerPreview,
} from '../explorer/hooks';
import { fmt, severityHex, severityLabel, dtypeMeta, baseDatasetName, gradeColor } from '../explorer/utils';
import type { DatasetMeta, ExplorerTabId } from '../explorer/types';
import { OverviewTab } from '../explorer/tabs/OverviewTab';
import { PreviewGrid } from '../explorer/components/PreviewGrid';
import { SchemaTab } from '../explorer/tabs/SchemaTab';
import { StatisticsTab } from '../explorer/tabs/StatisticsTab';
import { DistributionTab } from '../explorer/tabs/DistributionTab';
import { CorrelationTab } from '../explorer/tabs/CorrelationTab';
import { QualityTab } from '../explorer/tabs/QualityTab';
import { InsightsTab } from '../explorer/tabs/InsightsTab';
import { LineageTab } from '../explorer/tabs/LineageTab';
import { VersionsTab } from '../explorer/tabs/VersionsTab';
import { ColumnInspector } from '../explorer/components/ColumnInspector';
import { QualityGauge } from '../explorer/components/QualityGauge';

const TAB_DEFS: { id: ExplorerTabId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'preview', label: 'Preview', icon: Table },
  { id: 'schema', label: 'Schema', icon: Braces },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  { id: 'distribution', label: 'Distribution', icon: PieChart },
  { id: 'correlation', label: 'Correlation', icon: Network },
  { id: 'quality', label: 'Quality', icon: ShieldCheck },
  { id: 'insights', label: 'Insights', icon: BrainCircuit },
  { id: 'lineage', label: 'Lineage', icon: GitBranch },
  { id: 'versions', label: 'Versions', icon: History },
];

export default function ExplorerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ExplorerTabId>('overview');
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedDataset = searchParams.get('dataset') || '';

  const { data: datasets, isLoading: datasetsLoading, isError: datasetsError, refetch: refetchDatasets } = useExplorerDatasets();
  const currentDataset = useMemo(
    () => datasets?.find((d) => d.name === selectedDataset),
    [datasets, selectedDataset],
  );

  const analysis = useExplorerAnalyze(selectedDataset);
  const profile = useExplorerProfile(selectedDataset);
  const pagePreview = useExplorerPreview(selectedDataset, 50, 0);

  function handleSelectDataset(name: string) {
    setActiveTab('overview');
    setSelectedColumn(null);
    const next = new URLSearchParams(searchParams);
    if (name) next.set('dataset', name);
    else next.delete('dataset');
    setSearchParams(next, { replace: true });
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const res = await datasetsService.upload(file);
      await refetchDatasets();
      handleSelectDataset(res.filename || res.name);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  }

  async function handleExport() {
    if (!selectedDataset) return;
    try {
      const blob = await datasetsService.downloadFile(selectedDataset);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = selectedDataset; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (err) { console.error('Download failed:', err); }
  }

  function renderTab() {
    if (!currentDataset) return null;
    const common = {
      onSelectColumn: (col: string) => setSelectedColumn(col),
      selectedColumn,
    };
    switch (activeTab) {
      case 'overview':
        return <OverviewTab dataset={currentDataset} analysis={analysis.data} profile={profile.data} preview={pagePreview.data} onQuickAction={(to) => navigate(to)} />;
      case 'preview':
        return <PreviewGrid dataset={currentDataset.name} {...common} />;
      case 'schema':
        return <SchemaTab dataset={currentDataset} profile={profile.data} analysis={analysis.data} {...common} />;
      case 'statistics':
        return <StatisticsTab dataset={currentDataset} profile={profile.data} analysis={analysis.data} preview={pagePreview.data} {...common} />;
      case 'distribution':
        return <DistributionTab analysis={analysis.data} profile={profile.data} preview={pagePreview.data} {...common} />;
      case 'correlation':
        return <CorrelationTab analysis={analysis.data} preview={pagePreview.data} onSelectColumn={setSelectedColumn} />;
      case 'quality':
        return <QualityTab dataset={currentDataset} analysis={analysis.data} profile={profile.data} preview={pagePreview.data} onQuickAction={(to) => navigate(to)} />;
      case 'insights':
        return <InsightsTab analysis={analysis.data} />;
      case 'lineage':
        return <LineageTab dataset={currentDataset} datasets={datasets || []} onOpenDataset={handleSelectDataset} />;
      case 'versions':
        return <VersionsTab dataset={currentDataset} datasets={datasets || []} onOpenDataset={handleSelectDataset} />;
      default:
        return null;
    }
  }

  return (
    <PageContainer maxWidth="full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.parquet,.xlsx,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = '';
        }}
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
            <span>Data</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-zinc-300">Data Explorer</span>
            {selectedDataset && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-primary font-medium font-mono truncate max-w-[260px]">{selectedDataset}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Data Explorer</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {selectedDataset
              ? `Inspecting ${currentDataset?.rows?.toLocaleString() ?? '…'} rows across ${currentDataset?.columns?.length ?? '…'} columns`
              : 'Browse, analyze, and prepare your datasets for modeling'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading…' : 'Upload Data'}
          </button>
          <button
            onClick={() => refetchDatasets()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-zinc-300 hover:border-primary/40 hover:text-zinc-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={!selectedDataset}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-zinc-300 hover:border-primary/40 hover:text-zinc-100 transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => navigate(`/app/sql${selectedDataset ? `?dataset=${encodeURIComponent(selectedDataset)}` : ''}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-zinc-300 hover:border-primary/40 hover:text-zinc-100 transition-colors"
          >
            <SquareTerminal className="w-4 h-4" /> SQL Studio
          </button>
        </div>
      </div>

      {!selectedDataset ? (
        <DatasetLibrary
          datasets={datasets || []}
          loading={datasetsLoading}
          error={datasetsError}
          query={libraryQuery}
          onQuery={setLibraryQuery}
          onOpen={handleSelectDataset}
          onUpload={() => fileInputRef.current?.click()}
          onRetry={() => refetchDatasets()}
        />
      ) : !currentDataset ? (
        <ErrorState
          title={`Dataset “${selectedDataset}” not found`}
          message="It may have been removed. Pick another dataset from the library."
          onRetry={() => refetchDatasets()}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
            <main className="min-w-0 space-y-4">
              <DatasetHeader
                dataset={currentDataset}
                onClose={() => handleSelectDataset('')}
                onExport={handleExport}
                onOpenSQL={() => navigate(`/app/sql?dataset=${encodeURIComponent(currentDataset.name)}`)}
              />

              <div className="overflow-x-auto -mx-1 px-1">
                <Tabs
                  variant="underline"
                  activeTab={activeTab}
                  onChange={(t) => setActiveTab(t as ExplorerTabId)}
                  tabs={TAB_DEFS.map((t) => ({ id: t.id, label: t.label, icon: <t.icon className="w-4 h-4" /> }))}
                  className="min-w-max"
                />
              </div>

              {analysis.isLoading && activeTab === 'overview' ? (
                <div className="flex items-center justify-center h-64 rounded-xl border border-border bg-card">
                  <LoadingSpinner size="lg" />
                </div>
              ) : renderTab()}
            </main>

            <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
              <DatasetSidebar
                dataset={currentDataset}
                analysis={analysis.data}
                onQuickAction={(to) => navigate(to)}
              />
            </aside>
          </div>

          <RecentActivity dataset={currentDataset} analysis={analysis.data} onOpenTab={setActiveTab} />
        </>
      )}

      {selectedColumn && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedColumn(null)} />
          <div className="absolute right-0 top-0 h-full w-[400px] max-w-[92vw] overflow-y-auto bg-surface border-l border-border shadow-2xl p-3">
            <ColumnInspector
              column={selectedColumn}
              profile={profile.data}
              analysis={analysis.data}
              preview={pagePreview.data}
              onClose={() => setSelectedColumn(null)}
            />
          </div>
        </div>
      )}
    </PageContainer>
  );
}

/* ---------------------------- Library ---------------------------- */

function DatasetLibrary({
  datasets, loading, error, query, onQuery, onOpen, onUpload, onRetry,
}: {
  datasets: DatasetMeta[];
  loading: boolean;
  error: boolean;
  query: string;
  onQuery: (q: string) => void;
  onOpen: (name: string) => void;
  onUpload: () => void;
  onRetry: () => void;
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return datasets;
    return datasets.filter((d) =>
      d.name.toLowerCase().includes(q) ||
      (d.description || '').toLowerCase().includes(q) ||
      (d.tags || []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [datasets, query]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search datasets, tags, descriptions…"
            className="w-full rounded-lg bg-white/[0.04] border border-border pl-9 pr-8 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40"
          />
          {query && (
            <button onClick={() => onQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Database className="w-4 h-4" />
          <span className="font-medium text-zinc-300">{datasets.length}</span> datasets
        </div>
        <button onClick={onUpload} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-primary/40 hover:text-zinc-200 transition-colors">
          <FileUp className="w-3.5 h-3.5" /> Upload new
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
      ) : error ? (
        <div className="px-5 py-16 text-center text-sm text-red-400">Failed to load datasets. <button className="text-primary hover:underline" onClick={onRetry}>Try again</button></div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <Database className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">{datasets.length === 0 ? 'No datasets yet. Upload your first dataset to get started.' : 'No datasets match your search.'}</p>
          {datasets.length === 0 && (
            <button onClick={onUpload} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
              <Upload className="w-4 h-4" /> Upload Dataset
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
          {filtered.map((d) => <DatasetCard key={d.name} dataset={d} onOpen={() => onOpen(d.name)} />)}
        </div>
      )}
    </div>
  );
}

function DatasetCard({ dataset, onOpen }: { dataset: DatasetMeta; onOpen: () => void }) {
  const dtype = dataset.dtypes || {};
  const kinds = new Set(Object.values(dtype).map((t) => dtypeMeta(t).kind));
  return (
    <button
      onClick={onOpen}
      className="group rounded-xl border border-border bg-white/[0.02] p-4 text-left transition-all hover:border-primary/40 hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
        <StatusBadge status={dataset.status} />
      </div>
      <div className="mt-3 font-mono text-sm font-semibold text-zinc-200 truncate group-hover:text-primary transition-colors">{dataset.name}</div>
      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{dataset.description || `Dataset ${baseDatasetName(dataset.name)}`}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1"><Rows3 className="w-3 h-3" /> {dataset.rows.toLocaleString()} rows</span>
        <span className="inline-flex items-center gap-1"><Columns3 className="w-3 h-3" /> {dataset.columns.length} cols</span>
        <span className="inline-flex items-center gap-1"><Database className="w-3 h-3" /> {fmt.bytes(dataset.size_kb)}</span>
      </div>
      <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[10px] text-zinc-600">
        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {fmt.date(dataset.uploaded_at)}</span>
        <span className="inline-flex items-center gap-1"><Tag className="w-3 h-3" /> v{dataset.version ?? 1} · {dataset.source || 'upload'}</span>
      </div>
      {kinds.size > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {Array.from(kinds).slice(0, 4).map((k) => (
            <span key={k} className="rounded-full bg-white/[0.04] border border-white/10 px-1.5 py-px text-[9px] text-zinc-500">{k}</span>
          ))}
        </div>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    processing: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
    uploaded: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
    error: 'bg-red-500/10 text-red-400 border border-red-500/20',
  };
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide', map[status] || 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20')}>
      {status}
    </span>
  );
}

/* ---------------------------- Header ---------------------------- */

function DatasetHeader({ dataset, onClose, onExport, onOpenSQL }: { dataset: DatasetMeta; onClose: () => void; onExport: () => void; onOpenSQL: () => void }) {
  const numeric = Object.values(dataset.dtypes || {}).filter((t) => /int|float|number/.test(t.toLowerCase())).length;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onClose} title="Back to library" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-primary/40 transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primary flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono font-semibold text-lg text-zinc-100 truncate">{dataset.name}</h2>
            <StatusBadge status={dataset.status} />
            <span className="rounded-full bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[10px] font-mono text-zinc-400">v{dataset.version ?? 1}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1"><Rows3 className="w-3 h-3" /> {dataset.rows.toLocaleString()} rows</span>
            <span className="inline-flex items-center gap-1"><Columns3 className="w-3 h-3" /> {dataset.columns.length} columns</span>
            <span className="inline-flex items-center gap-1"><Database className="w-3 h-3" /> {fmt.bytes(dataset.size_kb)}</span>
            {numeric > 0 && <span className="inline-flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {numeric} numeric</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onExport} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-zinc-300 hover:border-primary/40 hover:text-zinc-100 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={onOpenSQL} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-zinc-300 hover:border-primary/40 hover:text-zinc-100 transition-colors">
            <SquareTerminal className="w-3.5 h-3.5" /> Query
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Sidebar ---------------------------- */

function DatasetSidebar({
  dataset, analysis, onQuickAction,
}: {
  dataset: DatasetMeta;
  analysis?: ReturnType<typeof useExplorerAnalyze>['data'];
  onQuickAction: (to: string) => void;
}) {
  const qs = analysis?.quality_score;
  const missing = analysis?.missing;
  const target = analysis?.target;
  const shared = dataset.source_url || (dataset.tags || []).length > 0;

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Quality</h3>
          {qs && <span className="text-[10px] font-mono" style={{ color: gradeColor(qs.grade) }}>{qs.grade}</span>}
        </div>
        {qs ? (
          <div className="flex items-center gap-4">
            <QualityGauge score={qs.total} grade={qs.grade} label="" size={76} stroke={8} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">Missing</span><span className="font-mono text-zinc-300">{missing ? fmt.pct(missing.missing_pct) : '—'}</span></div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${missing ? 100 - missing.missing_pct : 100}%` }} /></div>
              <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">Duplicates</span><span className="font-mono text-zinc-300">{analysis?.duplicates ? fmt.pct(analysis.duplicates.pct) : '—'}</span></div>
              <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full rounded-full" style={{ width: analysis?.duplicates ? `${Math.max(2, 100 - analysis.duplicates.pct)}%` : '100%', backgroundColor: severityHex(analysis?.duplicates?.severity || 'low') }} /></div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Run the analysis to compute a quality score.</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Details</h3>
        <dl className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between"><dt className="text-zinc-500">Source</dt><dd className="text-zinc-300 capitalize">{dataset.source || 'upload'}</dd></div>
          <div className="flex items-center justify-between"><dt className="text-zinc-500">Uploaded</dt><dd className="text-zinc-300">{fmt.dateTime(dataset.uploaded_at)}</dd></div>
          <div className="flex items-center justify-between"><dt className="text-zinc-500">Version</dt><dd className="text-zinc-300 font-mono">v{dataset.version ?? 1}</dd></div>
          <div className="flex items-center justify-between"><dt className="text-zinc-500">Rows</dt><dd className="text-zinc-300 font-mono">{dataset.rows.toLocaleString()}</dd></div>
          <div className="flex items-center justify-between"><dt className="text-zinc-500">Columns</dt><dd className="text-zinc-300 font-mono">{dataset.columns.length}</dd></div>
          <div className="flex items-center justify-between"><dt className="text-zinc-500">Size</dt><dd className="text-zinc-300 font-mono">{fmt.bytes(dataset.size_kb)}</dd></div>
          {target && (
            <div className="flex items-center justify-between"><dt className="text-zinc-500">Target</dt><dd className="text-fuchsia-400 font-mono inline-flex items-center gap-1"><Target className="w-3 h-3" />{target}</dd></div>
          )}
        </dl>
        {dataset.tags && dataset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/[0.05]">
            {dataset.tags.map((t) => <span key={t} className="rounded-full bg-white/[0.05] border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">#{t}</span>)}
          </div>
        )}
        {dataset.description && <p className="text-[11px] text-zinc-500 mt-3 pt-3 border-t border-white/[0.05] leading-relaxed">{dataset.description}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Share2 className="w-3.5 h-3.5 text-zinc-500" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Access</h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-zinc-400">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          Owner · full access
        </div>
        <p className="text-[10px] text-zinc-600 mt-2">{shared ? 'Shared via URL or tagged for collaboration.' : 'Private to your workspace.'}</p>
        {analysis?.class_imbalance?.detected && (
          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[10px] text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {severityLabel(analysis.class_imbalance.severity || '')} class imbalance on “{analysis.class_imbalance.target}”
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Quick Actions</h3>
        <div className="space-y-2">
          {[
            { label: 'Data Profiling', to: `/app/profiling?dataset=${encodeURIComponent(dataset.name)}` },
            { label: 'Data Cleaning', to: `/app/cleaning?dataset=${encodeURIComponent(dataset.name)}` },
            { label: 'Feature Engineering', to: `/app/feature-engineering?dataset=${encodeURIComponent(dataset.name)}` },
            { label: 'Train a Model', to: `/app/engine?dataset=${encodeURIComponent(dataset.name)}` },
          ].map((a) => (
            <button key={a.label} onClick={() => onQuickAction(a.to)} className="w-full rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-left text-xs text-zinc-300 hover:border-primary/40 hover:text-zinc-100 transition-colors flex items-center justify-between gap-2">
              {a.label} <Sparkles className="w-3 h-3 text-zinc-600" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------------------------- Activity ---------------------------- */

function RecentActivity({
  dataset, analysis, onOpenTab,
}: {
  dataset: DatasetMeta;
  analysis?: ReturnType<typeof useExplorerAnalyze>['data'];
  onOpenTab: (t: ExplorerTabId) => void;
}) {
  const items: { icon: LucideIcon; title: string; detail: string; time: string; tab: ExplorerTabId }[] = [
    { icon: BrainCircuit, title: 'Analysis completed', detail: `Computed profiles for ${analysis?.columns ?? dataset.columns.length} columns`, time: fmt.timeAgo(dataset.uploaded_at), tab: 'insights' },
    { icon: BarChart3, title: 'Statistics generated', detail: `${analysis?.distributions?.columns?.length ?? 0} numeric distributions`, time: fmt.timeAgo(dataset.uploaded_at), tab: 'statistics' },
    { icon: ShieldCheck, title: 'Quality scored', detail: analysis?.quality_score ? `Grade ${analysis.quality_score.grade} · ${Math.round(analysis.quality_score.total)}/100` : 'Pending', time: fmt.timeAgo(dataset.uploaded_at), tab: 'quality' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card mt-6">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Activity className="w-4 h-4 text-zinc-500" />
        <h3 className="text-sm font-semibold text-zinc-100">Recent Activity</h3>
        <span className="text-xs text-zinc-500 ml-auto">Dataset {dataset.name}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.05]">
        {items.map((it) => (
          <button key={it.title} onClick={() => onOpenTab(it.tab)} className="group flex items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]">
            <span className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 text-zinc-400 group-hover:text-primary transition-colors">
              <it.icon className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-200">{it.title}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{it.detail}</div>
              <div className="text-[10px] text-zinc-600 mt-1 inline-flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{it.time}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
