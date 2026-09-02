import { type ReactNode } from 'react';
import { cn } from '../../../../lib/cn';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'violet' | 'sky';
  className?: string;
  onClick?: () => void;
}

const tones = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-400',
  danger: 'bg-red-500/10 text-red-400',
  violet: 'bg-violet-500/10 text-violet-400',
  sky: 'bg-sky-500/10 text-sky-400',
};

export function StatCard({ icon, label, value, sub, tone = 'default', className, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group rounded-xl border border-border bg-card p-4 flex items-start gap-3 transition-all duration-200',
        onClick && 'cursor-pointer hover:border-primary/40 hover:shadow-card-hover',
        className,
      )}
    >
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110', tones[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</div>
        <div className="text-xl font-bold text-zinc-100 truncate mt-0.5 font-mono">{value}</div>
        {sub && <div className="text-xs text-zinc-500 truncate mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
