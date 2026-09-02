import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Play, Database, Brain, CheckCircle2, Timer, Table } from 'lucide-react';
import { predictionsService } from '../../../services/predictions.service';
import { modelsService } from '../../../services/models.service';
import { datasetsService } from '../../../services/datasets.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useNotification } from '../../../hooks/useNotification';
import { getErrorMessage } from '../../../services/http';

const PREVIEW_LIMIT = 50;

export default function BatchPredictionPage() {
  const { notifySuccess, notifyError } = useNotification();
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedDataset, setSelectedDataset] = useState('');
  const [result, setResult] = useState<{ predictions: any[]; count: number; latency_ms: number } | null>(null);

  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ['models'],
    queryFn: () => modelsService.list(),
    select: (d) => d.models?.filter((m: any) => m.status === 'ready'),
  });

  const { data: datasets, isLoading: datasetsLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
    select: (d) => d.datasets,
  });

  const runMutation = useMutation({
    mutationFn: () => predictionsService.batchFile(selectedModel, selectedDataset),
    onSuccess: (data) => {
      setResult(data);
      notifySuccess(`Batch prediction complete — ${data.count} rows scored`);
    },
    onError: (err) => notifyError('Batch prediction failed', getErrorMessage(err)),
  });

  const previewRows = result?.predictions.slice(0, PREVIEW_LIMIT) || [];
  const columns = previewRows.length > 0 ? Object.keys(previewRows[0]).filter((c) => c !== 'prediction' && c !== 'confidence') : [];

  return (
    <PageContainer maxWidth="xl">
      <PageHeader title="Batch Prediction" description="Run predictions against an entire dataset using a trained model" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {modelsLoading ? (
              <LoadingSpinner />
            ) : !models || models.length === 0 ? (
              <EmptyState icon={<Brain className="w-8 h-8" />} title="No models available" description="Train and deploy a model first" />
            ) : (
              <Select
                label="Model"
                placeholder="Select a model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                options={(models as any[]).map((m: any) => ({ value: m.name, label: `${m.name} (${m.algorithm})` }))}
              />
            )}

            {datasetsLoading ? (
              <LoadingSpinner />
            ) : !datasets || datasets.length === 0 ? (
              <EmptyState icon={<Database className="w-8 h-8" />} title="No datasets available" description="Upload a dataset first" />
            ) : (
              <Select
                label="Dataset"
                placeholder="Select a dataset"
                value={selectedDataset}
                onChange={(e) => setSelectedDataset(e.target.value)}
                options={(datasets as any[]).map((d: any) => ({ value: d.name || d.filename, label: `${d.filename || d.name} (${d.rows?.toLocaleString?.() || '—'} rows)` }))}
              />
            )}

            {runMutation.error && <p className="text-xs text-red-400">{getErrorMessage(runMutation.error)}</p>}
            <Button
              className="w-full"
              onClick={() => runMutation.mutate()}
              loading={runMutation.isPending}
              disabled={!selectedModel || !selectedDataset}
              icon={<Play className="w-4 h-4" />}
            >
              Run Batch Prediction
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent>
            {result ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                  <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-success" />
                  <div className="text-2xl font-bold text-zinc-100">{result.count}</div>
                  <div className="text-xs text-zinc-500 mt-1">Rows scored</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                  <Timer className="w-5 h-5 mx-auto mb-2 text-primary" />
                  <div className="text-2xl font-bold text-zinc-100">{(result.latency_ms ?? 0).toFixed(1)}</div>
                  <div className="text-xs text-zinc-500 mt-1">Latency (ms)</div>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
                  <Brain className="w-5 h-5 mx-auto mb-2 text-accent" />
                  <div className="text-sm font-bold text-zinc-100 truncate">{selectedModel}</div>
                  <div className="text-xs text-zinc-500 mt-1">Model</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                <Database className="w-10 h-10 mb-3" />
                <p className="text-sm">Run a batch prediction to see results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Table className="w-4 h-4" />
                Predictions
                <span className="text-xs font-normal text-zinc-500">
                  showing {previewRows.length} of {result.count} rows
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {columns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left text-xs font-medium text-primary uppercase tracking-wider whitespace-nowrap">Prediction</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider whitespace-nowrap">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
                      {columns.map((col) => (
                        <td key={col} className="px-3 py-2 text-zinc-300 whitespace-nowrap">{String(row[col] ?? '')}</td>
                      ))}
                      <td className="px-3 py-2 font-semibold text-primary whitespace-nowrap">{String(row.prediction ?? '—')}</td>
                      <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">
                        {row.confidence != null ? `${(Number(row.confidence) * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </PageContainer>
  );
}
