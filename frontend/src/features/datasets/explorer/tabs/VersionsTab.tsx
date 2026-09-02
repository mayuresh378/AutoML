import { useMemo, useState } from 'react';
import { History, Clock, GitCommitHorizontal, Tag, User, MessageSquare, Plus, Copy, Check } from 'lucide-react';
import type { DatasetMeta } from '../types';
import { baseDatasetName, fmt } from '../utils';
import { cn } from '../../../../lib/cn';

interface VersionsTabProps {
  dataset: DatasetMeta;
  datasets: DatasetMeta[];
  onOpenDataset: (name: string) => void;
}

export function VersionsTab({ dataset, datasets, onOpenDataset }: VersionsTabProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const versions = useMemo(() => {
    const base = baseDatasetName(dataset.name);
    const siblings = datasets
      .filter((d) => baseDatasetName(d.name) === base)
      .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
    return siblings;
  }, [dataset, datasets]);

  const currentVersion = dataset.version ?? 1;

  const copy = async (v: DatasetMeta) => {
    await navigator.clipboard.writeText(v.name);
    setCopied(v.name);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-zinc-100">Version History</h3>
          <span className="text-xs text-zinc-500 ml-auto">Base <span className="font-mono text-zinc-400">{baseDatasetName(dataset.name)}</span></span>
        </div>

        {versions.length === 0 ? (
          <p className="text-sm text-zinc-500">No version history for this dataset.</p>
        ) : (
          <div className="relative space-y-0">
            {versions.map((v, i) => {
              const isCurrent = v.name === dataset.name;
              const isLast = i === versions.length - 1;
              return (
                <div key={v.name} className="relative flex gap-4 pb-5 last:pb-0">
                  {!isLast && <span className="absolute left-[7px] top-5 bottom-0 w-px bg-white/[0.07]" />}
                  <div className={cn('relative z-10 w-4 h-4 rounded-full border-2 mt-1 shrink-0', isCurrent ? 'border-primary bg-primary/30' : 'border-zinc-700 bg-card')} />
                  <div className={cn('flex-1 rounded-xl border p-4', isCurrent ? 'border-primary/40 bg-primary/[0.05]' : 'border-border bg-white/[0.02]')}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-zinc-200">{v.name}</span>
                      {isCurrent && <span className="rounded-full bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">Current</span>}
                      <span className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-500">
                        <Clock className="w-3 h-3" /> {fmt.dateTime(v.uploaded_at)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                      <span className="inline-flex items-center gap-1"><GitCommitHorizontal className="w-3 h-3" /> v{v.version ?? 1}</span>
                      <span className="inline-flex items-center gap-1"><Tag className="w-3 h-3" /> {v.source || 'upload'}</span>
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" /> system</span>
                      <span className="inline-flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {v.status}</span>
                      <span>{fmt.int(v.rows)} rows · {v.columns.length} cols</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      {!isCurrent && (
                        <button onClick={() => onOpenDataset(v.name)} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-white hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5">
                          <GitCommitHorizontal className="w-3 h-3" /> Open version
                        </button>
                      )}
                      <button onClick={() => copy(v)} className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:border-primary/40 transition-colors inline-flex items-center gap-1.5">
                        {copied === v.name ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied === v.name ? 'Copied' : 'Copy name'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-3">
        <Plus className="w-4 h-4 text-zinc-500" />
        <p className="text-xs text-zinc-500">New versions are created automatically when you run cleaning or feature engineering. Current version: <span className="font-mono text-zinc-300">v{currentVersion}</span></p>
      </div>
    </div>
  );
}
