import { useQuery } from '@tanstack/react-query';
import { TrendingUp, BarChart3, PieChart } from 'lucide-react';
import { monitoringService } from '../../../services/monitoring.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { getErrorMessage } from '../../../services/http';

export default function AnalyticsPage() {
  const { data: stats, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['monitoring', 'stats'],
    queryFn: () => monitoringService.stats(),
  });

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Analytics" description="Usage statistics and trends" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      </PageContainer>
    );
  }

  if (isError) {
    return <PageContainer><ErrorState title="Failed to load analytics" message={getErrorMessage(error)} onRetry={refetch} /></PageContainer>;
  }

  return (
    <PageContainer>
      <PageHeader title="Analytics" description="Usage statistics and trends" />

      {stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Experiments', value: stats.total_experiments, icon: <BarChart3 className="w-5 h-5" />, color: 'from-blue-500/20 to-blue-600/20 text-blue-400' },
              { label: 'Total Models', value: stats.total_models, icon: <TrendingUp className="w-5 h-5" />, color: 'from-purple-500/20 to-purple-600/20 text-purple-400' },
              { label: 'Total Predictions', value: stats.total_predictions.toLocaleString(), icon: <PieChart className="w-5 h-5" />, color: 'from-emerald-500/20 to-emerald-600/20 text-emerald-400' },
            ].map((item) => (
              <Card key={item.label} padding="md">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">{item.label}</p>
                    <p className="text-2xl font-bold text-zinc-100 mt-1">{item.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center`}>{item.icon}</div>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Performance</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div><p className="text-sm text-zinc-400">Average Training Time</p><p className="text-lg font-semibold text-zinc-100">{(stats.avg_training_time ?? 0).toFixed(1)}s</p></div>
                  <div><p className="text-sm text-zinc-400">Success Rate</p><p className="text-lg font-semibold text-zinc-100">{(stats.success_rate * 100).toFixed(1)}%</p></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Data Overview</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div><p className="text-sm text-zinc-400">Total Datasets</p><p className="text-lg font-semibold text-zinc-100">{stats.total_datasets}</p></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
}
