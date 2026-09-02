import { motion } from 'framer-motion';
import { cn } from '../lib/cn';

interface AnimatedProgressProps {
  value: number;
  max?: number;
  variant?: 'primary' | 'accent' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  className?: string;
  barClassName?: string;
  animated?: boolean;
}

const sizeStyles = { sm: 'h-1', md: 'h-2', lg: 'h-3' };
const variantStyles = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
};

export function AnimatedProgress({
  value,
  max = 100,
  variant = 'primary',
  size = 'md',
  showLabel,
  label,
  className,
  barClassName,
  animated = true,
}: AnimatedProgressProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      {(showLabel || label) && (
        <div className="mb-1 flex items-center justify-between text-xs">
          {label && <span className="text-zinc-400">{label}</span>}
          {showLabel && <span className="text-zinc-500">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={cn('w-full overflow-hidden rounded-full bg-white/10', sizeStyles[size])}>
        <motion.div
          className={cn('h-full rounded-full', variantStyles[variant], barClassName)}
          initial={animated ? { width: 0 } : { width: `${pct}%` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export function IndeterminateProgress({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'md' }) {
  return (
    <div className={cn('w-full overflow-hidden rounded-full bg-white/10', sizeStyles[size], className)}>
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: '50%' }}
      />
    </div>
  );
}
