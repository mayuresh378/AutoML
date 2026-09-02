import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie, Legend } from 'recharts';
import { BarChart3, PieChart as PieIcon, Hash, Type } from 'lucide-react';
import type { DatasetAnalysisResult, DatasetProfile, DatasetPreview } from '../types';
import { dtypeMeta, fmt, gradeColor } from '../utils';
import { cn } from '../../../../lib/cn';

interface DistributionTabProps {
  analysis?: DatasetAnalysisResult;
  profile?: DatasetProfile;
  preview?: DatasetPreview;
  onSelectColumn: (col: string) => void;
  selectedColumn?: string | null;
}

const PALETTE = ['#38bdf8', '#a78bfa', '#fbbf24', '#34d399', '#f472b6', '#fb7185', '#60a5fa', '#c084fc', '#facc15', '#4ade80'];

export function DistributionTab({ analysis, profile, preview, onSelectColumn, selectedColumn }: DistributionTabProps) {
  const histograms = analysis?.distributions?.columns || [];

  const histData = useMemo(() => {
    const out: { col: string; meta: ReturnType<typeof dtypeMeta>; data: { name: string; count: number }[]; mean: number }[] = [];
    for (const h of histograms) {
      const data = h.bins.map((b, i) => {
        const mid = ((h.bin_edges[i] ?? 0) + (h.bin_edges[i + 1] ?? 0)) / 2;
        return { name: mid >= 1000 ? fmt.num(mid) : Number(mid.toFixed(1)).toString(), count: b };
      });
      out.push({ col: h.column, meta: dtypeMeta('numeric', h.column), data, mean: h.mean });
    }
    return out;
  }, [histograms]);

  const classImb = analysis?.class_imbalance;
  const pieData = useMemo(() => {
    if (!classImb?.detected || !classImb.distribution) return [];
    return Object.entries(classImb.distribution)
      .map(([k, v]) => ({ name: k, value: v.count, pct: v.pct }))
      .sort((a, b) => b.value - a.value);
  }, [classImb]);

  const catCols = useMemo(() => {
    if (!profile?.column_details) return [];
    return profile.column_details
      .filter((c) => !/int|float|number/.test(c.dtype.toLowerCase()) && c.top_values)
      .slice(0, 6)
      .map((c) => ({
        name: c.name,
        dtype: c.dtype,
        values: Object.entries(c.top_values || {}).slice(0, 6),
      }));
  }, [profile]);

  if (histData.length === 0 && pieData.length === 0 && catCols.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <BarChart3 className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">No distribution data available for this dataset.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pieData.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-4 h-4 text-fuchsia-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Class Distribution — target “{classImb?.target}”</h3>
            <span className="text-xs text-zinc-500 ml-auto">{classImb?.classes} classes · ratio {classImb?.imbalance_ratio}x</span>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="h-52 w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="#18181b" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }}
                    formatter={(value: any, name: any) => [`${value.toLocaleString()} rows`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full space-y-2">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                  <span className="text-xs text-zinc-300 font-mono truncate flex-1">{d.name}</span>
                  <div className="w-32 h-1.5 rounded-full bg-white/[0.06] overflow-hidden shrink-0">
                    <div className="h-full rounded-full" style={{ width: `${d.pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                  </div>
                  <span className="w-14 text-right text-[10px] font-mono text-zinc-500">{fmt.dec(d.pct, 1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {histData.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Hash className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Numeric Distributions</h3>
            <span className="text-xs text-zinc-500">{histData.length} columns · click a card to inspect</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {histData.map((h) => (
              <button
                key={h.col}
                onClick={() => onSelectColumn(h.col)}
                className={cn(
                  'rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40',
                  selectedColumn === h.col && 'border-primary/50 bg-primary/[0.03]',
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-zinc-200 font-mono truncate">{h.col}</span>
                  <span className={cn('inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-medium', h.meta.cls)}>numeric</span>
                </div>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={h.data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 8 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 10 }}
                      />
                      <Bar dataKey="count" radius={[2, 2, 0, 0]} fill={h.meta.hex} fillOpacity={0.75} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>mean {fmt.dec(h.mean, 2)}</span>
                  <span>{h.data.length} bins</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {catCols.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Type className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Categorical Distributions</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {catCols.map((c) => {
              const meta = dtypeMeta(c.dtype, c.name);
              const total = c.values.reduce((a, [, n]) => a + n, 0) || 1;
              return (
                <button
                  key={c.name}
                  onClick={() => onSelectColumn(c.name)}
                  className={cn(
                    'rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40',
                    selectedColumn === c.name && 'border-primary/50 bg-primary/[0.03]',
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-zinc-200 font-mono truncate">{c.name}</span>
                    <span className={cn('inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-medium', meta.cls)}>{c.dtype}</span>
                  </div>
                  <div className="space-y-1.5">
                    {c.values.map(([v, n]) => {
                      const pct = (n / total) * 100;
                      return (
                        <div key={v} className="flex items-center gap-2">
                          <div className="relative flex-1 h-4 rounded bg-white/[0.04] overflow-hidden">
                            <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, backgroundColor: `${meta.hex}40` }} />
                            <span className="relative px-1.5 text-[10px] text-zinc-300 font-mono truncate leading-4 block">{String(v).slice(0, 24)}</span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-500 w-10 text-right">{Math.round(pct)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
