import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Zap, Send, Database, Brain } from 'lucide-react';
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

function Textarea({ label, value, onChange, placeholder, rows = 4, error }: { label?: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; placeholder?: string; rows?: number; error?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-zinc-300">{label}</label>}
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 hover:border-white/20 resize-none"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export default function PredictionPage() {
  const { notifySuccess, notifyError } = useNotification();
  const [selectedModel, setSelectedModel] = useState('');
  const [payload, setPayload] = useState('{\n  \n}');
  const [result, setResult] = useState<any>(null);

  const { data: models, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: () => modelsService.list(),
    select: (d) => d.models?.filter((m: any) => m.status === 'ready'),
  });

  const predictMutation = useMutation({
    mutationFn: () => predictionsService.run(selectedModel, JSON.parse(payload)),
    onSuccess: (data) => { setResult(data); notifySuccess('Prediction completed'); },
    onError: (err) => notifyError('Prediction failed', getErrorMessage(err)),
  });

  return (
    <PageContainer maxWidth="lg">
      <PageHeader title="Inference API" description="Run predictions against deployed models" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Request</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <LoadingSpinner />
            ) : !models || models.length === 0 ? (
              <EmptyState icon={<Brain className="w-8 h-8" />} title="No models available" description="Train and deploy a model first" />
            ) : (
              <>
                <Select
                  label="Model"
                  placeholder="Select a model"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  options={(models as any[]).map((m: any) => ({ value: m.name, label: `${m.name} (${m.algorithm})` }))}
                />
                <Textarea
                  label="Payload (JSON)"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  placeholder='{"feature1": "value1", "feature2": 42}'
                  rows={8}
                />
                {predictMutation.error && <p className="text-xs text-red-400">{getErrorMessage(predictMutation.error)}</p>}
                <Button
                  className="w-full"
                  onClick={() => predictMutation.mutate()}
                  loading={predictMutation.isPending}
                  disabled={!selectedModel || !payload}
                  icon={<Zap className="w-4 h-4" />}
                >
                  Run Prediction
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Response</CardTitle></CardHeader>
          <CardContent>
            {result ? (
              <pre className="text-sm text-zinc-200 font-mono bg-white/5 rounded-xl p-4 overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                <Send className="w-10 h-10 mb-3" />
                <p className="text-sm">Run a prediction to see results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
