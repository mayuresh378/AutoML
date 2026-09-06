import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutGrid, Table, Braces, BarChart3, PieChart, Network, ShieldCheck,
  BrainCircuit, GitBranch, History, Search, RefreshCw, Upload, Download,
  Database, ArrowLeft, Clock, FileSpreadsheet, SquareTerminal,
  Rows3, Columns3, Loader2, AlertTriangle, FileUp, X, ChevronRight,
  ChevronDown, AlertCircle, Copy, Gauge, Eye,
  type LucideIcon,
} from 'lucide-react';
import { datasetsService } from '../../../services/datasets.service';
import { PageContainer } from '../../../components/layout/PageContainer';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { cn } from '../../../lib/cn';
import {
  useExplorerDatasets, useExplorerAnalyze, useExplorerProfile, useExplorerPreview,
} from '../explorer/hooks';
import { fmt, severityHex, severityLabel, dtypeMeta, baseDatasetName, gradeColor, gradeTextCls, exportRowsToCsv, stripExtension } from '../explorer/utils';
import type { DatasetMeta, ExplorerTabId, DatasetAnalysisResult, DatasetProfile } from '../explorer/types';
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

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60';

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

  function handleExportPreview() {
    if (!pagePreview.data) return;
    exportRowsToCsv(pagePreview.data.rows, `${stripExtension(selectedDataset)}-preview.csv`);
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
    <PageContainer maxWidth="full" className="px-6 xl:px-8 py-8">
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
        onRefresh={() => {
          refetchDatasets();
          void analysis.refetch();
          void profile.refetch();
          void pagePreview.refetch();
        }}
        onExportDataset={handleExport}
        onExportPreview={handleExportPreview}
        canExportPreview={!!pagePreview.data?.rows?.length}
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
        <PageSkeleton />
      ) : datasetsError && !currentDataset ? (
        <ErrorState
          title="Unable to load datasets"
          message="We couldn't load your datasets right now. Check your connection and try again."
          onRetry={() => refetchDatasets()}
        />
      ) : !currentDataset ? (
        <ErrorState
          title="Dataset not found"
          message={`We couldn't find "${selectedDataset}". It may have been removed — pick another dataset from the library.`}
          onRetry={() => refetchDatasets()}
        />
      ) : (
        <>
          <DatasetSummaryBar
            dataset={currentDataset}
            datasets={datasets || []}
            analysis={analysis.data}
            analysisPending={!analysis.data && analysis.isFetching}
            onSelect={handleSelectDataset}
            onBack={() => handleSelectDataset('')}
          />

          <KpiGrid
            dataset={currentDataset}
            analysis={analysis.data}
            analysisPending={!analysis.data && analysis.isFetching}
            analysisError={analysis.isError && !analysis.data}
          />

          <ExplorerTabBar activeTab={activeTab} onSelect={(t) => setActiveTab(t)} />

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
            <main className="min-w-0">
              {blocked ? (
                <ErrorState
                  title={profileBlocked ? 'Profile unavailable' : 'Analysis unavailable'}
                  message="We couldn't load this dataset analysis right now. Check your connection and try again."
                  onRetry={profileBlocked ? profile.refetch : analysis.refetch}
                />
              ) : pending ? (
                <LoadingPanel rows={8} />
              ) : (
                renderTab()
              )}
            </main>

            <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
              <DataQualityCard
                analysis={analysis.data}
                loading={!analysis.data && analysis.isFetching}
                error={analysis.isError && !analysis.data}
                onRetry={analysis.refetch}
              />
              <ColumnSummaryCard
                dataset={currentDataset}
                profile={profile.data}
                analysis={analysis.data}
                loading={!profile.data && profile.isFetching}
                error={profile.isError && !profile.data}
                onRetry={profile.refetch}
                onInspect={setSelectedColumn}
              />
              <QuickActionsCard dataset={currentDataset} onQuickAction={(to) => navigate(to)} />
            </aside>
          </div>
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
  dataset, uploading, onUploadClick, onRefresh, onExportDataset, onExportPreview, canExportPreview, onOpenSQL,
}: {
  dataset: DatasetMeta | null;
  uploading: boolean;
  onUploadClick: () => void;
  onRefresh: () => void;
  onExportDataset: () => void;
  onExportPreview: () => void;
  canExportPreview: boolean;
  onOpenSQL: () => void;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-5 mb-8">
      <div>
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] text-zinc-500 mb-1.5">
          <span className="text-zinc-500">Data</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-zinc-400">Data Explorer</span>
          {dataset && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-blue-300 font-medium font-mono truncate max-w-[260px]">{dataset.name}</span>
            </>
          )}
        </nav>
        <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Data Explorer</h1>
        <p className="text-sm text-zinc-400 mt-1.5">
          {dataset
            ? `Inspecting ${dataset.rows?.toLocaleString() ?? '…'} rows across ${dataset.columns?.length ?? '…'} columns`
            : 'Explore, inspect and understand your dataset.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={onUploadClick}
          disabled={uploading}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:pointer-events-none',
            focusRing,
          )}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Upload Data'}
        </button>
        <button
          onClick={onRefresh}
          className={cn('inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:border-white/[0.16] transition-colors', focusRing)}
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>

        <details className="relative">
          <summary className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:border-white/[0.16] cursor-pointer list-none',
            focusRing,
          )}>
            <Download className="w-4 h-4" /> Export <ChevronDown className="w-3.5 h-3.5" />
          </summary>
          <div className="absolute right-0 top-full mt-1.5 w-64 rounded-lg border border-white/[0.10] bg-[#101014] shadow-lg z-40 p-1.5">
            <button
              onClick={onExportDataset}
              disabled={!dataset}
              className="w-full rounded-md px-3 py-2 text-left text-[13px] text-zinc-300 hover:bg-white/[0.05] disabled:opacity-40 disabled:pointer-events-none"
            >
              Download dataset file
            </button>
            <button
              onClick={onExportPreview}
              disabled={!canExportPreview}
              className="w-full rounded-md px-3 py-2 text-left text-[13px] text-zinc-300 hover:bg-white/[0.05] disabled:opacity-40 disabled:pointer-events-none"
            >
              Export first 50 rows (CSV)
            </button>
          </div>
        </details>

        <button
          onClick={onOpenSQL}
          className={cn('inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 hover:border-white/[0.16] transition-colors', focusRing)}
        >
          <SquareTerminal className="w-4 h-4" /> SQL Studio
        </button>
      </div>
    </header>
  );
}

/* ---------------------------- Dataset summary bar ---------------------------- */

function DatasetSummaryBar({
  dataset, datasets, analysis, analysisPending, onSelect, onBack,
}: {
  dataset: DatasetMeta;
  datasets: DatasetMeta[];
  analysis?: DatasetAnalysisResult | null;
  analysisPending: boolean;
  onSelect: (name: string) => void;
  onBack: () => void;
}) {
  const ext = (dataset.filename || dataset.name).match(/\.(\w+)$/)?.[1]?.toUpperCase() || 'DATA';
  const qs = analysis?.quality_score;
  return (
    <section aria-label="Dataset summary" className="mb-8 rounded-xl border border-white/[0.08] bg-card px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
        <button
          onClick={onBack}
          aria-label="Back to library"
          className={cn('w-9 h-9 rounded-lg border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-white/[0.16] transition-colors shrink-0', focusRing)}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-5 h-5" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-mono font-semibold text-lg text-zinc-100 truncate">{dataset.name}</h2>
            <StatusBadge status={dataset.status} />
            <span className="rounded-full bg-white/[0.05] border border-white/10 px-2 py-0.5 text-[10px] font-mono text-zinc-500">v{dataset.version ?? 1}</span>
            <span className="rounded-full bg-white/[0.05] border border-white/10 px-2 py-0.5 text-[10px] font-mono text-zinc-500">{ext}</span>
          </div>
          <div className="mt-2 flex items-center gap-x-2.5 gap-y-1 flex-wrap text-[13px] text-zinc-500">
            <span><span className="font-semibold text-zinc-300">{dataset.rows.toLocaleString()}</span> rows</span>
            <span aria-hidden="true" className="text-zinc-700">•</span>
            <span><span className="font-semibold text-zinc-300">{dataset.columns.length}</span> columns</span>
            <span aria-hidden="true" className="text-zinc-700">•</span>
            <span>{fmt.bytes(dataset.size_kb)}</span>
            <span aria-hidden="true" className="text-zinc-700">•</span>
            <span>Uploaded {fmt.date(dataset.uploaded_at)}</span>
            {dataset.source && (
              <>
                <span aria-hidden="true" className="text-zinc-700">•</span>
                <span className="capitalize">{dataset.source}</span>
              </>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {qs ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.08] px-3 py-1.5 text-[13px] font-mono">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: gradeColor(qs.grade) }} />
              <span style={{ color: gradeColor(qs.grade) }}>{Math.round(qs.total)}%</span>
              <span className="text-zinc-500">Quality · Grade {qs.grade}</span>
            </span>
          ) : analysisPending ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.08] px-3 py-1.5">
              <span className="w-16 h-3 rounded bg-white/[0.08] animate-pulse" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.08] px-3 py-1.5 text-[13px] text-zinc-600">
              Quality — 
            </span>
          )}
          <label className="inline-flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-zinc-600">Switch</span>
            <select
              value={dataset.name}
              onChange={(e) => onSelect(e.target.value)}
              aria-label="Switch dataset"
              className={cn('rounded-md bg-white/[0.04] border border-white/[0.08] px-2 py-1.5 text-[13px] font-medium text-zinc-200', focusRing)}
              style={{ colorScheme: 'dark' }}
            >
              {datasets.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- KPI grid ---------------------------- */

function KpiGrid({
  dataset, analysis, analysisPending, analysisError,
}: {
  dataset: DatasetMeta;
  analysis?: DatasetAnalysisResult | null;
  analysisPending: boolean;
  analysisError: boolean;
}) {
  const q = analysis;
  const pendingState = analysisPending && !analysisError;
  const missingSev = q?.missing?.severity;
  const dupSev = q?.duplicates?.severity;
  const outPct = q?.outliers?.mean_pct ?? 0;
  const outSev = outPct >= 8 ? 'high' : outPct >= 3 ? 'medium' : 'low';

  const skeleton = <div className="h-7 w-16 rounded bg-white/[0.06] animate-pulse" />;

  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 xl:gap-4 mb-8 items-stretch">
      <KpiCard tone="sky" icon={Rows3} label="Rows" value={dataset.rows.toLocaleString()} sub={`${fmt.num(dataset.rows)} records`} />
      <KpiCard tone="violet" icon={Columns3} label="Columns" value={dataset.columns.length.toLocaleString()} sub="features" />
      <KpiCard tone="zinc" icon={Database} label="Size" value={fmt.bytes(dataset.size_kb)} sub="file size" />
      <KpiCard
        tone="amber"
        icon={AlertCircle}
        label="Missing Values"
        value={q ? fmt.int(q.missing?.total_missing) : pendingState ? skeleton : '—'}
        sub={q ? <span><SevDot sev={missingSev} />{fmt.pct(q.missing?.missing_pct)} of cells</span> : undefined}
      />
      <KpiCard
        tone="amber"
        icon={Copy}
        label="Duplicates"
        value={q ? fmt.int(q.duplicates?.count) : pendingState ? skeleton : '—'}
        sub={q ? <span><SevDot sev={dupSev} />{fmt.pct(q.duplicates?.pct)} of rows</span> : undefined}
      />
      <KpiCard
        tone="orange"
        icon={Gauge}
        label="Outliers"
        value={q ? fmt.int(q.outliers?.total_outliers) : pendingState ? skeleton : '—'}
        sub={q ? <span><SevDot sev={outSev} />{fmt.pct(outPct)} avg per column</span> : undefined}
      />
      <KpiCard
        tone="emerald"
        icon={ShieldCheck}
        label="Quality Score"
        value={q?.quality_score ? (
          <span style={{ color: gradeColor(q.quality_score.grade) }}>{Math.round(q.quality_score.total)}%</span>
        ) : pendingState ? skeleton : '—'}
        sub={q?.quality_score ? <span className={gradeTextCls(q.quality_score.grade)}>Grade {q.quality_score.grade}</span> : undefined}
      />
    </section>
  );
}

type KpiTone = 'sky' | 'violet' | 'zinc' | 'amber' | 'orange' | 'emerald';

const kpiTones: Record<KpiTone, { chip: string; icon: string }> = {
  sky: { chip: 'bg-sky-500/10', icon: 'text-sky-400' },
  violet: { chip: 'bg-violet-500/10', icon: 'text-violet-400' },
  zinc: { chip: 'bg-white/[0.05]', icon: 'text-zinc-400' },
  amber: { chip: 'bg-amber-500/10', icon: 'text-amber-400' },
  orange: { chip: 'bg-orange-500/10', icon: 'text-orange-400' },
  emerald: { chip: 'bg-emerald-500/10', icon: 'text-emerald-400' },
};

function KpiCard({ icon: Icon, label, value, sub, tone = 'zinc' }: { icon: LucideIcon; label: string; value: ReactNode; sub?: ReactNode; tone?: KpiTone }) {
  const t = kpiTones[tone];
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/[0.06] bg-card px-4 py-4 transition-colors hover:border-white/[0.14] hover:bg-card-hover">
      <div className="flex items-center gap-2.5">
        <span className={cn('inline-flex w-8 h-8 items-center justify-center rounded-lg', t.chip)}>
          <Icon className={cn('w-4 h-4', t.icon)} />
        </span>
        <span className="text-xs font-medium text-zinc-500">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-zinc-100 tabular-nums tracking-tight leading-none">{value}</div>
      {sub && <div className="mt-2 text-xs text-zinc-600">{sub}</div>}
    </div>
  );
}

function SevDot({ sev }: { sev?: string }) {
  const hex = severityHex(sev || 'low');
  return <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ backgroundColor: hex, boxShadow: `0 0 4px ${hex}66` }} />;
}

/* ---------------------------- Tab bar ---------------------------- */

function ExplorerTabBar({ activeTab, onSelect }: { activeTab: ExplorerTabId; onSelect: (t: ExplorerTabId) => void }) {
  return (
    <nav aria-label="Analytics tabs" className="mb-8 -mx-1 overflow-x-auto">
      <div className="flex items-center gap-7 border-b border-white/[0.08] px-1 min-w-max">
        {PRIMARY_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-current={activeTab === t.id ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2.5 pb-3.5 -mb-px text-sm font-medium border-b-2 transition-colors',
              activeTab === t.id ? 'border-blue-400 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300',
              focusRing,
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
        <span className="w-px h-4 bg-white/[0.10]" />
        <span className="text-[11px] uppercase tracking-widest text-zinc-600">Advanced</span>
        {SECONDARY_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-current={activeTab === t.id ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 pb-3.5 -mb-px text-[13px] font-medium border-b-2 transition-colors',
              activeTab === t.id ? 'border-blue-400 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300',
              focusRing,
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>
    </nav>
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
  const outPct = analysis?.outliers?.mean_pct ?? 0;
  const outSev = outPct >= 8 ? 'high' : outPct >= 3 ? 'medium' : 'low';

  return (
    <section aria-label="Data quality" className="rounded-xl border border-white/[0.08] bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-100">Data Quality</h3>
        {qs && (
          <span className={cn('rounded-md bg-white/[0.04] px-2 py-0.5 text-xs font-mono font-semibold', gradeTextCls(qs.grade))}>
            {qs.grade}
          </span>
        )}
      </div>

      {error ? (
        <div className="py-6 text-center">
          <p className="text-sm text-zinc-500">Unable to load quality metrics.</p>
          <button onClick={onRetry} className={cn('mt-2 text-[13px] text-blue-300 hover:text-blue-200 underline underline-offset-2', focusRing)}>
            Retry
          </button>
        </div>
      ) : loading || !analysis ? (
        <div className="space-y-3 animate-pulse">
          <div className="flex justify-center py-2"><div className="w-28 h-28 rounded-full bg-white/[0.06]" /></div>
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-4 rounded bg-white/[0.06]" style={{ width: `${90 - i * 12}%` }} />)}
        </div>
      ) : qs ? (
        <>
          <div className="flex items-center gap-5">
            <QualityGauge
              score={qs.total}
              grade={qs.grade}
              size={128}
              stroke={11}
              centerNode={
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-bold tracking-tight" style={{ color: gradeColor(qs.grade) }}>{Math.round(qs.total)}</span>
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 mt-1">Score</span>
                  <span className="text-xs font-semibold mt-0.5" style={{ color: gradeColor(qs.grade) }}>{qs.grade}</span>
                </div>
              }
            />
            <div className="flex-1 min-w-0 space-y-2.5">
              <MetricRow sev={analysis.missing?.severity} label="Missing" value={`${fmt.int(analysis.missing?.total_missing)} · ${fmt.pct(analysis.missing?.missing_pct)}`} />
              <MetricRow sev={analysis.duplicates?.severity} label="Duplicates" value={`${fmt.int(analysis.duplicates?.count)} · ${fmt.pct(analysis.duplicates?.pct)}`} />
              <MetricRow sev={outSev} label="Outliers" value={`${fmt.int(analysis.outliers?.total_outliers)} · ${fmt.pct(outPct)} avg`} />
              <MetricRow
                sev={analysis.class_imbalance?.detected ? analysis.class_imbalance.severity : undefined}
                label="Class balance"
                value={analysis.class_imbalance?.detected ? severityLabel(analysis.class_imbalance.severity || '') : 'Balanced'}
              />
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/[0.06] space-y-2.5">
            {Object.entries(qs.components || {}).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2.5 text-xs">
                <span className="w-28 truncate text-zinc-500 capitalize">{k.replace(/_/g, ' ')}</span>
                <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', v >= 90 ? 'bg-emerald-400' : v >= 75 ? 'bg-teal-400' : v >= 65 ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ width: `${Math.min(100, Math.max(0, v))}%` }}
                  />
                </div>
                <span className="font-mono text-zinc-400 w-9 text-right">{Math.round(v)}</span>
              </div>
            ))}
          </div>

          {analysis.class_imbalance?.detected && (
            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="min-w-0">Class imbalance on “{analysis.class_imbalance.target}”</span>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

function MetricRow({ sev, label, value }: { sev?: string; label: string; value: string }) {
  const hex = severityHex(sev || 'low');
  return (
    <div className="flex items-center justify-between gap-2 text-[13px]">
      <span className="inline-flex items-center gap-1.5 text-zinc-400 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
        <span className="truncate">{label}</span>
      </span>
      <span className="font-mono text-zinc-300 shrink-0">{value}</span>
    </div>
  );
}

function ColumnSummaryCard({
  dataset, profile, analysis, loading, error, onRetry, onInspect,
}: {
  dataset: DatasetMeta;
  profile?: DatasetProfile | null;
  analysis?: DatasetAnalysisResult | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onInspect: (col: string) => void;
}) {
  const [colSel, setColSel] = useState('');
  const cols = dataset.columns || [];
  const cp = colSel ? profile?.column_details?.find((d) => d.name === colSel) : undefined;
  const hist = colSel ? analysis?.distributions?.columns?.find((h) => h.column === colSel) : undefined;
  const dt = cp ? dtypeMeta(cp.dtype ?? profile?.dtypes?.[colSel], colSel) : undefined;
  const topValues = cp?.top_values ? Object.entries(cp.top_values).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
  const maxTop = Math.max(1, ...topValues.map(([, c]) => c));
  const numeric = dt?.kind === 'numeric' && cp?.mean != null;

  return (
    <section aria-label="Column summary" className="rounded-xl border border-white/[0.08] bg-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-zinc-100">Column Summary</h3>
        <select
          value={colSel}
          onChange={(e) => setColSel(e.target.value)}
          aria-label="Select a column"
          className={cn('rounded-md bg-white/[0.04] border border-white/[0.08] px-2 py-1.5 text-[13px] text-zinc-200 max-w-[180px]', focusRing)}
          style={{ colorScheme: 'dark' }}
        >
          <option value="">Select a column…</option>
          {cols.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {error ? (
        <div className="py-6 text-center">
          <p className="text-sm text-zinc-500">Unable to load column statistics.</p>
          <button onClick={onRetry} className={cn('mt-2 text-[13px] text-blue-300 hover:text-blue-200 underline underline-offset-2', focusRing)}>
            Retry
          </button>
        </div>
      ) : !colSel ? (
        <div className="py-6 text-center">
          <Columns3 className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">Select a column to view detailed statistics.</p>
        </div>
      ) : loading || !profile ? (
        <div className="space-y-3 animate-pulse">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-4 rounded bg-white/[0.06]" style={{ width: `${90 - i * 10}%` }} />)}
        </div>
      ) : cp && dt ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', dt.cls)}>
              <dt.Icon className="w-3 h-3" style={{ color: dt.hex }} /> {dt.label}
            </span>
            <span className="rounded-full bg-white/[0.05] border border-white/10 px-2 py-0.5 text-[11px] font-mono text-zinc-500">{fmt.int(cp.unique_values)} unique</span>
            <span className="rounded-full bg-white/[0.05] border border-white/10 px-2 py-0.5 text-[11px] font-mono text-zinc-500">{fmt.int(cp.missing)} missing</span>
          </div>

          {topValues.length > 0 && (
            <div className="mt-4 space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-zinc-600">Top values</span>
              {topValues.map(([k, c]) => (
                <div key={k} className="flex items-center gap-2.5">
                  <span className="flex-1 truncate font-mono text-xs text-zinc-400">{String(k)}</span>
                  <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-violet-400/70" style={{ width: `${(c / maxTop) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs text-zinc-500 w-10 text-right">{fmt.num(c)}</span>
                </div>
              ))}
            </div>
          )}

          {numeric && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Stat label="Mean" value={fmt.dec(cp.mean)} />
              <Stat label="Median" value={fmt.dec(cp.median)} />
              <Stat label="Min" value={fmt.dec(cp.min)} />
              <Stat label="Max" value={fmt.dec(cp.max)} />
              <Stat label="Std dev" value={fmt.dec(cp.std)} />
              <Stat label="Range" value={fmt.dec((cp.max ?? 0) - (cp.min ?? 0))} />
            </div>
          )}

          {hist?.bins?.length ? (
            <div className="mt-4">
              <span className="text-[11px] uppercase tracking-wider text-zinc-600">Distribution</span>
              <div className="flex items-end gap-[2px] h-14 mt-2" aria-hidden="true">
                {hist.bins.slice(0, 24).map((b, i) => {
                  const max = Math.max(1, ...hist.bins);
                  const step = Math.max(1, Math.round(hist.bins.length / 24));
                  const show = i % step === 0;
                  return show ? (
                    <span key={i} className="flex-1 rounded-sm bg-blue-400/60"
                      style={{ height: `${Math.max(10, (b / max) * 100)}%`, opacity: 0.35 + 0.65 * (b / max) }} />
                  ) : null;
                })}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => onInspect(colSel)}
            className={cn('mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[13px] font-medium text-zinc-300 hover:text-zinc-100 hover:border-white/[0.16] transition-colors', focusRing)}
          >
            <Eye className="w-4 h-4" /> Inspect “{colSel}”
          </button>
        </>
      ) : (
        <p className="py-6 text-center text-sm text-zinc-500">No statistics available for this column.</p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</div>
      <div className="font-mono text-[13px] text-zinc-200 mt-0.5">{value}</div>
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
    <section aria-label="Quick actions" className="rounded-xl border border-white/[0.08] bg-card p-5">
      <h3 className="text-sm font-semibold text-zinc-100 mb-4">Quick Actions</h3>
      <nav className="space-y-1">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => onQuickAction(a.to)}
            className={cn('w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] text-zinc-300 hover:bg-white/[0.03] hover:text-zinc-100 transition-colors', focusRing)}
          >
            {a.label}
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </button>
        ))}
      </nav>
    </section>
  );
}

/* ---------------------------- Loading / skeleton ---------------------------- */

function LoadingPanel({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-card p-6 space-y-4 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-white/[0.06]" style={{ width: `${100 - (i % 4) * 15}%` }} />
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-4 w-64 rounded bg-white/[0.06]" />
        <div className="h-7 w-48 rounded bg-white/[0.07]" />
        <div className="h-4 w-80 rounded bg-white/[0.05]" />
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-card px-5 py-4">
        <div className="h-5 w-2/3 rounded bg-white/[0.06]" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-24 rounded-xl border border-white/[0.08] bg-card" />)}
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-card p-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-4 rounded bg-white/[0.05]" style={{ width: `${100 - (i % 4) * 18}%` }} />
        ))}
      </div>
    </div>
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
    <div className="rounded-xl border border-white/[0.08] bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.08] flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search datasets, tags, descriptions…"
            aria-label="Search datasets"
            className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] pl-9 pr-8 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-400/50 focus:ring-2 focus:ring-blue-400/20"
          />
          {query && (
            <button onClick={() => onQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[13px] text-zinc-500">
          <Database className="w-4 h-4" />
          <span className="font-medium text-zinc-300">{datasets.length}</span> datasets
        </div>
        <button onClick={onUpload} className={cn('inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/[0.12] px-3 py-1.5 text-[13px] font-medium text-zinc-400 hover:border-white/[0.24] hover:text-zinc-200 transition-colors', focusRing)}>
          <FileUp className="w-3.5 h-3.5" /> Upload new
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl border border-white/[0.08] bg-white/[0.01] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-zinc-400">Unable to load datasets. We couldn't reach the backend — try again.</p>
          <button onClick={onRetry} className={cn('mt-3 text-[13px] text-blue-300 hover:text-blue-200 underline underline-offset-2', focusRing)}>
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Database className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">{datasets.length === 0 ? 'No datasets yet. Upload your first dataset to get started.' : 'No datasets match your search.'}</p>
          {datasets.length === 0 && (
            <button onClick={onUpload} className={cn('mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 transition-colors', focusRing)}>
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
      type="button"
      onClick={onOpen}
      className={cn('group rounded-xl border border-white/[0.08] bg-white/[0.01] p-5 text-left transition-colors hover:border-white/[0.20] hover:bg-white/[0.03]', focusRing)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
        <StatusBadge status={dataset.status} />
      </div>
      <div className="mt-3 font-mono text-sm font-semibold text-zinc-200 truncate group-hover:text-blue-300 transition-colors">{dataset.name}</div>
      <p className="text-[13px] text-zinc-500 mt-1 line-clamp-2">{dataset.description || `Dataset ${baseDatasetName(dataset.name)}`}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1"><Rows3 className="w-3.5 h-3.5" /> {dataset.rows.toLocaleString()} rows</span>
        <span className="inline-flex items-center gap-1"><Columns3 className="w-3.5 h-3.5" /> {dataset.columns.length} cols</span>
        <span className="inline-flex items-center gap-1"><Database className="w-3.5 h-3.5" /> {fmt.bytes(dataset.size_kb)}</span>
      </div>
      <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px] text-zinc-600">
        <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {fmt.date(dataset.uploaded_at)}</span>
        <span className="inline-flex items-center gap-1">v{dataset.version ?? 1} · {dataset.source || 'upload'}</span>
      </div>
      {kinds.size > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {Array.from(kinds).slice(0, 4).map((k) => (
            <span key={k} className="rounded-full bg-white/[0.04] border border-white/10 px-1.5 py-px text-[10px] text-zinc-500">{k}</span>
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
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', map[status] || 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20')}>
      {status}
    </span>
  );
}