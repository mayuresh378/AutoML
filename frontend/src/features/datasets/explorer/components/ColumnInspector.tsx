import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, ReferenceLine } from 'recharts';
import { X, Hash, Type, CheckCircle, CalendarDays, Fingerprint, HelpCircle, Layers, TrendingUp, Target } from 'lucide-react';
import type { DatasetAnalysisResult, DatasetPreview, DatasetProfile } from '../types';
import { dtypeMeta, fmt, gradeColor } from '../utils';
import { cn } from '../../../../lib/cn';

interface ColumnInspectorProps {
  column: string;
  profile?: DatasetProfile;
  analysis?: DatasetAnalysisResult;
  preview?: DatasetPreview;
  onClose?: () => void;
}

export function ColumnInspector({ column, profile, analysis, preview, onClose }: ColumnInspectorProps) {
  const colProfile = useMemo(
    () => profile?.column_details?.find((c) => c.name === column),
    [profile, column],
  );
  const histogram = useMemo(
    () => analysis?.distributions?.columns?.find((c) => c.column === column),
    [analysis, column],
  );

  const dtype = profile?.dtypes?.[column] || preview?.dtypes?.[column] || 'object';
  const meta = dtypeMeta(dtype, column);
  const rows = profile?.rows ?? preview?.total ?? 0;
  const missing = colProfile?.missing ?? 0;
  const missingPct = rows ? (missing / rows) * 100 : 0;

  const isNumeric = meta.kind === 'numeric';

  const qualityScore = useMemo(() => {
    let s = 100;
    s -= missingPct * 2;
    if (isNumeric && colProfile?.outliers && rows) s -= (colProfile.outliers / rows) * 100 * 2;
    if (meta.kind === 'id') s -= 0;
    return Math.max(0, Math.min(100, Math.round(s)));
  }, [missingPct, isNumeric, colProfile?.outliers, rows, meta.kind]);

  const qualityGrade = qualityScore >= 90 ? 'A' : qualityScore >= 80 ? 'B' : qualityScore >= 65 ? 'C' : qualityScore >= 50 ? 'D' : 'F';

  const histData = useMemo(() => {
    if (!histogram || !histogram.bins?.length) return null;
    return histogram.bins.map((b, i) => {
      const mid = ((histogram.bin_edges[i] ?? 0) + (histogram.bin_edges[i + 1] ?? 0)) / 2;
      return { name: mid >= 1000 ? fmt.num(mid) : Number(mid.toFixed(2)).toString(), count: b, mid };
    });
  }, [histogram]);

  const topValues = useMemo(() => {
    if (colProfile?.top_values) {
      return Object.entries(colProfile.top_values).slice(0, 8);
    }
    if (preview?.rows?.length) {
      const counts = new Map<string, number>();
      for (const r of preview.rows) {
        const v = r[column];
        if (v == null || v === '') continue;
        const s = String(v);
        counts.set(s, (counts.get(s) || 0) + 1);
      }
      return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
    }
    return [];
  }, [colProfile, preview, column]);

  const sampleValues = useMemo(() => {
    if (!preview?.rows?.length) return [];
    return preview.rows.map((r) => r[column]).filter((v) => v != null && v !== '').slice(0, 8);
  }, [preview, column]);

  const statItems: { label: string; value: React.ReactNode; numeric?: boolean }[] = [];
  if (isNumeric) {
    statItems.push({ label: 'Mean', value: fmt.dec(colProfile?.mean, 3) });
    statItems.push({ label: 'Median', value: fmt.dec(colProfile?.median, 3) });
    statItems.push({ label: 'Std Dev', value: fmt.dec(colProfile?.std, 3) });
    statItems.push({ label: 'Min', value: fmt.dec(colProfile?.min, 3) });
    statItems.push({ label: 'Max', value: fmt.dec(colProfile?.max, 3) });
    statItems.push({ label: 'Outliers', value: fmt.int(colProfile?.outliers) });
  } else {
    statItems.push({ label: 'Unique', value: fmt.int(colProfile?.unique_values) });
  }
  statItems.unshift(
    { label: 'Missing', value: `${fmt.dec(missing)} (${fmt.pct(missingPct)})` },
    { label: 'Rows', value: fmt.int(rows) },
  );

  const isTarget = analysis?.target === column;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-white/[0.02]">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', meta.cls)}>
            <meta.Icon className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100 truncate">{column}</h3>
              {isTarget && (
                <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 px-2 py-0.5 text-[9px] font-medium">
                  <Target className="w-2.5 h-2.5" /> TARGET
                </span>
              )}
            </div>
            <span className={cn('inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-medium mt-0.5', meta.cls)}>
              {meta.label}
            </span>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Column Quality</span>
            <span className="text-xs font-bold" style={{ color: gradeColor(qualityGrade) }}>{qualityScore}/100 · {qualityGrade}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${qualityScore}%`, backgroundColor: gradeColor(qualityGrade) }} />
          </div>
        </div>

        <div>
          <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">Statistics</h4>
          <div className="grid grid-cols-3 gap-2">
            {statItems.map((s) => (
              <div key={s.label} className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-2.5 py-2">
                <div className="text-[9px] uppercase tracking-wider text-zinc-600">{s.label}</div>
                <div className="text-sm font-semibold text-zinc-200 font-mono mt-0.5 truncate">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {histData && (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">Distribution</h4>
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] p-2 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={20} />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: '#a1a1aa' }}
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {histData.map((_, i) => (
                      <Cell key={i} fill={meta.hex} fillOpacity={0.75} />
                    ))}
                  </Bar>
                  {histogram && (
                    <ReferenceLine x={histogram.mean >= 1000 ? fmt.num(histogram.mean) : Number(histogram.mean.toFixed(2)).toString()} stroke="#f4f4f5" strokeDasharray="4 4" strokeOpacity={0.6} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {histogram && (
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-500">
                <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> skew {histogram.skewness > 0 ? '+' : ''}{histogram.skewness}</span>
                <span className="inline-flex items-center gap-1"><Layers className="w-3 h-3" /> {histogram.bins.length} bins</span>
              </div>
            )}
          </div>
        )}

        {topValues.length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">Top Values</h4>
            <div className="space-y-1.5">
              {topValues.map(([value, count]) => {
                const total = rows || 1;
                const pct = Math.round((count / total) * 1000) / 10;
                return (
                  <div key={value} className="flex items-center gap-2">
                    <div className="relative flex-1 h-5 rounded bg-white/[0.04] overflow-hidden">
                      <div className="absolute inset-y-0 left-0" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: `${meta.hex}40` }} />
                      <span className="relative px-2 text-[11px] text-zinc-200 font-mono truncate leading-5 block">{String(value).length > 30 ? String(value).slice(0, 29) + '…' : String(value)}</span>
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono w-14 text-right shrink-0">{fmt.dec(count)} · {pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sampleValues.length > 0 && (
          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-2">Sample Values</h4>
            <div className="flex flex-wrap gap-1.5">
              {sampleValues.map((v, i) => (
                <span key={i} className="rounded-md bg-white/[0.04] border border-white/[0.05] px-2 py-1 text-[11px] font-mono text-zinc-300">
                  {String(v).length > 24 ? String(v).slice(0, 23) + '…' : String(v)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
