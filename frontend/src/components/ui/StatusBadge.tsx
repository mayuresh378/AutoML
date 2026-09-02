import { Badge } from './Badge';

type StatusType = 'healthy' | 'running' | 'active' | 'ready' | 'queued' | 'uploaded'
  | 'degraded' | 'training' | 'creating'
  | 'stopped' | 'failed' | 'error' | 'archived' | 'completed' | 'success'
  | 'idle' | 'cancelled' | 'pending' | 'processing'
  | 'warning';

const statusVariantMap: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  healthy: 'success',
  running: 'success',
  active: 'success',
  ready: 'success',
  queued: 'info',
  uploaded: 'info',
  degraded: 'warning',
  training: 'info',
  creating: 'info',
  stopped: 'default',
  failed: 'error',
  error: 'error',
  archived: 'default',
  completed: 'success',
  success: 'success',
  idle: 'default',
  cancelled: 'warning',
  pending: 'info',
  processing: 'info',
  warning: 'warning',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = statusVariantMap[status.toLowerCase()] || 'default';
  return (
    <Badge variant={variant} dot className={className}>
      {status}
    </Badge>
  );
}
