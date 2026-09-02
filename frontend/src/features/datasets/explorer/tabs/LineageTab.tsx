import { useMemo } from 'react';
import { GitBranch, GitMerge, Database, Wand2, Sparkles, ArrowRight, GitCommitHorizontal } from 'lucide-react';
import type { DatasetMeta } from '../types';
import { baseDatasetName } from '../utils';
import { cn } from '../../../../lib/cn';

interface LineageTabProps {
  dataset: DatasetMeta;
  datasets: DatasetMeta[];
  onOpenDataset: (name: string) => void;
}

interface Node {
  name: string;
  version: number;
  label: string;
  kind: 'raw' | 'cleaned' | 'featurized' | 'current';
  description: string;
}

export function LineageTab({ dataset, datasets, onOpenDataset }: LineageTabProps) {
  const nodes = useMemo<Node[]>(() => {
    const base = baseDatasetName(dataset.name);
    const siblings = datasets.filter((d) => baseDatasetName(d.name) === base && d.name !== dataset.name);

    const ordered: Node[] = [];
    const raw = siblings.find((d) => !/^(cleaned|featurized)_/i.test(d.name));
    const cleaned = siblings.find((d) => /^cleaned_/i.test(d.name));
    const featurized = siblings.find((d) => /^featurized_/i.test(d.name));

    if (raw) ordered.push({ name: raw.name, version: raw.version, label: 'Raw Source', kind: 'raw', description: 'Original uploaded data' });
    if (cleaned) ordered.push({ name: cleaned.name, version: cleaned.version, label: 'Cleaned', kind: 'cleaned', description: 'Deduplicated, missing values handled' });
    if (featurized) ordered.push({ name: featurized.name, version: featurized.version, label: 'Featurized', kind: 'featurized', description: 'Feature engineered' });

    const kind: Node['kind'] = /^featurized_/i.test(dataset.name) ? 'featurized' : /^cleaned_/i.test(dataset.name) ? 'cleaned' : 'raw';
    ordered.push({ name: dataset.name, version: dataset.version, label: 'Current View', kind: 'current', description: 'The dataset you are exploring' });
    return ordered;
  }, [dataset, datasets]);

  const related = useMemo(() => datasets.filter((d) => baseDatasetName(d.name) === baseDatasetName(dataset.name)), [dataset, datasets]);

  if (related.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <GitBranch className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">No related datasets found. Lineage chains appear when you create <span className="font-mono text-zinc-400">cleaned_*</span> or <span className="font-mono text-zinc-400">featurized_*</span> derivatives.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <GitBranch className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-zinc-100">Dataset Lineage</h3>
          <span className="text-xs text-zinc-500 ml-auto">{nodes.length} steps · base <span className="font-mono text-zinc-400">{baseDatasetName(dataset.name)}</span></span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {nodes.map((n, i) => {
            const isLast = i === nodes.length - 1;
            return (
              <div key={n.name} className="flex md:flex-1 flex-col md:flex-row md:items-center gap-3">
                <button
                  onClick={() => onOpenDataset(n.name)}
                  className={cn(
                    'group flex-1 rounded-xl border p-4 text-left transition-all',
                    n.kind === 'current'
                      ? 'border-primary/40 bg-primary/[0.06]'
                      : 'border-border bg-white/[0.02] hover:border-primary/40 hover:bg-white/[0.04]',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {n.kind === 'raw' && <Database className="w-4 h-4 text-zinc-400" />}
                    {n.kind === 'cleaned' && <Wand2 className="w-4 h-4 text-emerald-400" />}
                    {n.kind === 'featurized' && <Sparkles className="w-4 h-4 text-fuchsia-400" />}
                    {n.kind === 'current' && <GitCommitHorizontal className="w-4 h-4 text-primary" />}
                    <span className="text-sm font-semibold text-zinc-200 group-hover:text-primary transition-colors">{n.label}</span>
                    {n.kind === 'current' && <span className="rounded-full bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide">You are here</span>}
                  </div>
                  <div className="mt-2 truncate font-mono text-[11px] text-zinc-400">{n.name}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{n.description} · v{n.version}</div>
                </button>
                {!isLast && <ArrowRight className="w-4 h-4 text-zinc-700 shrink-0 rotate-90 md:rotate-0" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <GitMerge className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Related Datasets</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {related.map((d) => (
            <button
              key={d.name}
              onClick={() => onOpenDataset(d.name)}
              className={cn('rounded-xl border border-border bg-white/[0.02] p-4 text-left transition-all hover:border-primary/40 hover:bg-white/[0.04]', d.name === dataset.name && 'border-primary/40')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs text-zinc-300">{d.name}</span>
                <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-zinc-500">v{d.version}</span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">{d.rows.toLocaleString()} rows · {d.columns.length} cols · {d.status}</div>
              <div className="mt-1.5 text-[10px] text-zinc-600">Updated {new Date(d.uploaded_at).toLocaleDateString()}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
