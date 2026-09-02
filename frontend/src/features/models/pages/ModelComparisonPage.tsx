import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { modelsService } from '../../../services/models.service';
import { useUIStore } from '../../../store/useUIStore';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { getErrorMessage } from '../../../services/http';

export default function ModelComparisonPage() {
  const setActivePage = useUIStore((s) => s.setActivePage);

  const { data: models, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['models'],
    queryFn: () => modelsService.list(),
    select: (d) => d.models,
  });

  if (isLoading) return <PageContainer><PageHeader title="Model Comparison" /><LoadingSpinner /></PageContainer>;
  if (isError) return <PageContainer><PageHeader title="Model Comparison" /><ErrorState title="Failed to load models" message={getErrorMessage(error)} onRetry={refetch} /></PageContainer>;

  const readyModels = (models || []).filter((m: any) => m.metrics);

  return (
    <PageContainer>
      <Button variant="ghost" onClick={() => setActivePage('Models')} className="mb-4" icon={<ArrowLeft className="w-4 h-4" />}>Back to Models</Button>
      <PageHeader title="Model Comparison" description="Compare performance metrics across models" />

      {readyModels.length === 0 ? (
        <EmptyState icon={<BarChart3 className="w-8 h-8" />} title="No models with metrics" description="Train and complete models to compare their performance" />
      ) : (
        <Card>
          <CardHeader><CardTitle>Performance Metrics</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Algorithm</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Accuracy</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">F1 Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Precision</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Recall</th>
                </tr>
              </thead>
              <tbody>
                {readyModels.map((m: any) => (
                  <tr key={m.id || m.name} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-zinc-200 font-medium">{m.name}</td>
                    <td className="px-4 py-3"><Badge variant="info" size="sm">{m.algorithm}</Badge></td>
                    <td className="px-4 py-3 text-zinc-300">{m.metrics.accuracy != null ? `${(m.metrics.accuracy * 100).toFixed(1)}%` : '-'}</td>
                    <td className="px-4 py-3 text-zinc-300">{m.metrics.f1_score != null ? `${(m.metrics.f1_score * 100).toFixed(1)}%` : '-'}</td>
                    <td className="px-4 py-3 text-zinc-300">{m.metrics.precision != null ? `${(m.metrics.precision * 100).toFixed(1)}%` : '-'}</td>
                    <td className="px-4 py-3 text-zinc-300">{m.metrics.recall != null ? `${(m.metrics.recall * 100).toFixed(1)}%` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
