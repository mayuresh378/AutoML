import { useMemo } from 'react';
import { Fingerprint, Target, Info } from 'lucide-react';
import type { DatasetAnalysisResult, DatasetMeta, DatasetProfile } from '../types';
import { dtypeMeta, fmt, gradeColor } from '../utils';
import { cn } from '../../../../lib/cn';

interface SchemaTabProps {
  dataset: DatasetMeta;
  profile?: DatasetProfile;
  analysis?: DatasetAnalysisResult;
  onSelectColumn: (col: string) => void;
  selectedColumn?: string | null;
}

export function SchemaTab({ dataset, profile, analysis, onSelectColumn, selectedColumn }: SchemaTabProps) {
  const roleMap = useMemo(() => {
    const map: Record<string, string> = {};
    const ft = analysis?.feature_types || {};
    for (const [role, cols] of Object.entries(ft)) {
      for (const c of cols || []) map[c] = role;
    }
    return map;
  }, [analysis]);

  const columns = useMemo(() => {
    const cols = profile ? profile.column_details : (dataset.columns || []).map((c) => ({ name: c, dtype: dataset.dtypes?.[c] || 'object' }));
    const rows = profile?.rows ?? (dataset.rows || 0);
    return cols.map((c: any) => {
      const dtype = c.dtype || dataset.dtypes?.[c.name] || 'object';
      const missing = c.missing ?? 0;
      const missingPct = rows ? (missing / rows) * 100 : 0;
      let score = 100 - missingPct * 2;
      if (c.outliers && rows) score -= (c.outliers / rows) * 100 * 2;
      score = Math.max(0, Math.min(100, Math.round(score)));
      return {
        name: c.name,
        dtype,
        role: roleMap[c.name] || dtypeMeta(dtype, c.name).kind,
        missing,
        missingPct,
        score,
      };
    });
  }, [profile, dataset, roleMap]);

  const target = analysis?.target;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Info className="w-4 h-4 text-primary" />
          <span className="text-zinc-300 font-medium">{columns.length} columns</span>
          <span className="text-zinc-600">· click a column to inspect its profile</span>
        </div>
      </div>
      <div className="overflow-auto max-h-[62vh]">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-2.5 font-semibold">#</th>
              <th className="px-4 py-2.5 font-semibold">Column</th>
              <th className="px-4 py-2.5 font-semibold">Type</th>
              <th className="px-4 py-2.5 font-semibold">Role</th>
              <th className="px-4 py-2.5 font-semibold text-right">Missing</th>
              <th className="px-4 py-2.5 font-semibold w-44">Quality</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((c, i) => {
              const meta = dtypeMeta(c.dtype, c.name);
              const isSelected = c.name === selectedColumn;
              const isTarget = c.name === target;
              return (
                <tr
                  key={c.name}
                  onClick={() => onSelectColumn(c.name)}
                  className={cn(
                    'border-b border-white/[0.04] cursor-pointer transition-colors',
                    isSelected ? 'bg-primary/[0.07]' : 'hover:bg-white/[0.02]',
                  )}
                >
                  <td className="px-4 py-2.5 text-zinc-600 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <meta.Icon className="w-3.5 h-3.5" style={{ color: meta.hex }} />
                      <span className={cn('font-mono text-[13px] font-medium', isSelected ? 'text-primary' : 'text-zinc-200')}>{c.name}</span>
                      {isTarget && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 px-1.5 py-px text-[9px] font-medium">
                          <Target className="w-2 h-2" /> target
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', meta.cls)}>{c.dtype}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-400 capitalize">
                      {c.role === 'id' && <Fingerprint className="w-3 h-3 text-zinc-500" />}
                      {c.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {c.missing > 0 ? (
                      <span className={cn('font-mono text-xs', c.missingPct > 20 ? 'text-red-400' : c.missingPct > 5 ? 'text-amber-400' : 'text-zinc-300')}>
                        {fmt.int(c.missing)} · {fmt.pct(c.missingPct)}
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-emerald-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.score}%`, backgroundColor: gradeColor(c.score >= 90 ? 'A' : c.score >= 80 ? 'B' : c.score >= 65 ? 'C' : c.score >= 50 ? 'D' : 'F') }} />
                      </div>
                      <span className="w-8 text-right text-[10px] font-mono text-zinc-500">{c.score}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
