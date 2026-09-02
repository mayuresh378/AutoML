import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/cn';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card' | 'chart' | 'metric' | 'badge';
  width?: string | number;
  height?: string | number;
  count?: number;
  premium?: boolean;
}

const Skeleton = memo(function Skeleton({ className, variant = 'text', width, height, count = 1, premium }: SkeletonProps) {
  const base = premium ? 'shimmer-loading-premium rounded-md' : 'shimmer-loading rounded-md';
  const styles = {
    text: 'h-4 w-full rounded-md',
    circular: 'h-10 w-10 rounded-full',
    rectangular: 'h-24 w-full rounded-xl',
    card: 'h-40 w-full rounded-[32px]',
    chart: 'h-48 w-full rounded-2xl',
    metric: 'h-24 w-full rounded-2xl',
    badge: 'h-6 w-16 rounded-full',
  };
  const items = Array.from({ length: count });
  return (
    <>
      {items.map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.04, ease: 'easeOut' }}
          className={cn(base, styles[variant], className)}
          style={{
            width: typeof width === 'number' ? `${width}px` : width,
            height: typeof height === 'number' ? `${height}px` : height,
          }}
        />
      ))}
    </>
  );
});
export { Skeleton };

export function CardSkeleton({ premium }: { premium?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn('rounded-[32px] border border-white/10 p-6 space-y-4', premium ? 'bg-card' : 'bg-[#111827]/80')}
    >
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} premium={premium} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="40%" premium={premium} />
          <Skeleton variant="text" width="25%" premium={premium} />
        </div>
      </div>
      <Skeleton variant="rectangular" height={100} premium={premium} />
      <div className="space-y-2">
        <Skeleton variant="text" width="80%" premium={premium} />
        <Skeleton variant="text" width="60%" premium={premium} />
      </div>
    </motion.div>
  );
}

export function ChartSkeleton({ premium }: { premium?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn('rounded-[32px] border border-white/10 p-6', premium ? 'bg-card' : 'bg-[#111827]/80')}
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="text" width="30%" premium={premium} />
        <Skeleton variant="badge" premium={premium} />
      </div>
      <Skeleton variant="chart" premium={premium} />
    </motion.div>
  );
}

export function MetricSkeleton({ premium }: { premium?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn('rounded-2xl border border-white/10 p-4', premium ? 'bg-card' : 'bg-white/[0.03]')}
    >
      <Skeleton variant="text" width="50%" className="mb-2" premium={premium} />
      <Skeleton variant="text" width="70%" height={28} premium={premium} />
      <Skeleton variant="text" width="30%" className="mt-1" premium={premium} />
    </motion.div>
  );
}

export function TableSkeleton({ rows = 5, premium }: { rows?: number; premium?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 px-4 py-3">
        <Skeleton variant="text" width="20%" premium={premium} />
        <Skeleton variant="text" width="25%" premium={premium} />
        <Skeleton variant="text" width="15%" premium={premium} />
        <Skeleton variant="text" width="15%" premium={premium} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, delay: 0.05 + i * 0.03, ease: 'easeOut' }}
          className="flex gap-4 px-4 py-3"
        >
          <Skeleton variant="text" width="20%" premium={premium} />
          <Skeleton variant="text" width="25%" premium={premium} />
          <Skeleton variant="text" width="15%" premium={premium} />
          <Skeleton variant="text" width="15%" premium={premium} />
        </motion.div>
      ))}
    </div>
  );
}
