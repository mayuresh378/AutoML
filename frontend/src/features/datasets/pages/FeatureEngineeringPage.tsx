import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wand2, CheckCircle2, RotateCcw, FileText, Download, Lightbulb } from 'lucide-react';
import { datasetsService } from '../../../services/datasets.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { DatasetSelect } from '../../../components/ui/DatasetSelect';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { useNotification } from '../../../hooks/useNotification';
import { getErrorMessage, downloadUrl } from '../../../services/http';

export default function FeatureEngineeringPage() {
  const { notifySuccess, notifyError } = useNotification();
  const [selectedDataset, setSelectedDataset] = useState('');
  const [selectedOps, setSelectedOps] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<any>(null);

  const { data: datasets, isLoading, isError, error } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
    select: (d: any) => d.datasets,
  });

  const { data: suggestionsData, isLoading: loadingSuggestions } = useQuery({
    queryKey: ['feature-suggestions', selectedDataset],
    queryFn: () => datasetsService.suggestFeatures(selectedDataset),
    enabled: !!selectedDataset,
  });

  const suggestions = suggestionsData?.suggestions || [];

  const toggleOp = (idx: number) => {
    setSelectedOps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const generateFeatures = () => {
    if (!selectedDataset || selectedOps.size === 0) return;
    const ops = Array.from(selectedOps).map((idx) => {
      const s = suggestions[idx];
      const op: any = { type: s.type, columns: s.columns };
      if (s.degree) op.degree = s.degree;
      if (s.n_bins) op.n_bins = s.n_bins;
      return op;
    });
    datasetsService.generateFeatures(selectedDataset, ops).then((data: any) => {
      setResult(data);
      notifySuccess('Features generated successfully');
    }).catch((err) => {
      notifyError('Feature generation failed', getErrorMessage(err));
    });
  };



  return (
    <PageContainer>
      <PageHeader title="Feature Engineering" description="Generate and transform features for your datasets" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader><CardTitle>Dataset</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <LoadingSpinner />
                  <span>Loading datasets...</span>
                </div>
              ) : isError ? (
                <div className="text-sm text-red-400">
                  Failed to load datasets: {getErrorMessage(error)}
                </div>
              ) : (
                <DatasetSelect
                  datasets={datasets || []}
                  value={selectedDataset}
                  onChange={(name) => { setSelectedDataset(name); setResult(null); setSelectedOps(new Set()); }}
                  placeholder="Select a dataset"
                  loading={isLoading}
                />
              )}
            </CardContent>
          </Card>

          {selectedDataset && suggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Operations</CardTitle>
                <Badge variant="info">{selectedOps.size} selected</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full" size="sm" variant="premium"
                  disabled={selectedOps.size === 0}
                  icon={<Wand2 className="w-4 h-4" />}
                  onClick={generateFeatures}
                >
                  Generate Features
                </Button>
              </CardContent>
            </Card>
          )}

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
                <Badge variant="success" dot>Generated</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Total columns</span>
                  <Badge variant="info">{result.total_columns}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">New features</span>
                  <Badge variant="success">{result.new_columns}</Badge>
                </div>
                <div className="pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Output file</span>
                    <span className="text-zinc-200 truncate ml-2">{result.enhanced_file}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-3 space-y-4">
          {!selectedDataset ? (
            <EmptyState
              icon={<FileText className="w-8 h-8" />}
              title="Select a dataset"
              description="Choose a dataset from the left sidebar to start feature engineering"
            />
          ) : loadingSuggestions ? (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : suggestions.length === 0 ? (
            <EmptyState
              icon={<Wand2 className="w-8 h-8" />}
              title="No suggestions available"
              description="This dataset may not have suitable numeric columns for feature engineering"
            />
          ) : result ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Generated Features</CardTitle>
                  <Badge variant="success">{result.new_columns} new</Badge>
                </CardHeader>
                <CardContent>
                  {result.generated_features && result.generated_features.length > 0 ? (
                    <ul className="space-y-1.5">
                      {result.generated_features.map((feat: string, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          {feat}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-500">No features were generated</p>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                {result?.enhanced_file && (
                  <Button
                    variant="secondary" size="sm"
                    icon={<Download className="w-4 h-4" />}
                    onClick={() => window.open(downloadUrl(`/datasets/${encodeURIComponent(result.enhanced_file)}/download`), '_blank')}
                  >
                    Download Enhanced File
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
            </>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Suggested Operations</CardTitle>
                  <Badge variant="info">{suggestions.length} suggestions</Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {suggestions.map((s: any, idx: number) => (
                      <label
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedOps.has(idx)
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-emerald-500"
                          checked={selectedOps.has(idx)}
                          onChange={() => toggleOp(idx)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="default" size="sm">{s.type}</Badge>
                            <span className="text-sm text-zinc-300 truncate">{s.columns?.join(', ')}</span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">{s.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  variant="premium" size="sm"
                  disabled={selectedOps.size === 0}
                  icon={<Wand2 className="w-4 h-4" />}
                  onClick={generateFeatures}
                >
                  Generate {selectedOps.size > 0 ? `(${selectedOps.size})` : ''} Features
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
