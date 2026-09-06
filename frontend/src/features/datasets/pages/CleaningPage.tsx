import { useMemo, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, Eraser, AlertTriangle, CheckCircle2, RotateCcw, FileText, Download,
  Search, ArrowUpDown, ChevronLeft, ChevronRight, Database, Rows3, Columns3,
  HardDrive, ArrowRight, Circle, Clock, XCircle, History, GitBranch,
  FolderDown, Loader2, AlertCircle,
} from 'lucide-react';
import { datasetsService } from '../../../services/datasets.service';
import { baseDatasetName } from '../explorer/utils';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { DatasetSelect } from '../../../components/ui/DatasetSelect';
import { Badge } from '../../../components/ui/Badge';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { useNotification } from '../../../hooks/useNotification';
import { getErrorMessage, downloadUrl } from '../../../services/http';

const PIPELINE_CONFIG = [
  { key: 'loaded', label: 'Dataset Loaded', icon: Database },
  { key: 'missing', label: 'Missing Values', icon: AlertTriangle },
  { key: 'duplicates', label: 'Remove Duplicates', icon: Rows3 },
  { key: 'outliers', label: 'Outlier Detection', icon: AlertTriangle },
  { key: 'encoding', label: 'Encoding', icon: Eraser },
  { key: 'scaling', label: 'Scaling', icon: ArrowUpDown },
  { key: 'export', label: 'Export Cleaned Dataset', icon: FolderDown },
] as const;

type StageKey = (typeof PIPELINE_CONFIG)[number]['key'];

const RUNNING_TEXT: Record<string, string> = {
  missing: 'Imputing missing values…',
  duplicates: 'Removing duplicates…',
  outliers: 'Detecting outliers…',
  encoding: 'Encoding categories…',
  scaling: 'Scaling features…',
  export: 'Exporting cleaned dataset…',
};

function formatBytes(kb?: number) {
  if (kb == null || Number.isNaN(kb)) return '—';
  if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB';
  return Math.max(kb, 0.1).toFixed(0) + ' KB';
}

function qualityColor(pct: number) {
  if (pct >= 80) return 'text-emerald-400';
  if (pct >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function qualityGradeColor(grade: string) {
  switch (grade?.toUpperCase()) {
    case 'A': return 'text-emerald-400';
    case 'B': return 'text-blue-400';
    case 'C': return 'text-amber-400';
    default: return 'text-red-400';
  }
}

function severityVariant(s: string) {
  if (s === 'low') return 'success' as const;
  if (s === 'medium') return 'warning' as const;
  if (s === 'high') return 'error' as const;
  return 'default' as const;
}

interface StageStatus {
  code: 'completed' | 'running' | 'no_issues' | 'skipped' | 'failed' | 'issues' | 'pending' | 'ready';
  label: string;
  cls: string;
  badge: string;
  icon: React.ReactNode;
}

function resolveStage(
  key: StageKey,
  step?: { status: string },
  hasIssues: Record<string, boolean> = {},
  available: Record<string, boolean> = {},
  nRows = 0,
): StageStatus {
  const base = {
    completed: { code: 'completed' as const, label: 'Completed', cls: 'text-emerald-400', badge: 'success', icon: <CheckCircle2 className="w-4 h-4" /> },
    running: { code: 'running' as const, label: 'In progress', cls: 'text-blue-400 animate-pulse', badge: 'info', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
    no_issues: { code: 'no_issues' as const, label: 'No Issues', cls: 'text-emerald-400', badge: 'success', icon: <CheckCircle2 className="w-4 h-4" /> },
    skipped: { code: 'skipped' as const, label: 'Skipped', cls: 'text-zinc-500', badge: 'default', icon: <Circle className="w-4 h-4" /> },
    failed: { code: 'failed' as const, label: 'Failed', cls: 'text-red-400', badge: 'error', icon: <XCircle className="w-4 h-4" /> },
    issues: { code: 'issues' as const, label: 'Issues detected', cls: 'text-amber-400', badge: 'warning', icon: <AlertTriangle className="w-4 h-4" /> },
    pending: { code: 'pending' as const, label: 'Pending', cls: 'text-zinc-600', badge: 'default', icon: <Clock className="w-4 h-4" /> },
    ready: { code: 'ready' as const, label: 'Ready', cls: 'text-zinc-400', badge: 'default', icon: <Circle className="w-4 h-4" /> },
  };
  if (key === 'loaded') return base.completed;
  if (step?.status) {
    const mapped = step.status === 'no_issues' ? base.no_issues
      : step.status === 'skipped' ? base.skipped
      : step.status === 'failed' ? base.failed
      : step.status === 'running' ? base.running
      : base.completed;
    return mapped;
  }
  if (key === 'export') return base.ready;
  if (key === 'missing' || key === 'duplicates' || key === 'outliers') {
    if (nRows === 0) return base.pending;
    return hasIssues[key] ? base.issues : base.no_issues;
  }
  // encoding / scaling are optional transformations
  return available[key] ? base.ready : base.skipped;
}

export default function CleaningPage() {
  const { notifySuccess, notifyError } = useNotification();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedDataset, setSelectedDataset] = useState(searchParams.get('dataset') ?? '');
  const [result, setResult] = useState<any>(null);
  const [activeStep, setActiveStep] = useState<StageKey>('loaded');
  const [runningStage, setRunningStage] = useState<StageKey | null>(null);
  const [runningText, setRunningText] = useState('');
  const [stageError, setStageError] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewSearch, setPreviewSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const previewPageSize = 20;

  // ── Per-stage configuration ──
  const [missingMethod, setMissingMethod] = useState('median');
  const [missingCols, setMissingCols] = useState<string[]>([]);
  const [dupKeep, setDupKeep] = useState('first');
  const [outlierMethod, setOutlierMethod] = useState('iqr');
  const [outlierAction, setOutlierAction] = useState('cap');
  const [outlierThreshold, setOutlierThreshold] = useState('3');
  const [outlierCols, setOutlierCols] = useState<string[]>([]);
  const [encMethod, setEncMethod] = useState('one_hot');
  const [encCols, setEncCols] = useState<string[]>([]);
  const [encTarget, setEncTarget] = useState('');
  const [encTargetToo, setEncTargetToo] = useState(false);
  const [scaleMethod, setScaleMethod] = useState('standard');
  const [scaleCols, setScaleCols] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState('csv');

  const { data: datasets, isLoading, isError, error } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
    select: (d: any) => d.datasets,
  });

  const selectedDs = useMemo(
    () => (datasets || []).find((d: any) => d.name === selectedDataset) ?? null,
    [datasets, selectedDataset],
  );

  const { data: state, isLoading: stateLoading, isError: stateError } = useQuery({
    queryKey: ['cleaning-state', selectedDataset],
    queryFn: () => datasetsService.cleaningState(selectedDataset),
    enabled: !!selectedDataset,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['cleaning-history', selectedDataset],
    queryFn: () => datasetsService.cleaningHistory(selectedDataset),
    enabled: !!selectedDataset,
  });

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['dataset-preview', selectedDataset],
    queryFn: () => datasetsService.preview(selectedDataset, 200, 0),
    enabled: !!selectedDataset,
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['dataset-analysis', selectedDataset],
    queryFn: () => datasetsService.analyze(selectedDataset),
    enabled: !!selectedDataset,
  });

  const det = state?.detections;
  const steps = state?.steps ?? {};
  const hasIssues = state?.has_issues ?? {};
  const available = state?.available ?? {};

  const missingColumns = useMemo(() => {
    const cols = (det?.missing?.columns ?? []) as any[];
    return cols.filter((c: any) => (c.missing ?? 0) > 0);
  }, [det]);

  const outlierColumns = useMemo(() => {
    const cols = (det?.outliers?.columns ?? []) as any[];
    return cols.filter((c: any) => (c.outliers_iqr ?? 0) > 0).map((c: any) => c.name);
  }, [det]);

  const encCandidates = useMemo(() => ((det?.encoding?.columns ?? []) as any[]).map((c: any) => c.name), [det]);

  const scaleCandidates = useMemo(
    () => ((det?.scaling?.columns ?? []) as any[]).filter((c: any) => !c.constant).map((c: any) => c.name),
    [det],
  );

  const filteredRows = useMemo(() => {
    if (!preview?.rows) return [];
    let rows = preview.rows;
    if (previewSearch) {
      const q = previewSearch.toLowerCase();
      rows = rows.filter((r: Record<string, any>) =>
        Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)),
      );
    }
    if (sortCol) {
      rows = [...rows].sort((a: Record<string, any>, b: Record<string, any>) => {
        const av = a[sortCol], bv = b[sortCol];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
        return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      });
    }
    return rows;
  }, [preview, previewSearch, sortCol, sortDir]);

  const totalPages = Math.ceil(filteredRows.length / previewPageSize);
  const pagedRows = filteredRows.slice(previewPage * previewPageSize, (previewPage + 1) * previewPageSize);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['cleaning-state', selectedDataset] });
    queryClient.invalidateQueries({ queryKey: ['cleaning-history', selectedDataset] });
    queryClient.invalidateQueries({ queryKey: ['datasets'] });
  }, [queryClient, selectedDataset]);

  const selectDataset = useCallback((name: string) => {
    setSelectedDataset(name);
    setResult(null);
    setStageError(null);
    setActiveStep('loaded');
    setPreviewPage(0);
    setSortCol(null);
    setPreviewSearch('');
  }, []);

  const runStep = useCallback(async (stage: StageKey, payload: { method?: string; columns?: string[]; params?: Record<string, any>; action?: string }) => {
    if (!selectedDataset) return;
    setRunningStage(stage);
    setStageError(null);
    setResult(null);
    setRunningText(RUNNING_TEXT[stage] ?? 'Working…');
    try {
      const res = await datasetsService.applyCleaningStage(selectedDataset, { stage, ...payload });
      setResult(res);
      setRunningStage(null);
      if (res.new_version) {
        const newName = res.new_version.name;
        selectDataset(newName);
        notifySuccess(`${PIPELINE_CONFIG.find((s) => s.key === stage)?.label} completed → saved as ${newName}`);
      } else {
        setActiveStep(stage);
        notifySuccess(
          res.step.status === 'no_issues' ? 'No issues found for this step' : `${PIPELINE_CONFIG.find((s) => s.key === stage)?.label} completed`,
        );
        refresh();
      }
      return res;
    } catch (err) {
      setRunningStage(null);
      const msg = getErrorMessage(err);
      setStageError(msg);
      notifyError('Cleaning failed', msg);
      refresh();
      return null;
    }
  }, [selectedDataset, notifySuccess, notifyError, selectDataset, refresh]);

  const runMissing = () => runStep('missing', { method: missingMethod, columns: missingCols });
  const runDuplicates = () => runStep('duplicates', { method: dupKeep });
  const runOutliers = () => runStep('outliers', {
    method: outlierMethod,
    columns: outlierCols,
    params: { action: outlierAction, threshold: Number(outlierThreshold) },
  });
  const runEncoding = () => runStep('encoding', {
    method: encMethod,
    columns: encCols,
    params: encTarget ? { target: encTarget, encode_target: encTargetToo } : undefined,
  });
  const runScaling = () => runStep('scaling', { method: scaleMethod, columns: scaleCols });

  const runExport = async () => {
    if (!selectedDataset) return;
    setRunningStage('export');
    setStageError(null);
    setRunningText('Exporting cleaned dataset…');
    try {
      const res = await datasetsService.exportDataset(selectedDataset, exportFormat);
      setResult({ export: res });
      setRunningStage(null);
      await queryClient.invalidateQueries({ queryKey: ['cleaning-state', selectedDataset] });
      await queryClient.invalidateQueries({ queryKey: ['cleaning-history', selectedDataset] });
      notifySuccess(`Exported ${res.filename}`);
    } catch (err) {
      setRunningStage(null);
      const msg = getErrorMessage(err);
      setStageError(msg);
      notifyError('Export failed', msg);
    }
  };

  const runAutoClean = async () => {
    if (!selectedDataset || state?.detections == null) return;
    try {
      notifySuccess('Auto-clean started');
      const chain: { stage: StageKey; payload: any }[] = [];
      const detections = state.detections;
      const missCols: string[] = [];
      for (const c of detections.missing?.columns ?? []) if (c.missing > 0) missCols.push(c.name);
      if (detections.missing?.total > 0) chain.push({ stage: 'missing', payload: { method: 'median', columns: missCols } });
      if ((detections.duplicates?.count ?? 0) > 0) chain.push({ stage: 'duplicates', payload: { method: 'first' } });
      const outCols = (detections.outliers?.columns ?? []).filter((c: any) => c.outliers_iqr > 0).map((c: any) => c.name);
      if (outCols.length) chain.push({ stage: 'outliers', payload: { method: 'iqr', columns: outCols, params: { action: 'cap', threshold: 3 } } });
      const hotCols = (detections.encoding?.columns ?? []).filter((c: any) => c.recommended === 'one_hot').map((c: any) => c.name);
      if (hotCols.length) chain.push({ stage: 'encoding', payload: { method: 'one_hot', columns: hotCols } });
      for (const step of chain) {
        const res = await runStep(step.stage, step.payload);
        if (!res) return; // stop on first failure
      }
      notifySuccess('Auto-clean pipeline completed');
    } catch (err) {
      notifyError('Auto-clean failed', getErrorMessage(err));
    }
  };

  const toggleCol = (col: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(col) ? list.filter((c) => c !== col) : [...list, col]);
  };

  const renderStagePanel = () => {
    if (!selectedDataset) return null;
    return (
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const s = resolveStage(activeStep, steps[activeStep], hasIssues, available, state?.dataset?.rows ?? 0);
                return <span className={`${s.cls}`}>{s.icon}</span>;
              })()}
              {PIPELINE_CONFIG.find((s) => s.key === activeStep)?.label}
            </CardTitle>
            {activeStep !== 'loaded' && steps[activeStep] && (
              <Badge variant={resolveStage(activeStep, steps[activeStep], hasIssues, available, 1).badge as any} size="sm">
                {resolveStage(activeStep, steps[activeStep], hasIssues, available, 1).label}
              </Badge>
            )}
          </div>
          {runningStage === activeStep && (
            <div className="flex items-center gap-2 text-sm text-blue-400 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              {runningText}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {stageError && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-sm text-red-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {stageError}
            </div>
          )}

          {activeStep === 'loaded' && (
            <div className="text-sm text-zinc-400">
              {state ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-white/5 border border-white/5 p-3">
                    <p className="text-xs text-zinc-500">Rows (this version)</p>
                    <p className="text-lg font-semibold text-zinc-200 mt-1">{(state.dataset.rows ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/5 p-3">
                    <p className="text-xs text-zinc-500">Columns</p>
                    <p className="text-lg font-semibold text-zinc-200 mt-1">{state.dataset.columns.length}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/5 p-3">
                    <p className="text-xs text-zinc-500">Current version</p>
                    <p className="text-lg font-semibold text-zinc-200 mt-1">v{state.current_version}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/5 p-3">
                    <p className="text-xs text-zinc-500">Base dataset</p>
                    <p className="text-sm font-semibold text-zinc-200 mt-1.5 truncate">{state.base_key}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2"><LoadingSpinner /> <span>Analyzing dataset…</span></div>
              )}
            </div>
          )}

          {activeStep === 'missing' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 mb-2">Detected missing values ({missingColumns.length} columns, {det?.missing?.total ?? 0} cells)</p>
                {missingColumns.length === 0 ? (
                  <p className="text-sm text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> No missing values found</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {missingColumns.map((c: any) => (
                      <button key={c.name} onClick={() => toggleCol(c.name, missingCols, setMissingCols)}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                          missingCols.includes(c.name) ? 'bg-blue-500/15 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/25'
                        }`}>
                        {c.name} · {c.missing} ({c.kind})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <Select label="Impute strategy" value={missingMethod} onChange={(e) => setMissingMethod(e.target.value)}
                  options={[
                    { value: 'mean', label: 'Mean (numeric)' },
                    { value: 'median', label: 'Median (numeric)' },
                    { value: 'mode', label: 'Most frequent (mode)' },
                    { value: 'zero', label: 'Zero' },
                    { value: 'ffill', label: 'Forward fill' },
                    { value: 'bfill', label: 'Backward fill' },
                    { value: 'constant', label: 'Constant value…' },
                    { value: 'unknown', label: 'Replace with "unknown"' },
                  ]} />
                <div />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="primary" icon={<Eraser className="w-4 h-4" />} onClick={runMissing} loading={runningStage === 'missing'} disabled={missingColumns.length === 0}>
                  Apply to {missingCols.length ? `${missingCols.length} selected` : 'all affected'} column{missingCols.length === 1 ? '' : 's'}
                </Button>
                <Button size="sm" variant="ghost" icon={<Circle className="w-4 h-4" />} onClick={() => runStep('missing', { action: 'skip' })} disabled={runningStage === 'missing'}>
                  Skip this step
                </Button>
              </div>
              <p className="text-xs text-zinc-600">When no column is selected, all columns with missing values are imputed. Every applied change creates a new dataset version.</p>
            </div>
          )}

          {activeStep === 'duplicates' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                {det?.duplicates?.count ? (
                  <span className="text-amber-400">{det.duplicates.count} duplicate row{det.duplicates.count === 1 ? '' : 's'} detected ({det.duplicates.pct?.toFixed(2)}%)</span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> No duplicate rows detected</span>
                )}
              </p>
              {det?.duplicates?.sample?.length ? (
                <>
                  <p className="text-xs text-zinc-500">Duplicate sample ({det.duplicates.sample_columns?.slice(0, 4).join(', ')}{det.duplicates.sample_columns?.length > 4 ? '…' : ''})</p>
                  <div className="grid grid-cols-2 gap-2">
                    {det.duplicates.sample.slice(0, 2).map((r: Record<string, any>, i: number) => (
                      <div key={i} className="text-xs text-zinc-400 bg-white/5 border border-white/5 rounded-lg px-2 py-1.5">
                        {Object.entries(r).slice(0, 4).map(([k, v]) => (
                          <p key={k} className="truncate"><span className="text-zinc-600">{k}:</span> {String(v)}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
              <div className="max-w-xs">
                <Select label="Keep which row?" value={dupKeep} onChange={(e) => setDupKeep(e.target.value)}
                  options={[
                    { value: 'first', label: 'Keep first occurrence' },
                    { value: 'last', label: 'Keep last occurrence' },
                  ]} />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="primary" icon={<Rows3 className="w-4 h-4" />} onClick={runDuplicates} loading={runningStage === 'duplicates'} disabled={!det?.duplicates?.count}>
                  Remove duplicates
                </Button>
                <Button size="sm" variant="ghost" icon={<Circle className="w-4 h-4" />} onClick={() => runStep('duplicates', { action: 'skip' })} disabled={runningStage === 'duplicates'}>
                  Skip this step
                </Button>
              </div>
            </div>
          )}

          {activeStep === 'outliers' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 mb-2">Columns with outliers</p>
                {outlierColumns.length === 0 ? (
                  <p className="text-sm text-emerald-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> No outliers detected (IQR method)</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {outlierColumns.map((col) => (
                      <button key={col} onClick={() => toggleCol(col, outlierCols, setOutlierCols)}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                          outlierCols.includes(col) ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/25'
                        }`}>
                        {col}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg">
                <Select label="Detection method" value={outlierMethod} onChange={(e) => setOutlierMethod(e.target.value)}
                  options={[
                    { value: 'iqr', label: 'IQR (1.5 × IQR)' },
                    { value: 'zscore', label: 'Z-score' },
                  ]} />
                <Select label="Action" value={outlierAction} onChange={(e) => setOutlierAction(e.target.value)}
                  options={[
                    { value: 'cap', label: 'Cap at bounds' },
                    { value: 'median', label: 'Replace with median' },
                    { value: 'remove', label: 'Remove rows' },
                    { value: 'keep', label: 'Keep (report only)' },
                  ]} />
                {outlierMethod === 'zscore' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">Z threshold</label>
                    <input value={outlierThreshold} onChange={(e) => setOutlierThreshold(e.target.value)}
                      className="w-full rounded bg-card border border-border px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="primary" icon={<AlertTriangle className="w-4 h-4" />} onClick={runOutliers} loading={runningStage === 'outliers'}>
                  {outlierAction === 'keep' ? 'Run detection' : `Apply (${outlierAction})`}
                </Button>
                <Button size="sm" variant="ghost" icon={<Circle className="w-4 h-4" />} onClick={() => runStep('outliers', { action: 'skip' })} disabled={runningStage === 'outliers'}>
                  Skip this step
                </Button>
              </div>
            </div>
          )}

          {activeStep === 'encoding' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 mb-2">Select categorical columns to encode</p>
                {encCandidates.length === 0 ? (
                  <p className="text-sm text-zinc-400">No categorical columns available to encode.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {encCandidates.map((col) => (
                      <button key={col} onClick={() => toggleCol(col, encCols, setEncCols)}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                          encCols.includes(col) ? 'bg-purple-500/15 border-purple-500/40 text-purple-300' : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/25'
                        }`}>
                        {col}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg">
                <Select label="Method" value={encMethod} onChange={(e) => setEncMethod(e.target.value)}
                  options={[
                    { value: 'one_hot', label: 'One-hot encoding' },
                    { value: 'label', label: 'Label encoding' },
                    { value: 'ordinal', label: 'Ordinal encoding' },
                  ]} />
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Target column (preserve)</label>
                  <select value={encTarget} onChange={(e) => setEncTarget(e.target.value)}
                    className="w-full rounded bg-card border border-border px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none">
                    <option value="">None</option>
                    {(state?.dataset?.columns ?? []).map((c: string) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {encTarget && (
                  <label className="flex items-center gap-2 text-sm text-zinc-400 mt-5 cursor-pointer">
                    <input type="checkbox" checked={encTargetToo} onChange={(e) => setEncTargetToo(e.target.checked)} className="accent-blue-500" />
                    Encode target too
                  </label>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="primary" icon={<Eraser className="w-4 h-4" />} onClick={runEncoding} loading={runningStage === 'encoding'} disabled={encCols.length === 0}>
                  Apply encoding ({encCols.length} column{encCols.length === 1 ? '' : 's'})
                </Button>
                <Button size="sm" variant="ghost" icon={<Circle className="w-4 h-4" />} onClick={() => runStep('encoding', { action: 'skip' })} disabled={runningStage === 'encoding'}>
                  Skip this step
                </Button>
              </div>
            </div>
          )}

          {activeStep === 'scaling' && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 mb-2">Select numeric columns to scale</p>
                {scaleCandidates.length === 0 ? (
                  <p className="text-sm text-zinc-400">No non-constant numeric columns available.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {scaleCandidates.map((col) => (
                      <button key={col} onClick={() => toggleCol(col, scaleCols, setScaleCols)}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                          scaleCols.includes(col) ? 'bg-sky-500/15 border-sky-500/40 text-sky-300' : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/25'
                        }`}>
                        {col}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="max-w-xs">
                <Select label="Scaler" value={scaleMethod} onChange={(e) => setScaleMethod(e.target.value)}
                  options={[
                    { value: 'standard', label: 'StandardScaler (z-score)' },
                    { value: 'minmax', label: 'MinMaxScaler (0–1)' },
                    { value: 'robust', label: 'RobustScaler (median/IQR)' },
                  ]} />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="primary" icon={<ArrowUpDown className="w-4 h-4" />} onClick={runScaling} loading={runningStage === 'scaling'} disabled={scaleCols.length === 0}>
                  Apply scaling ({scaleCols.length} column{scaleCols.length === 1 ? '' : 's'})
                </Button>
                <Button size="sm" variant="ghost" icon={<Circle className="w-4 h-4" />} onClick={() => runStep('scaling', { action: 'skip' })} disabled={runningStage === 'scaling'}>
                  Skip this step
                </Button>
              </div>
            </div>
          )}

          {activeStep === 'export' && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Export the current version <span className="text-blue-400 truncate">{selectedDataset}</span> as a downloadable dataset file.
              </p>
              <div className="max-w-xs">
                <Select label="Format" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}
                  options={[
                    { value: 'csv', label: 'CSV (.csv)' },
                    { value: 'xlsx', label: 'Excel (.xlsx)' },
                    { value: 'parquet', label: 'Parquet (.parquet)' },
                  ]} />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="premium" icon={<Download className="w-4 h-4" />} onClick={runExport} loading={runningStage === 'export'}>
                  Export & register dataset
                </Button>
              </div>
              {result?.export && (
                <div className="flex items-center gap-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div className="text-sm">
                    <p className="text-zinc-200">{result.export.filename}</p>
                    <p className="text-xs text-zinc-500">{result.export.rows} rows · {result.export.columns.length} cols · {formatBytes(result.export.size_kb)}</p>
                  </div>
                  <a href={downloadUrl(result.export.download_url)} className="ml-auto text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1">
                    <Download className="w-4 h-4" /> Download
                  </a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Data Cleaning</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Clean and prepare your datasets — every step is applied for real and versioned</p>
        </div>
        <div className="flex items-center gap-2">
          {state && (
            <span className="text-xs text-zinc-500">
              {state.active_version && <a href={downloadUrl(`/datasets/${encodeURIComponent(state.active_version)}/download`)} className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> {state.active_version}
              </a>}
            </span>
          )}
          <Button variant="secondary" size="sm" icon={<Sparkles className="w-4 h-4" />} onClick={runAutoClean} disabled={!selectedDataset || !state}>
            Auto-Clean
          </Button>
          {result && (
            <Button variant="ghost" size="sm" icon={<RotateCcw className="w-4 h-4" />} onClick={() => setResult(null)}>
              Clear Results
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4" style={{ minHeight: 'calc(100vh - 180px)' }}>
        {/* ── LEFT SIDEBAR ── */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <Card>
            <CardHeader><CardTitle>Dataset</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400"><LoadingSpinner /><span>Loading datasets...</span></div>
              ) : isError ? (
                <div className="text-sm text-red-400">{getErrorMessage(error)}</div>
              ) : (
                <DatasetSelect
                  datasets={datasets || []}
                  value={selectedDataset}
                  onChange={selectDataset}
                  placeholder="Select a dataset"
                  loading={isLoading}
                />
              )}
              {state && !stateLoading && (
                <p className="text-[11px] text-zinc-500 mt-2 truncate">Base: <span className="text-zinc-400">{state.base_key}</span> · v{state.current_version}</p>
              )}
            </CardContent>
          </Card>

          {selectedDs && (
            <Card>
              <CardContent style={{ padding: '12px 16px' }}>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20"><Rows3 className="w-4 h-4 text-blue-400" /></div>
                    <div><p className="text-xs text-zinc-500">Rows</p><p className="text-sm font-medium text-zinc-200">{(selectedDs.rows ?? 0).toLocaleString()}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20"><Columns3 className="w-4 h-4 text-purple-400" /></div>
                    <div><p className="text-xs text-zinc-500">Columns</p><p className="text-sm font-medium text-zinc-200">{(selectedDs.columns?.length ?? 0)}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20"><HardDrive className="w-4 h-4 text-amber-400" /></div>
                    <div><p className="text-xs text-zinc-500">Size</p><p className="text-sm font-medium text-zinc-200">{formatBytes(selectedDs.size_kb)}</p></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" size="sm" variant="secondary" disabled={!selectedDataset} icon={<Rows3 className="w-4 h-4" />} onClick={runDuplicates}>
                Remove Duplicates
              </Button>
              <Button className="w-full" size="sm" variant="secondary" disabled={!selectedDataset} icon={<AlertTriangle className="w-4 h-4" />} onClick={runMissing}>
                Impute Missing (median)
              </Button>
              <Button className="w-full" size="sm" variant="premium" disabled={!selectedDataset || !state} icon={<Sparkles className="w-4 h-4" />} onClick={runAutoClean}>
                Auto-Clean Pipeline
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── CENTER WORKSPACE ── */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          {!selectedDataset ? (
            <EmptyState
              icon={<FileText className="w-8 h-8" />}
              title="Select a dataset"
              description="Choose a dataset from the left sidebar to start cleaning"
            />
          ) : (
            <>
              {stateLoading ? (
                <Card>
                  <CardContent><div className="flex items-center justify-center py-16"><LoadingSpinner /></div></CardContent>
                </Card>
              ) : stateError ? (
                <Card><CardContent><EmptyState icon={<AlertCircle className="w-8 h-8 text-red-400" />} title="Could not inspect dataset" description={getErrorMessage(stateError)} /></CardContent></Card>
              ) : (
                <>
                  {/* Pipeline stepper */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Cleaning Pipeline</CardTitle>
                      {state && <Badge variant="info" size="sm">v{state.current_version}</Badge>}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-start gap-0 overflow-x-auto py-2">
                        {PIPELINE_CONFIG.map(({ key, label, icon: Icon }, i) => {
                          const s = resolveStage(key, steps[key], hasIssues, available, state?.dataset?.rows ?? 0);
                          const isLast = i === PIPELINE_CONFIG.length - 1;
                          const isActive = activeStep === key;
                          return (
                            <button key={key} onClick={() => setActiveStep(key)} className="flex items-start shrink-0 text-left group">
                              <div className="flex flex-col items-center min-w-[100px]">
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                                  s.code === 'completed' || s.code === 'no_issues' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                                  : s.code === 'failed' ? 'bg-red-500/10 border-red-500 text-red-400'
                                  : s.code === 'issues' ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                                  : s.code === 'running' ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                                  : s.code === 'skipped' ? 'bg-white/5 border-[#334155] text-zinc-500'
                                  : isActive ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                                  : 'bg-white/5 border-[#334155] text-zinc-500 group-hover:border-white/30'
                                }`}>
                                  {s.code === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> : s.code === 'completed' || s.code === 'no_issues' ? <CheckCircle2 className="w-4 h-4" /> : s.code === 'failed' ? <XCircle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                                </div>
                                <p className={`text-[11px] mt-2 text-center leading-tight ${isActive ? 'text-zinc-200' : 'text-zinc-600'}`}>{label}</p>
                                <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${s.cls}`}>{s.icon} {s.label}</p>
                              </div>
                              {!isLast && <div className="flex items-center justify-center h-8 mt-0 px-1 text-zinc-700"><ArrowRight className="w-4 h-4" /></div>}
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {renderStagePanel()}

                  {/* Applied operations / results */}
                  {runningStage && runningStage !== activeStep && (
                    <Card>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-blue-400 animate-pulse">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {runningText}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {result && !result.export && (
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Cleaning Result</span>
                        </CardTitle>
                        {result.new_version && <Badge variant="success" size="sm">Saved as v{result.new_version.version}</Badge>}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="rounded-lg bg-white/5 border border-white/5 p-2.5">
                            <p className="text-xs text-zinc-500">Rows</p>
                            <p className="text-sm font-medium text-zinc-200">{result.rows_before ?? '—'} → {result.rows_after ?? '—'}</p>
                          </div>
                          <div className="rounded-lg bg-white/5 border border-white/5 p-2.5">
                            <p className="text-xs text-zinc-500">Columns</p>
                            <p className="text-sm font-medium text-zinc-200">{result.columns_before ?? '—'} → {result.columns_after ?? '—'}</p>
                          </div>
                          {result.summary && Object.entries(result.summary).filter(([, v]: any) => v > 0).map(([key, val]: any) => (
                            <div key={key} className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2.5">
                              <p className="text-xs text-zinc-500">{key.replace(/_/g, ' ')}</p>
                              <p className="text-sm font-medium text-emerald-400">{val}</p>
                            </div>
                          ))}
                        </div>
                        {result.applied_operations?.length > 0 && (
                          <div className="space-y-1.5">
                            {result.applied_operations.map((op: string, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-zinc-300 py-1 px-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {op}
                              </div>
                            ))}
                          </div>
                        )}
                        {result.new_version && (
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="secondary" icon={<Database className="w-4 h-4" />} onClick={() => selectDataset(result.new_version.name)}>
                              View cleaned data
                            </Button>
                            <Button size="sm" variant="ghost" icon={<Download className="w-4 h-4" />} onClick={async () => { try { await datasetsService.downloadFile(result.new_version.name); } catch (err) { console.error(err); } }}>
                              Download
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Data preview */}
                  <Card>
                    <CardHeader>
                      <CardTitle><span className="flex items-center gap-2"><Database className="w-4 h-4 text-zinc-500" /> Data Preview</span></CardTitle>
                      {preview && <Badge variant="default">{filteredRows.length} rows</Badge>}
                      {state && state.current_version > 1 && <Badge variant="success" size="sm">Cleaned v{state.current_version}</Badge>}
                    </CardHeader>
                    <CardContent style={{ padding: 0 }}>
                      <div className="px-4 pt-3 pb-2 flex items-center gap-3 border-b border-white/5">
                        <div className="flex items-center gap-2 flex-1 bg-[#0F172A] border border-[#334155] rounded-lg px-3 h-8">
                          <Search className="w-3.5 h-3.5 text-zinc-500" />
                          <input
                            value={previewSearch}
                            onChange={(e) => { setPreviewSearch(e.target.value); setPreviewPage(0); }}
                            placeholder="Search data..."
                            className="w-full bg-transparent text-sm text-zinc-200 focus:outline-none placeholder-zinc-600"
                          />
                        </div>
                      </div>
                      {previewLoading ? (
                        <div className="flex items-center justify-center py-16"><LoadingSpinner /></div>
                      ) : preview && preview.rows.length > 0 ? (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-white/5">
                                  {preview.columns.map((col) => (
                                    <th key={col} onClick={() => { setSortCol(col); setSortDir((d) => (sortCol === col ? (d === 'asc' ? 'desc' : 'asc') : 'asc')); setPreviewPage(0); }}
                                      className="text-left py-2.5 px-4 text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap">
                                      <span className="flex items-center gap-1.5">
                                        {col}
                                        <ArrowUpDown className="w-3 h-3 text-blue-400" />
                                      </span>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {pagedRows.map((row: Record<string, any>, ri: number) => (
                                  <tr key={ri} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                    {preview.columns.map((col) => (
                                      <td key={col} className="py-2 px-4 text-zinc-300 whitespace-nowrap max-w-[200px] truncate">
                                        {row[col] == null ? <span className="text-zinc-600">null</span> : String(row[col])}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/5">
                              <span className="text-xs text-zinc-500">Page {previewPage + 1} of {totalPages}</span>
                              <div className="flex items-center gap-1">
                                <button disabled={previewPage === 0} onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                                  className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                  <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button disabled={previewPage >= totalPages - 1} onClick={() => setPreviewPage((p) => Math.min(totalPages - 1, p + 1))}
                                  className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                  <ChevronRight className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                          <Database className="w-6 h-6 mb-2" />
                          <p className="text-sm">No preview data available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </div>

        {/* ── RIGHT RAIL ── */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          {state && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="w-4 h-4 text-zinc-500" /> Versions</CardTitle></CardHeader>
              <CardContent>
                {state.versions.length === 0 ? (
                  <p className="text-sm text-zinc-600">No versions yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {state.versions.map((v: any) => (
                      <button key={v.filename} onClick={() => selectDataset(v.filename)}
                        className={`w-full text-left px-2.5 py-2 rounded-lg border text-xs transition-colors ${
                          v.active ? 'bg-blue-500/10 border-blue-500/40 text-zinc-200' : 'bg-white/5 border-white/5 text-zinc-400 hover:border-white/20'
                        }`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">v{v.version} {v.active && <span className="text-blue-400">· current</span>}</span>
                          <span className="text-zinc-600 shrink-0">{v.source} · {v.rows} rows</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><History className="w-4 h-4 text-zinc-500" /> Cleaning History</CardTitle></CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
              ) : history && history.history.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {history.history.slice().reverse().map((e: any) => (
                    <div key={e.id} className="rounded-lg bg-white/5 border border-white/5 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge size="sm" variant="info">{e.stage}</Badge>
                        <span className="text-[10px] text-zinc-600">
                          v{e.version}{e.rows_affected ? ` · ${e.rows_affected} row change` : ''}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">{e.operation}</p>
                      {e.created_at && <p className="text-[10px] text-zinc-600 mt-0.5">{new Date(e.created_at).toLocaleString()}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-600">No cleaning operations recorded yet.</p>
              )}
            </CardContent>
          </Card>

          {selectedDataset && (analysis || analysisLoading) && (
            <Card>
              <CardHeader><CardTitle>Data Quality</CardTitle></CardHeader>
              <CardContent>
                {analysisLoading ? (
                  <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
                ) : analysis ? (
                  <div className="space-y-4">
                    <div className="text-center py-3 rounded-xl bg-[#0F172A] border border-white/5">
                      <p className={`text-3xl font-bold ${qualityGradeColor(analysis.quality_score?.grade)}`}>{analysis.quality_score?.grade ?? '—'}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Health Score: <span className={qualityColor(analysis.quality_score?.total ?? 0)}>{analysis.quality_score?.total ?? 0}%</span>
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Missing Values</span>
                        <Badge variant={severityVariant(analysis.missing?.severity ?? '')} size="sm">{analysis.missing?.missing_pct?.toFixed(1) ?? 0}%</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Duplicate Rows</span>
                        <Badge variant={severityVariant(analysis.duplicates?.severity ?? '')} size="sm">{analysis.duplicates?.pct?.toFixed(1) ?? 0}%</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Outliers</span>
                        <Badge variant="default" size="sm">{analysis.outliers?.total_outliers?.toLocaleString() ?? 0}</Badge>
                      </div>
                    </div>
                    {analysis.quality_score?.deductions && analysis.quality_score.deductions.length > 0 && (
                      <div className="pt-2 border-t border-white/5">
                        <p className="text-xs text-zinc-500 mb-1.5">Deductions</p>
                        {analysis.quality_score.deductions.map((d: string, i: number) => (
                          <p key={i} className="text-xs text-zinc-400 leading-relaxed">• {d}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Next Steps</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { label: 'Feature Engineering', path: '/app/feature-engineering?dataset=' + encodeURIComponent(selectedDataset || ''), icon: Sparkles },
                  { label: 'Model Training', path: '/app/training', icon: Database },
                ].map(({ label, path, icon: Icon }) => (
                  <button key={label} onClick={() => { window.location.href = path; }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors text-left">
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    <Icon className="w-3.5 h-3.5 shrink-0 text-zinc-600" />
                    {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedDataset && !stateLoading && !stateError && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600">
          <span><span className="text-zinc-500 font-mono">{baseDatasetName(selectedDataset)}</span> chain</span>
          <span>·</span>
          <span>{state?.dataset?.rows?.toLocaleString()} rows</span>
          <span>·</span>
          <span>{state?.dataset?.columns?.length ?? 0} columns</span>
          <span>·</span>
          <span>detected {hasIssues.missing ? 'missing' : 'no missing'}, {hasIssues.duplicates ? 'duplicates' : 'no duplicates'}, {hasIssues.outliers ? 'outliers' : 'no outliers'}</span>
        </div>
      )}
    </PageContainer>
  );
}