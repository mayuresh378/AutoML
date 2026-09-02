import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, RefreshCw } from 'lucide-react';
import { activityService } from '../../../services/activity.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { staggerContainer, staggerItem } from '../../../lib/animations';
import { timeAgo } from '../../../lib/formatters';
import { getErrorMessage } from '../../../services/http';

export default function ActivityPage() {
  const { data: activities, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['activity'],
    queryFn: () => activityService.list(),
    select: (d) => d.activities,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Activity" description="Track every action in your workspace" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      </PageContainer>
    );
  }

  if (isError) {
    return <PageContainer><ErrorState title="Failed to load activity" message={getErrorMessage(error)} onRetry={refetch} /></PageContainer>;
  }

  return (
    <PageContainer maxWidth="lg">
      <PageHeader title="Activity" description="Track every action in your workspace">
        <Button variant="secondary" size="sm" onClick={() => refetch()} icon={<RefreshCw className="w-4 h-4" />}>Refresh</Button>
      </PageHeader>

      {!activities || activities.length === 0 ? (
        <EmptyState icon={<Clock className="w-8 h-8" />} title="No activity yet" description="Activity will appear here as you use the platform" />
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
          {(activities as any[]).map((a: any) => (
            <motion.div key={a.id} variants={staggerItem}>
              <Card padding="md">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary/50 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-200">
                      <span className="font-medium">{a.actor}</span>
                      <span className="text-zinc-400"> {a.action} </span>
                      <span className="font-medium">{a.target}</span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{timeAgo(a.created_at)}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </PageContainer>
  );
}
