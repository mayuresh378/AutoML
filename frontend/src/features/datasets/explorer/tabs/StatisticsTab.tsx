import { useMemo } from 'react';
import { Info, SlidersHorizontal } from 'lucide-react';
import type { DatasetAnalysisResult, DatasetMeta, DatasetProfile, DatasetPreview } from '../types';
import { dtypeMeta, fmt } from '../utils';
import { cn } from '../../../../lib/cn';

interface StatisticsTabProps {
  dataset: DatasetMeta;
  profile?: DatasetProfile;
  analysis?: DatasetAnalysisResult;
  preview?: DatasetPreview;
  onSelectColumn: (col: string) => void;
  selectedColumn?: string | null;
}

export function StatisticsTab({ dataset, profile, analysis, preview, onSelectColumn, selectedColumn }: StatisticsTabProps) {
  const rows = useMemo(() => {
    if (!profile?.column_details?.length) return [];
    return profile.column_details.map((c) => ({
      name: c.name,
      dtype: c.dtype,
      isNumeric: /int|float|number/.test(c.dtype.toLowerCase()),
      missing: c.missing,
      unique: c.unique_values,
      mean: c.mean,
      median: c.median,
      std: c.std,
      min: c.min,
      max: c.max,
      outliers: c.outliers,
      top: c.top_values ? Object.entries(c.top_values).slice(0, 3) : [],
    }));
  }, [profile]);

  const numericCols = rows.filter((r) => r.isNumeric).length;
  const catCols = rows.length - numericCols;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-zinc-500">
        Statistics unavailable. Load the dataset profile to compute column-level metrics.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
          <SlidersHorizontal className="w-4 h-4 text-sky-400" />
          <div>
            <div className="text-xs text-zinc-500">Numeric columns</div>
            <div className="text-lg font-semibold text-zinc-100 font-mono">{numericCols}</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
          <Info className="w-4 h-4 text-amber-400" />
          <div>
            <div className="text-xs text-zinc-500">Categorical columns</div>
            <div className="text-lg font-semibold text-zinc-100 font-mono">{catCols}</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
          <div>
            <div className="text-xs text-zinc-500">Descriptive statistics</div>
            <div className="text-[13px] text-zinc-300">Computed from full dataset via profile</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-auto max-h-[64vh]">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-zinc-500 text-left">
                <th className="px-4 py-2.5 font-semibold">Column</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-3 py-2.5 font-semibold text-right">Missing</th>
                <th className="px-3 py-2.5 font-semibold text-right">Unique</th>
                <th className="px-3 py-2.5 font-semibold text-right">Mean</th>
                <th className="px-3 py-2.5 font-semibold text-right">Median</th>
                <th className="px-3 py-2.5 font-semibold text-right">Std Dev</th>
                <th className="px-3 py-2.5 font-semibold text-right">Min</th>
                <th className="px-3 py-2.5 font-semibold text-right">Max</th>
                <th className="px-3 py-2.5 font-semibold text-right">Outliers</th>
                <th className="px-4 py-2.5 font-semibold">Top Values</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const meta = dtypeMeta(c.dtype, c.name);
                const isSelected = c.name === selectedColumn;
                return (
                  <tr
                    key={c.name}
                    onClick={() => onSelectColumn(c.name)}
                    className={cn(
                      'border-b border-white/[0.04] cursor-pointer transition-colors',
                      isSelected ? 'bg-primary/[0.07]' : 'hover:bg-white/[0.02]',
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <meta.Icon className="w-3.5 h-3.5" style={{ color: meta.hex }} />
                        <span className={cn('font-mono text-[13px] font-medium', isSelected ? 'text-primary' : 'text-zinc-200')}>{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium', meta.cls)}>{c.dtype}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-zinc-300">{c.missing > 0 ? fmt.int(c.missing) : <span className="text-emerald-400">0</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-zinc-300">{c.unique != null ? fmt.int(c.unique) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-zinc-300">{c.isNumeric ? fmt.dec(c.mean, 3) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-zinc-300">{c.isNumeric ? fmt.dec(c.median, 3) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-zinc-300">{c.isNumeric ? fmt.dec(c.std, 3) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-zinc-300">{c.isNumeric ? fmt.dec(c.min, 3) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-zinc-300">{c.isNumeric ? fmt.dec(c.max, 3) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {c.isNumeric && c.outliers != null ? (
                        c.outliers > 0 ? <span className="text-amber-400">{fmt.int(c.outliers)}</span> : <span className="text-emerald-400">0</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.top.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.top.map(([v, n]) => (
                            <span key={v} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono text-zinc-400" title={String(v)}>
                              {String(v).slice(0, 12)}{String(v).length > 12 ? '…' : ''} <span className="text-zinc-600">{n}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
