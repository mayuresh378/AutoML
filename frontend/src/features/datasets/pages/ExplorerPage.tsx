import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutGrid, Table, Braces, BarChart3, PieChart, Network, ShieldCheck,
  BrainCircuit, GitBranch, History, Search, RefreshCw, Upload, Download,
  Database, ArrowLeft, Clock, Tag, Sparkles, FileSpreadsheet,
  SquareTerminal, Rows3, Columns3, Loader2, AlertTriangle, FileUp, X,
  ChevronRight, type LucideIcon,
} from 'lucide-react';
import { datasetsService } from '../../../services/datasets.service';
import { PageContainer } from '../../../components/layout/PageContainer';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { cn } from '../../../lib/cn';
import {
  useExplorerDatasets, useExplorerAnalyze, useExplorerProfile, useExplorerPreview,
} from '../explorer/hooks';
import { fmt, severityHex, severityLabel, dtypeMeta, baseDatasetName, gradeColor, gradeTextCls } from '../explorer/utils';
import type { DatasetMeta, DatasetPreview, ExplorerTabId, DatasetAnalysisResult, DatasetProfile } from '../explorer/types';
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

const PRIMARY_TABS: { id: ExplorerTabId; label: string; icon: LucideIcon }[] = [
  { id: 'preview', label: 'Data View', icon: Table },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  { id: 'distribution', label: 'Distribution', icon: PieChart },
  { id: 'correlation', label: 'Correlation', icon: Network },
  { id: 'quality', label: 'Quality', icon: ShieldCheck },
  { id: 'insights', label: 'Insights', icon: BrainCircuit },
];

const SECONDARY_TABS: { id: ExplorerTabId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'schema', label: 'Schema', icon: Braces },
  { id: 'lineage', label: 'Lineage', icon: GitBranch },
  { id: 'versions', label: 'Versions', icon: History },
];

const ANALYSIS_TABS: ExplorerTabId[] = ['overview', 'schema', 'statistics', 'distribution', 'correlation', 'quality', 'insights'];
const PROFILE_TABS: ExplorerTabId[] = ['overview', 'schema', 'statistics', 'distribution', 'quality'];

export default function ExplorerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ExplorerTabId>('preview');
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
    setActiveTab('preview');
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
        return <PreviewGrid dataset={currentDataset.name} {...common} profile={profile.data ?? null} analysis={analysis.data ?? null} />;
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

  const needsAnalysis = ANALYSIS_TABS.includes(activeTab);
  const needsProfile = PROFILE_TABS.includes(activeTab);
  const profileBlocked = needsProfile && !profile.data && profile.isError;
  const analysisBlocked = needsAnalysis && !analysis.data && analysis.isError;
  const profilePending = needsProfile && !profile.data && profile.isFetching;
  const analysisPending = needsAnalysis && !analysis.data && analysis.isFetching;
  const blocked = profileBlocked || analysisBlocked;
  const pending = !blocked && (profilePending || analysisPending);

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

      <ExplorerHeader
        dataset={currentDataset || null}
        uploading={uploading}
        onUploadClick={() => fileInputRef.current?.click()}
        onRefresh={() => refetchDatasets()}
        onExport={handleExport}
        onOpenSQL={() => navigate(`/app/sql${selectedDataset ? `?dataset=${encodeURIComponent(selectedDataset)}` : ''}`)}
      />

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
      ) : datasetsLoading && !currentDataset ? (
        <div className="flex items-center justify-center h-64 rounded-2xl border border-white/[0.06] bg-card">
          <LoadingSpinner size="lg" />
        </div>
      ) : datasetsError && !currentDataset ? (
        <ErrorState
          title="Unable to load datasets"
          message="Data unavailable. Unable to connect to the backend — check your connection and try again."
          onRetry={() => refetchDatasets()}
        />
      ) : !currentDataset ? (
        <ErrorState
          title={`Dataset "${selectedDataset}" not found`}
          message="It may have been removed. Pick another dataset from the library."
          onRetry={() => refetchDatasets()}
        />
      ) : (
        <>
          <DatasetSelectorCard
            dataset={currentDataset}
            datasets={datasets || []}
            onSelect={handleSelectDataset}
            onBack={() => handleSelectDataset('')}
            onExport={handleExport}
            onOpenSQL={() => navigate(`/app/sql?dataset=${encodeURIComponent(currentDataset.name)}`)}
          />

          <SummaryCards dataset={currentDataset} analysis={analysis.data} />

          <ExplorerTabBar activeTab={activeTab} onSelect={(t) => setActiveTab(t)} />

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
            <main className="min-w-0">
              {blocked ? (
                <ErrorState
                  title={profileBlocked ? 'Profile unavailable' : 'Analysis unavailable'}
                  message={profileBlocked
                    ? 'Unable to load column profiles. Data unavailable — check your connection and try again.'
                    : 'Unable to load analysis results. Data unavailable — check your connection and try again.'}
                  onRetry={profileBlocked ? profile.refetch : analysis.refetch}
                />
              ) : pending ? (
                <div className="flex items-center justify-center h-72 rounded-2xl border border-white/[0.06] bg-card">
                  <LoadingSpinner size="lg" />
                </div>
              ) : (
                renderTab()
              )}
            </main>

            <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
              <DataQualityCard
                analysis={analysis.data}
                loading={!analysis.data && analysis.isFetching}
                error={analysis.isError && !analysis.data}
                onRetry={analysis.refetch}
              />
              <ColumnSummaryCard
                dataset={currentDataset}
                profile={profile.data}
                loading={!profile.data && profile.isFetching}
                error={profile.isError && !profile.data}
                onRetry={profile.refetch}
                onInspect={setSelectedColumn}
              />
              <QuickActionsCard dataset={currentDataset} onQuickAction={(to) => navigate(to)} />
            </aside>
          </div>

          {activeTab === 'preview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
              <DataPreviewCard
                preview={pagePreview.data}
                loading={!pagePreview.data && pagePreview.isFetching}
                error={pagePreview.isError && !pagePreview.data}
                onRetry={pagePreview.refetch}
              />
              <DistributionPreviewCard
                analysis={analysis.data}
                loading={!analysis.data && analysis.isFetching}
                error={analysis.isError && !analysis.data}
                onRetry={analysis.refetch}
              />
              <StatisticsPreviewCard
                profile={profile.data}
                loading={!profile.data && profile.isFetching}
                error={profile.isError && !profile.data}
                onRetry={profile.refetch}
              />
            </div>
          )}
        </>
      )}

      {selectedColumn && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedColumn(null)} />
          <div className="absolute right-0 top-0 h-full w-[400px] max-w-[92vw] overflow-y-auto bg-surface border-l border-white/[0.10] shadow-2xl p-3">
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

/* ---------------------------- Header ---------------------------- */

function ExplorerHeader({
  dataset, uploading, onUploadClick, onRefresh, onExport, onOpenSQL,
}: {
  dataset: DatasetMeta | null;
  uploading: boolean;
  onUploadClick: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onOpenSQL: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
          <span className="text-zinc-400 hover:text-zinc-200 transition-colors">Data</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-zinc-400 hover:text-zinc-200 transition-colors">Data Explorer</span>
          {dataset && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-cyan-300 font-medium font-mono truncate max-w-[260px]">{dataset.name}</span>
            </>
          )}
        </div>
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Data Explorer</h1>
        <p className="text-sm text-zinc-400 mt-1">
          {dataset
            ? `Inspecting ${dataset.rows?.toLocaleString() ?? '…'} rows across ${dataset.columns?.length ?? '…'} columns`
            : 'Browse, analyze, and prepare your datasets for modeling'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onUploadClick}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2.5 text-sm font-semibold text-black shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-teal-400 transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Upload Data'}
        </button>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-zinc-300 hover:border-cyan-400/40 hover:text-zinc-100 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
        <button
          onClick={onExport}
          disabled={!dataset}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-zinc-300 hover:border-cyan-400/40 hover:text-zinc-100 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <Download className="w-4 h-4" /> Export
        </button>
        <button
          onClick={onOpenSQL}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-zinc-300 hover:border-cyan-400/40 hover:text-zinc-100 transition-colors"
        >
          <SquareTerminal className="w-4 h-4" /> SQL Studio
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- Dataset selector card ---------------------------- */

function DatasetSelectorCard({
  dataset, datasets, onSelect, onBack, onExport, onOpenSQL,
}: {
  dataset: DatasetMeta;
  datasets: DatasetMeta[];
  onSelect: (name: string) => void;
  onBack: () => void;
  onExport: () => void;
  onOpenSQL: () => void;
}) {
  const ext = (dataset.filename || dataset.name).match(/\.(\w+)$/)?.[1]?.toUpperCase() || 'DATA';
  const numeric = Object.values(dataset.dtypes || {}).filter((t) => /int|float|number/.test(t.toLowerCase())).length;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-transparent p-4 mb-6 hover:border-cyan-400/20 transition-colors">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          title="Back to library"
          className="w-9 h-9 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center text-zinc-400 hover:text-cyan-300 hover:border-cyan-400/40 transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/25 to-teal-500/25 text-cyan-300 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-5 h-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-mono font-semibold text-lg text-zinc-100 truncate">{dataset.name}</h2>
            <StatusBadge status={dataset.status} />
            <span className="rounded-full bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[10px] font-mono text-zinc-400">v{dataset.version ?? 1}</span>
            <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-mono text-cyan-300">{ext}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[11px] text-zinc-500">
            <span className="inline-flex items-center gap-1"><Rows3 className="w-3 h-3" /> {dataset.rows.toLocaleString()} rows</span>
            <span className="inline-flex items-center gap-1"><Columns3 className="w-3 h-3" /> {dataset.columns.length} columns</span>
            <span className="inline-flex items-center gap-1"><Database className="w-3 h-3" /> {fmt.bytes(dataset.size_kb)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Updated {fmt.dateTime(dataset.uploaded_at)}</span>
            <span className="inline-flex items-center gap-1"><Tag className="w-3 h-3" /> {dataset.source || 'upload'}</span>
            {numeric > 0 && <span className="inline-flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {numeric} numeric</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
            <Database className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-600">Switch</span>
            <select
              value={dataset.name}
              onChange={(e) => onSelect(e.target.value)}
              className="bg-transparent text-xs font-medium text-zinc-200 focus:outline-none cursor-pointer"
              style={{ colorScheme: 'dark' }}
            >
              {datasets.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </label>
          <button onClick={onExport} className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs font-medium text-zinc-300 hover:border-cyan-400/40 hover:text-zinc-100 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={onOpenSQL} className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs font-medium text-zinc-300 hover:border-cyan-400/40 hover:text-zinc-100 transition-colors">
            <SquareTerminal className="w-3.5 h-3.5" /> Query
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Summary metrics ---------------------------- */

function SummaryCards({ dataset, analysis }: { dataset: DatasetMeta; analysis?: DatasetAnalysisResult | null }) {
  const qs = analysis?.quality_score;
  const cards = [
    {
      label: 'Rows', value: fmt.int(dataset.rows), sub: 'total records', icon: Rows3,
      tile: 'from-cyan-500/20 to-cyan-500/5 text-cyan-300', ring: 'hover:border-cyan-400/30',
    },
    {
      label: 'Columns', value: fmt.int(dataset.columns.length), sub: 'features', icon: Columns3,
      tile: 'from-violet-500/20 to-violet-500/5 text-violet-300', ring: 'hover:border-violet-400/30',
    },
    {
      label: 'Size', value: fmt.bytes(dataset.size_kb), sub: 'on disk', icon: Database,
      tile: 'from-teal-500/20 to-teal-500/5 text-teal-300', ring: 'hover:border-teal-400/30',
    },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((c) => (
        <div key={c.label} className={cn('rounded-2xl border border-white/[0.08] bg-card p-4 transition-all hover:-translate-y-0.5', c.ring)}>
          <div className={cn('w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3', c.tile)}>
            <c.icon className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-zinc-100 font-mono tracking-tight">{c.value}</div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 mt-0.5">{c.label} · {c.sub}</div>
        </div>
      ))}
      <div className="rounded-2xl border border-white/[0.08] bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-fuchsia-400/30">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-fuchsia-500/5 text-fuchsia-300 flex items-center justify-center mb-3">
          <Sparkles className="w-4 h-4" />
        </div>
        {qs ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono tracking-tight" style={{ color: gradeColor(qs.grade) }}>
                {Math.round(qs.total)}
              </span>
              <span className="text-xs text-zinc-500">/ 100</span>
            </div>
            <div className={cn('text-[11px] uppercase tracking-wider mt-0.5 font-semibold', gradeTextCls(qs.grade))}>
              Quality Score · Grade {qs.grade}
            </div>
          </>
        ) : (
          <>
            <div className="text-xl font-bold text-zinc-500 font-mono tracking-tight animate-pulse">—</div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-600 mt-0.5">Quality Score · pending</div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- Tab bar ---------------------------- */

function ExplorerTabBar({ activeTab, onSelect }: { activeTab: ExplorerTabId; onSelect: (t: ExplorerTabId) => void }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1 mb-5">
      {PRIMARY_TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all',
            activeTab === t.id
              ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm shadow-cyan-500/10'
              : 'text-zinc-400 border border-transparent hover:text-zinc-100 hover:bg-white/[0.04]',
          )}
        >
          <t.icon className="w-3.5 h-3.5" />
          {t.label}
        </button>
      ))}
      <div className="h-5 w-px bg-white/[0.08] mx-2 shrink-0" />
      <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-600 mr-1">Advanced</span>
      {SECONDARY_TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
            activeTab === t.id
              ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 border border-cyan-400/40 shadow-sm shadow-cyan-500/10'
              : 'text-zinc-500 border border-transparent hover:text-zinc-100 hover:bg-white/[0.04]',
          )}
        >
          <t.icon className="w-3.5 h-3.5" />
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------- Sidebar ---------------------------- */

function DataQualityCard({
  analysis, loading, error, onRetry,
}: {
  analysis?: DatasetAnalysisResult | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const qs = analysis?.quality_score;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Data Quality</h3>
        {qs && <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-white/[0.04]', gradeTextCls(qs.grade))}>{qs.grade}</span>}
      </div>

      {error ? (
        <div className="py-4 text-center">
          <p className="text-xs text-red-400">Unable to load quality metrics.</p>
          <button onClick={onRetry} className="mt-2 text-xs text-cyan-300 hover:underline">Try again</button>
        </div>
      ) : loading || !analysis ? (
        <div className="flex items-center justify-center py-8">
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-600" /> : <p className="text-xs text-zinc-500">Run the analysis to compute a quality score.</p>}
        </div>
      ) : qs ? (
        <>
          <div className="flex items-center gap-4">
            <QualityGauge
              score={qs.total}
              grade={qs.grade}
              size={120}
              stroke={10}
              centerNode={
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-bold tracking-tight" style={{ color: gradeColor(qs.grade) }}>{Math.round(qs.total)}</span>
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">Score</span>
                  <span className="text-xs font-bold mt-0.5" style={{ color: gradeColor(qs.grade) }}>Grade {qs.grade}</span>
                </div>
              }
            />
            <div className="flex-1 space-y-2.5">
              <MetricRow sev={analysis.missing?.severity} label="Missing cells" value={`${fmt.int(analysis.missing?.total_missing)} (${fmt.pct(analysis.missing?.missing_pct)})`} />
              <MetricRow sev={analysis.duplicates?.severity} label="Duplicate rows" value={`${fmt.int(analysis.duplicates?.count)} (${fmt.pct(analysis.duplicates?.pct)})`} />
              {(() => {
                const pct = analysis.outliers?.mean_pct ?? 0;
                const sev = pct >= 8 ? 'high' : pct >= 3 ? 'medium' : 'low';
                return <MetricRow sev={sev} label="Outliers" value={`${fmt.int(analysis.outliers?.total_outliers)} (${fmt.pct(pct)})`} />;
              })()}
            </div>
          </div>

          {Object.keys(qs.components || {}).length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/[0.06] space-y-2">
              {Object.entries(qs.components).slice(0, 4).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-[10px]">
                  <span className="w-20 truncate text-zinc-500 capitalize">{k.replace(/_/g, ' ')}</span>
                  <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-teal-400" style={{ width: `${Math.min(100, Math.max(0, v))}%` }} />
                  </div>
                  <span className="font-mono text-zinc-400 w-8 text-right">{Math.round(v)}</span>
                </div>
              ))}
            </div>
          )}

          {analysis.class_imbalance?.detected && (
            <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-[10px] text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="min-w-0">{severityLabel(analysis.class_imbalance.severity || '')} class imbalance on “{analysis.class_imbalance.target}”</span>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function MetricRow({ sev, label, value }: { sev?: string; label: string; value: string }) {
  const hex = severityHex(sev || 'low');
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="inline-flex items-center gap-1.5 text-zinc-500 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: hex, boxShadow: `0 0 6px ${hex}` }} />
        <span className="truncate">{label}</span>
      </span>
      <span className="font-mono text-zinc-300 shrink-0">{value}</span>
    </div>
  );
}

function ColumnSummaryCard({
  dataset, profile, loading, error, onRetry, onInspect,
}: {
  dataset: DatasetMeta;
  profile?: DatasetProfile | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onInspect: (col: string) => void;
}) {
  const [colSel, setColSel] = useState<string>('');
  const cols = dataset.columns || [];
  const col = cols.includes(colSel) ? colSel : (cols[0] ?? '');
  const cp = profile?.column_details?.find((d) => d.name === col);
  const dt = dtypeMeta(cp?.dtype ?? profile?.dtypes?.[col], col);
  const topValues = cp?.top_values ? Object.entries(cp.top_values).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
  const numeric = dt.kind === 'numeric' && cp?.mean != null;
  const maxTop = Math.max(1, ...topValues.map(([, c]) => c));

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Column Summary</h3>
        <label className="inline-flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Column</span>
          <select
            value={col}
            onChange={(e) => setColSel(e.target.value)}
            className="rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-cyan-400/40 max-w-[140px]"
            style={{ colorScheme: 'dark' }}
          >
            {cols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {error ? (
        <div className="py-4 text-center">
          <p className="text-xs text-red-400">Unable to load column profile.</p>
          <button onClick={onRetry} className="mt-2 text-xs text-cyan-300 hover:underline">Try again</button>
        </div>
      ) : loading || !profile ? (
        <div className="flex items-center justify-center py-8">
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-zinc-600" /> : <p className="text-xs text-zinc-500">Profiling this column…</p>}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium', dt.cls)}>
              <dt.Icon className="w-3 h-3" style={{ color: dt.hex }} /> {dt.label}
            </span>
            {cp && (
              <>
                <span className="rounded-full bg-white/[0.05] border border-white/10 px-2 py-0.5 text-[10px] font-mono text-zinc-400">{fmt.int(cp.unique_values)} unique</span>
                <span className="rounded-full bg-white/[0.05] border border-white/10 px-2 py-0.5 text-[10px] font-mono text-zinc-400">{fmt.int(cp.missing)} missing</span>
                {cp.outliers != null && <span className="rounded-full bg-white/[0.05] border border-white/10 px-2 py-0.5 text-[10px] font-mono text-zinc-400">{fmt.int(cp.outliers)} outliers</span>}
              </>
            )}
          </div>

          {topValues.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">Top values</span>
              {topValues.map(([k, c]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="flex-1 truncate font-mono text-[10px] text-zinc-300">{String(k)}</span>
                  <div className="w-20 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-violet-400/70" style={{ width: `${(c / maxTop) * 100}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500 w-10 text-right">{fmt.num(c)}</span>
                </div>
              ))}
            </div>
          )}

          {numeric && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="Mean" value={fmt.dec(cp.mean)} />
              <Stat label="Median" value={fmt.dec(cp.median)} />
              <Stat label="Min" value={fmt.dec(cp.min)} />
              <Stat label="Max" value={fmt.dec(cp.max)} />
              <Stat label="Std" value={fmt.dec(cp.std)} />
              <Stat label="Range" value={fmt.dec((cp.max ?? 0) - (cp.min ?? 0))} />
            </div>
          )}

          <button
            onClick={() => onInspect(col)}
            className="mt-3 w-full rounded-lg border border-cyan-400/30 bg-cyan-500/[0.06] px-3 py-2 text-xs font-medium text-cyan-300 hover:border-cyan-400/50 hover:bg-cyan-500/10 transition-colors"
          >
            Inspect “{col}”
          </button>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="font-mono text-xs text-zinc-200 mt-0.5">{value}</div>
    </div>
  );
}

function QuickActionsCard({ dataset, onQuickAction }: { dataset: DatasetMeta; onQuickAction: (to: string) => void }) {
  const actions = [
    { label: 'Data Profiling', to: `/app/profiling?dataset=${encodeURIComponent(dataset.name)}` },
    { label: 'Data Cleaning', to: `/app/cleaning?dataset=${encodeURIComponent(dataset.name)}` },
    { label: 'Feature Engineering', to: `/app/feature-engineering?dataset=${encodeURIComponent(dataset.name)}` },
    { label: 'Train a Model', to: `/app/engine?dataset=${encodeURIComponent(dataset.name)}` },
  ];
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Quick Actions</h3>
      <div className="space-y-2">
        {actions.map((a) => (
          <button key={a.label} onClick={() => onQuickAction(a.to)} className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-left text-xs text-zinc-300 hover:border-cyan-400/40 hover:text-cyan-200 transition-colors flex items-center justify-between gap-2">
            {a.label} <Sparkles className="w-3 h-3 text-zinc-600" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------- Bottom strip ---------------------------- */

function CardShell({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DataPreviewCard({
  preview, loading, error, onRetry,
}: {
  preview?: DatasetPreview | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const cols = preview?.columns?.slice(0, 6) ?? [];
  const rows = preview?.rows?.slice(0, 5) ?? [];
  return (
    <CardShell
      title="Data Preview"
      right={<span className="text-[10px] text-zinc-600 font-mono">{preview ? `${preview.rows.length ?? 0} loaded rows` : ''}</span>}
    >
      {error ? (
        <div className="py-6 text-center">
          <p className="text-xs text-red-400">Unable to load preview.</p>
          <button onClick={onRetry} className="mt-2 text-xs text-cyan-300 hover:underline">Try again</button>
        </div>
      ) : loading || !preview ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-6">No rows to preview.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-2 py-1.5 text-[9px] uppercase tracking-wider text-zinc-600 font-semibold">#</th>
                {cols.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-[9px] uppercase tracking-wider text-zinc-500 font-semibold truncate max-w-[110px]">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-t border-white/[0.04]">
                  <td className="px-2 py-1.5 font-mono text-[10px] text-zinc-600">{ri + 1}</td>
                  {cols.map((c) => {
                    const v = r[c];
                    return (
                      <td key={c} className="px-2 py-1.5 font-mono text-[10px] text-zinc-300 max-w-[110px] truncate">
                        {v == null || v === '' ? <span className="text-zinc-600 italic">NULL</span> : String(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CardShell>
  );
}

function DistributionPreviewCard({
  analysis, loading, error, onRetry,
}: {
  analysis?: DatasetAnalysisResult | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const [colSel, setColSel] = useState('');
  const dists = analysis?.distributions?.columns ?? [];
  const d = dists.find((x) => x.column === colSel) ?? dists[0];
  const bins = d?.bins ?? [];
  const max = Math.max(1, ...bins);
  const step = Math.max(1, Math.round(bins.length / 24));
  const bars = bins.filter((_, i) => i % step === 0).slice(0, 24);

  return (
    <CardShell
      title="Distribution"
      right={dists.length > 0 ? (
        <select
          value={d?.column ?? ''}
          onChange={(e) => setColSel(e.target.value)}
          className="rounded-lg bg-white/[0.04] border border-white/[0.08] px-2 py-1 text-[10px] text-zinc-300 focus:outline-none focus:border-cyan-400/40 max-w-[130px]"
          style={{ colorScheme: 'dark' }}
        >
          {dists.map((x) => <option key={x.column} value={x.column}>{x.column}</option>)}
        </select>
      ) : undefined}
    >
      {error ? (
        <div className="py-6 text-center">
          <p className="text-xs text-red-400">Unable to load distributions.</p>
          <button onClick={onRetry} className="mt-2 text-xs text-cyan-300 hover:underline">Try again</button>
        </div>
      ) : loading || !analysis ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-600" /></div>
      ) : bars.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-6">No numeric distributions to display.</p>
      ) : (
        <>
          <div className="flex items-end gap-[2px] h-16">
            {bars.map((v, i) => (
              <span key={i} title={fmt.dec(v)} className="flex-1 rounded-sm bg-gradient-to-t from-cyan-500/80 to-teal-400/60"
                style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: 0.35 + 0.65 * (v / max) }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
            <span className="text-zinc-500">Mean <span className="font-mono text-zinc-300 float-right">{fmt.dec(d?.mean)}</span></span>
            <span className="text-zinc-500">Median <span className="font-mono text-zinc-300 float-right">{fmt.dec(d?.median)}</span></span>
            <span className="text-zinc-500">Std <span className="font-mono text-zinc-300 float-right">{fmt.dec(d?.std)}</span></span>
            <span className="text-zinc-500">Skew <span className="font-mono text-zinc-300 float-right">{fmt.dec(d?.skewness)}</span></span>
          </div>
        </>
      )}
    </CardShell>
  );
}

function StatisticsPreviewCard({
  profile, loading, error, onRetry,
}: {
  profile?: DatasetProfile | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const numeric = (profile?.column_details ?? [])
    .filter((c) => c.mean != null)
    .slice(0, 5);
  const categorical = (profile?.column_details ?? [])
    .filter((c) => c.mean == null)
    .slice(0, 5);

  return (
    <CardShell
      title="Statistics"
      right={<span className="text-[10px] text-zinc-600 font-mono">{profile ? `${numeric.length} numeric` : ''}</span>}
    >
      {error ? (
        <div className="py-6 text-center">
          <p className="text-xs text-red-400">Unable to load statistics.</p>
          <button onClick={onRetry} className="mt-2 text-xs text-cyan-300 hover:underline">Try again</button>
        </div>
      ) : loading || !profile ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-600" /></div>
      ) : numeric.length === 0 && categorical.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-6">No statistics available.</p>
      ) : (
        <div className="space-y-2">
          {numeric.map((c) => (
            <div key={c.name} className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-zinc-200 truncate">{c.name}</span>
                <span className="font-mono text-[11px] text-cyan-300">{fmt.dec(c.mean)}</span>
              </div>
              <div className="text-[9px] text-zinc-600 mt-0.5">min {fmt.dec(c.min)} · med {fmt.dec(c.median)} · max {fmt.dec(c.max)}</div>
            </div>
          ))}
          {numeric.length === 0 && categorical.map((c) => (
            <div key={c.name} className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-zinc-200 truncate">{c.name}</span>
                <span className="font-mono text-[11px] text-violet-300">{fmt.num(c.unique_values ?? 0)} unique</span>
              </div>
              <div className="text-[9px] text-zinc-600 mt-0.5">
                {(() => {
                  const ent = c.top_values ? Object.entries(c.top_values)[0] : undefined;
                  return ent ? `top “${String(ent[0])}” · ${fmt.num(ent[1] ?? 0)}` : 'no top values';
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </CardShell>
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
    <div className="rounded-2xl border border-white/[0.08] bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.08] flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search datasets, tags, descriptions…"
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] pl-9 pr-8 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/40"
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
        <button onClick={onUpload} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/[0.12] px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-cyan-400/40 hover:text-cyan-300 transition-colors">
          <FileUp className="w-3.5 h-3.5" /> Upload new
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
      ) : error ? (
        <div className="px-5 py-16 text-center">
          <p className="text-sm text-red-400">Unable to load datasets. Data unavailable — check your connection.</p>
          <button className="mt-3 text-sm text-cyan-300 hover:underline" onClick={onRetry}>Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <Database className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">{datasets.length === 0 ? 'No datasets yet. Upload your first dataset to get started.' : 'No datasets match your search.'}</p>
          {datasets.length === 0 && (
            <button onClick={onUpload} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-2 text-sm font-semibold text-black shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-teal-400 transition-all">
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
      className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition-all hover:border-cyan-400/40 hover:bg-white/[0.04] hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 text-cyan-300 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
        <StatusBadge status={dataset.status} />
      </div>
      <div className="mt-3 font-mono text-sm font-semibold text-zinc-200 truncate group-hover:text-cyan-300 transition-colors">{dataset.name}</div>
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