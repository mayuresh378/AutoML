import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Button } from '../../../components/ui/Button';

interface SectionCardProps {
  title: string;
  icon?: ReactNode;
  description?: string;
  action?: ReactNode;
  loading?: boolean;
  error?: string | null;
  isError?: boolean;
  onRetry?: () => void;
  empty?: boolean;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  skeleton?: ReactNode;
  fullBleed?: boolean;
  className?: string;
  children?: ReactNode;
}

export default function SectionCard({
  title,
  icon,
  description,
  action,
  loading,
  error,
  isError,
  onRetry,
  empty,
  emptyIcon,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  skeleton,
  fullBleed,
  className,
  children,
}: SectionCardProps) {
  const showError = isError || !!error;
  const body = loading ? (
    skeleton ?? (
      <div className="space-y-3">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="rectangular" height={128} />
        <Skeleton variant="text" width="45%" />
        <Skeleton variant="text" width="70%" />
      </div>
    )
  ) : showError ? (
    <ErrorState
      title="Unable to load this section"
      message={error || 'Something went wrong while fetching data.'}
      onRetry={onRetry}
    />
  ) : empty ? (
    <EmptyState
      icon={emptyIcon}
      title={emptyTitle}
      description={emptyDescription}
      action={emptyAction}
      className="py-10"
    />
  ) : (
    children
  );

  return (
    <Card padding={fullBleed ? 'none' : 'md'} className={cn('overflow-hidden', className)}>
      <CardHeader>
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && <span className="text-zinc-400 shrink-0">{icon}</span>}
          <CardTitle className="truncate">{title}</CardTitle>
          {description && (
            <span className="hidden sm:inline text-xs text-zinc-500 font-sans font-normal ml-1 truncate">
              {description}
            </span>
          )}
        </div>
        {action && (
          <div className="flex items-center gap-2 shrink-0 ml-3">{action}</div>
        )}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}

function secondsSince(updatedAt: Date): string {
  const s = Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export function SectionRefresh({
  refetch,
  isFetching,
  updatedAt,
}: {
  refetch: () => void;
  isFetching?: boolean;
  updatedAt?: Date | null;
}) {
  return (
    <div className="flex items-center gap-2">
      {updatedAt && (
        <span className="text-[11px] font-mono text-zinc-500 hidden md:inline">
          Updated {secondsSince(updatedAt)} ago
        </span>
      )}
      <motion.button
        whileHover={{ rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={refetch}
        title="Refresh"
        className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors cursor-pointer"
      >
        <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
      </motion.button>
    </div>
  );
}