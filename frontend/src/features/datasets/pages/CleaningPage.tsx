import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, Eraser, AlertTriangle, CheckCircle2, RotateCcw, FileText, Download,
  Search, ArrowUpDown, ChevronLeft, ChevronRight, Database, Rows3, Columns3,
  HardDrive, ArrowRight, Circle, Clock,
} from 'lucide-react';
import { datasetsService } from '../../../services/datasets.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { DatasetSelect } from '../../../components/ui/DatasetSelect';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { useNotification } from '../../../hooks/useNotification';
import { getErrorMessage, downloadUrl } from '../../../services/http';

const PIPELINE_STEPS = [
  'Dataset Loaded',
  'Missing Values',
  'Remove Duplicates',
  'Outlier Detection',
  'Encoding',
  'Scaling',
  'Export Cleaned Dataset',
];

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

export default function CleaningPage() {
  const { notifySuccess, notifyError } = useNotification();
  const [selectedDataset, setSelectedDataset] = useState('');
  const [result, setResult] = useState<any>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewSearch, setPreviewSearch] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const previewPageSize = 20;

  const { data: datasets, isLoading, isError, error } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
    select: (d: any) => d.datasets,
  });

  const selectedDs = useMemo(
    () => (datasets || []).find((d: any) => d.name === selectedDataset) ?? null,
    [datasets, selectedDataset],
  );

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

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['dataset-profile', selectedDataset],
    queryFn: () => datasetsService.profile(selectedDataset),
    enabled: !!selectedDataset,
  });

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

  const activeOps = useMemo(() => {
    const ops = new Set<string>();
    if (result?.applied_operations) {
      for (const op of result.applied_operations) {
        const lower = String(op).toLowerCase();
        if (lower.includes('missing') || lower.includes('impute')) ops.add('Missing Values');
        if (lower.includes('duplicate')) ops.add('Remove Duplicates');
        if (lower.includes('outlier')) ops.add('Outlier Detection');
        if (lower.includes('encod')) ops.add('Encoding');
        if (lower.includes('scal')) ops.add('Scaling');
      }
    }
    return ops;
  }, [result]);

  const runClean = (type: string, extra: Record<string, any> = {}) => {
    if (!selectedDataset) return;
    const ops = [{ type, ...extra }];
    datasetsService.clean(selectedDataset, ops).then((data: any) => {
      setResult(data);
      notifySuccess('Cleaning completed');
    }).catch((err) => {
      notifyError('Cleaning failed', getErrorMessage(err));
    });
  };

  const runAutoClean = () => {
    if (!selectedDataset) return;
    datasetsService.autoClean(selectedDataset).then((data: any) => {
      setResult(data);
      notifySuccess('Auto-cleaning completed');
    }).catch((err) => {
      notifyError('Cleaning failed', getErrorMessage(err));
    });
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPreviewPage(0);
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Data Cleaning</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Clean and prepare your datasets</p>
        </div>
        {result && (
          <div className="flex items-center gap-2">
            {result?.cleaned_file && (
              <Button
                variant="secondary" size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={() => window.open(downloadUrl(`/datasets/${encodeURIComponent(result.cleaned_file)}/download`), '_blank')}
              >
                Download
              </Button>
            )}
            <Button
              variant="secondary" size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={() => setResult(null)}
            >
              Clear Results
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4" style={{ minHeight: 'calc(100vh - 180px)' }}>
        {/* ── LEFT SIDEBAR (22%) ── */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          <Card>
            <CardHeader><CardTitle>Dataset</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <LoadingSpinner />
                  <span>Loading datasets...</span>
                </div>
              ) : isError ? (
                <div className="text-sm text-red-400">{getErrorMessage(error)}</div>
              ) : (
                <DatasetSelect
                  datasets={datasets || []}
                  value={selectedDataset}
                  onChange={(name) => { setSelectedDataset(name); setResult(null); setPreviewPage(0); setSortCol(null); setPreviewSearch(''); }}
                  placeholder="Select a dataset"
                  loading={isLoading}
                />
              )}
            </CardContent>
          </Card>

          {selectedDs && (
            <Card>
              <CardContent style={{ padding: '12px 16px' }}>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20">
                      <Rows3 className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Rows</p>
                      <p className="text-sm font-medium text-zinc-200">{(selectedDs.rows ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <Columns3 className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Columns</p>
                      <p className="text-sm font-medium text-zinc-200">{(selectedDs.columns?.length ?? 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <HardDrive className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Size</p>
                      <p className="text-sm font-medium text-zinc-200">{formatBytes(selectedDs.size_kb)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full" size="sm" variant="secondary"
                disabled={!selectedDataset}
                icon={<Eraser className="w-4 h-4" />}
                onClick={() => runClean('remove_duplicates')}
              >
                Remove Duplicates
              </Button>
              <Button
                className="w-full" size="sm" variant="secondary"
                disabled={!selectedDataset}
                icon={<AlertTriangle className="w-4 h-4" />}
                onClick={() => runClean('impute_missing', { strategy: 'median' })}
              >
                Handle Missing Values
              </Button>
              <Button
                className="w-full" size="sm" variant="premium"
                disabled={!selectedDataset}
                icon={<Sparkles className="w-4 h-4" />}
                onClick={() => runAutoClean()}
              >
                Auto-Clean
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ── CENTER WORKSPACE (56%) ── */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          {!selectedDataset ? (
            <EmptyState
              icon={<FileText className="w-8 h-8" />}
              title="Select a dataset"
              description="Choose a dataset from the left sidebar to start cleaning"
            />
          ) : (
            <>
              {result?.applied_operations && result.applied_operations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Applied Operations</CardTitle>
                    <Badge variant="success">{result.applied_operations.length} operations</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {result.applied_operations.map((op: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-zinc-300 py-1 px-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          {op}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Data Preview</CardTitle>
                  {preview && <Badge variant="default">{filteredRows.length} rows</Badge>}
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
                    <div className="flex items-center justify-center py-16">
                      <LoadingSpinner />
                    </div>
                  ) : preview && preview.rows.length > 0 ? (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/5">
                              {preview.columns.map((col) => (
                                <th
                                  key={col}
                                  onClick={() => handleSort(col)}
                                  className="text-left py-2.5 px-4 text-zinc-500 font-medium cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap"
                                >
                                  <span className="flex items-center gap-1.5">
                                    {col}
                                    {sortCol === col ? (
                                      <ArrowUpDown className="w-3 h-3 text-blue-400" />
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                                    )}
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
                          <span className="text-xs text-zinc-500">
                            Page {previewPage + 1} of {totalPages}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              disabled={previewPage === 0}
                              onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                              className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              disabled={previewPage >= totalPages - 1}
                              onClick={() => setPreviewPage((p) => Math.min(totalPages - 1, p + 1))}
                              className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
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
        </div>

        {/* ── RIGHT SIDEBAR (22%) ── */}
        <div className="col-span-12 lg:col-span-3 space-y-4">
          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
                <Badge variant="success" dot>Cleaned</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.rows_before !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Rows</span>
                    <span className="text-zinc-300">{result.rows_before} → {result.rows_after}</span>
                  </div>
                )}
                {result.columns_before !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Columns</span>
                    <span className="text-zinc-300">{result.columns_before} → {result.columns_after}</span>
                  </div>
                )}
                {result.summary && Object.entries(result.summary).filter(([, v]: any) => v > 0).map(([key, val]: any) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">{key.replace(/_/g, ' ')}</span>
                    <Badge variant="info">{val}</Badge>
                  </div>
                ))}
                {result.cleaned_file && (
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-xs text-zinc-500 mb-1">Output file</p>
                    <p className="text-xs text-zinc-300 truncate">{result.cleaned_file}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selectedDataset && (analysis || analysisLoading) && (
            <Card>
              <CardHeader><CardTitle>Data Quality</CardTitle></CardHeader>
              <CardContent>
                {analysisLoading ? (
                  <div className="flex items-center justify-center py-8"><LoadingSpinner /></div>
                ) : analysis ? (
                  <div className="space-y-4">
                    <div className="text-center py-3 rounded-xl bg-[#0F172A] border border-white/5">
                      <p className={`text-3xl font-bold ${qualityGradeColor(analysis.quality_score?.grade)}`}>
                        {analysis.quality_score?.grade ?? '—'}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Health Score: <span className={qualityColor(analysis.quality_score?.total ?? 0)}>
                          {analysis.quality_score?.total ?? 0}%
                        </span>
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Missing Values</span>
                        <Badge variant={severityVariant(analysis.missing?.severity ?? '')} size="sm">
                          {analysis.missing?.missing_pct?.toFixed(1) ?? 0}%
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Duplicate Rows</span>
                        <Badge variant={severityVariant(analysis.duplicates?.severity ?? '')} size="sm">
                          {analysis.duplicates?.pct?.toFixed(1) ?? 0}%
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-500">Outliers</span>
                        <Badge variant="default" size="sm">
                          {analysis.outliers?.total_outliers?.toLocaleString() ?? 0}
                        </Badge>
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
                  { label: 'Feature Engineering', path: '/app/feature-engineering', icon: Sparkles },
                  { label: 'Model Training', path: '/app/training', icon: Database },
                  { label: 'Export Dataset', path: null, icon: Download },
                ].map(({ label, path, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => { if (path) window.location.href = path; }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors text-left"
                  >
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

      {/* ── CLEANING PIPELINE (BOTTOM) ── */}
      {selectedDataset && (
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Cleaning Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-0 overflow-x-auto py-2">
                {PIPELINE_STEPS.map((step, i) => {
                  const isCompleted = step === 'Dataset Loaded' || activeOps.has(step);
                  const isLast = i === PIPELINE_STEPS.length - 1;
                  return (
                    <div key={step} className="flex items-start shrink-0">
                      <div className="flex flex-col items-center min-w-[110px]">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                          isCompleted
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                            : 'bg-white/5 border-[#334155] text-zinc-600'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </div>
                        <p className={`text-xs mt-2 text-center leading-tight ${
                          isCompleted ? 'text-zinc-300' : 'text-zinc-600'
                        }`}>
                          {step}
                        </p>
                        {isCompleted && step !== 'Dataset Loaded' && (
                          <p className="text-[10px] text-emerald-500 mt-0.5 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Completed
                          </p>
                        )}
                        {!isCompleted && step !== 'Dataset Loaded' && (
                          <p className="text-[10px] text-zinc-600 mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> Pending
                          </p>
                        )}
                      </div>
                      {!isLast && (
                        <div className={`flex items-center justify-center h-8 mt-0 px-1 ${
                          isCompleted ? 'text-emerald-500/40' : 'text-zinc-700'
                        }`}>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
