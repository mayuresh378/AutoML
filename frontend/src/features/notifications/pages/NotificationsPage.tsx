import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bell, CheckCheck, Trash2, Inbox, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { notificationsService } from '../../../services/notifications.service';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { useNotification } from '../../../hooks/useNotification';
import { staggerContainer, staggerItem } from '../../../lib/animations';
import { timeAgo } from '../../../lib/formatters';
import { getErrorMessage } from '../../../services/http';

const typeIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const typeColors = {
  success: 'text-emerald-400 bg-emerald-500/10',
  error: 'text-red-400 bg-red-500/10',
  warning: 'text-amber-400 bg-amber-500/10',
  info: 'text-blue-400 bg-blue-500/10',
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { notifySuccess } = useNotification();

  const { data: notifications, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsService.list(),
    select: (d) => d.notifications,
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => notificationsService.dismiss(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Notifications" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      </PageContainer>
    );
  }

  if (isError) {
    return <PageContainer><ErrorState title="Failed to load notifications" message={getErrorMessage(error)} onRetry={refetch} /></PageContainer>;
  }

  return (
    <PageContainer maxWidth="md">
      <PageHeader title="Notifications" description="Stay updated with your ML workflows">
        {notifications && notifications.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending} icon={<CheckCheck className="w-4 h-4" />}>
            Mark All Read
          </Button>
        )}
      </PageHeader>

      {!notifications || notifications.length === 0 ? (
        <EmptyState icon={<Bell className="w-8 h-8" />} title="No notifications" description="You're all caught up!" />
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
          {(notifications as any[]).map((n: any) => {
            const Icon = typeIcons[n.type as keyof typeof typeIcons] || Info;
            return (
              <motion.div key={n.id} variants={staggerItem}>
                <Card padding="md" className={!n.read ? 'border-primary/20 bg-primary/[0.02]' : ''}>
                  <div className="flex gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${typeColors[n.type as keyof typeof typeColors] || typeColors.info}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-200">{n.title}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!n.read && <span className="w-2 h-2 rounded-full bg-primary" />}
                          <button onClick={() => dismissMutation.mutate(n.id)} className="p-1 rounded hover:bg-white/5 text-zinc-500 hover:text-zinc-300"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      {n.message && <p className="text-xs text-zinc-500 mt-0.5">{n.message}</p>}
                      <p className="text-xs text-zinc-600 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </PageContainer>
  );
}
