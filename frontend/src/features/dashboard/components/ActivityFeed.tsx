import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History, FlaskConical, Cpu, Database, Server, Activity as ActivityIcon, ArrowRight,
} from 'lucide-react';
import SectionCard, { SectionRefresh } from './SectionCard';
import { useActivity } from '../../../hooks/useApi';
import { getErrorMessage } from '../../../services/http';

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function pickIcon(item: any) {
  const r = String(item.resource_type || '').toLowerCase();
  if (r.includes('experiment')) return <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />;
  if (r.includes('model')) return <Cpu className="w-3.5 h-3.5 text-emerald-400" />;
  if (r.includes('dataset')) return <Database className="w-3.5 h-3.5 text-cyan-400" />;
  if (r.includes('deploy')) return <Server className="w-3.5 h-3.5 text-amber-400" />;
  return <ActivityIcon className="w-3.5 h-3.5 text-zinc-400" />;
}

export default function ActivityFeed() {
  const navigate = useNavigate();
  const activity = useActivity();
  const updatedAt = new Date();
  const isFetching = activity.isFetching;

  const items = useMemo(() => (activity.data ?? []).slice(0, 8), [activity.data]);

  return (
    <SectionCard
      title="Recent Activity"
      description="Latest workspace events"
      icon={<History className="w-4 h-4 text-indigo-400" />}
      action={
        <div className="flex items-center gap-1.5">
          <SectionRefresh refetch={activity.refetch} isFetching={isFetching} updatedAt={updatedAt} />
          <button
            onClick={() => navigate('/app/settings')}
            className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
          >
            View All <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      }
      loading={activity.isLoading}
      isError={activity.isError}
      error={getErrorMessage(activity.error, 'Failed to load activity.')}
      onRetry={activity.refetch}
      empty={items.length === 0}
      emptyIcon={<History className="w-8 h-8 text-indigo-400" />}
      emptyTitle="No activity yet"
      emptyDescription="Actions you take across the platform will appear here."
      skeleton={
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-white/[0.04] animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-white/[0.05] rounded animate-pulse" style={{ width: `${70 - i * 8}%` }} />
                <div className="h-3 bg-white/[0.04] rounded animate-pulse" style={{ width: '35%' }} />
              </div>
            </div>
          ))}
        </div>
      }
    >
      <div className="relative">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/10" />
        <ol className="space-y-3">
          {items.map((item) => {
            const actor = item.actor || 'System';
            const action = item.action;
            const target = item.target;
            const ts = (item as any).time || (item as any).created_at;
            const desc = [action, target].filter(Boolean).join(' · ');
            return (
              <li key={item.id} className="relative flex items-start gap-3 pl-0">
                <span className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 shrink-0">
                  {pickIcon(item)}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-xs text-zinc-300 leading-snug truncate">
                    {desc}
                  </p>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {actor} · {relativeTime(ts)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </SectionCard>
  );
}