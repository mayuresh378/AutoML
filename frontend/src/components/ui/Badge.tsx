import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'premium';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-white/5 text-zinc-400 border border-white/10',
  success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  error: 'bg-red-500/10 text-red-400 border border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  premium: 'bg-gradient-to-r from-primary/20 via-purple-500/20 to-accent/20 text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent border border-primary/20',
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-zinc-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  error: 'bg-red-400',
  info: 'bg-blue-400',
  premium: 'bg-primary',
};

export function Badge({ children, variant = 'default', size = 'sm', className, dot }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium rounded-full', variantStyles[variant], sizeStyles[size], className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}
