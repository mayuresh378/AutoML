import { memo, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import type { FeatureImportanceItem } from '../services/evaluation.service';
import { ChartCard } from './ChartCard';

const AXIS = { stroke: 'var(--color-text-tertiary)', fontSize: 11 };
const GRID = 'rgba(255,255,255,0.07)';
const TOOLTIP = {
  contentStyle: {
    background: '#0b0b12',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: '#fff' },
};

const GRADIENT = ['#6366f1', '#818cf8', '#a5b4fc'];
const MAX_DEFAULT = 12;

interface Props {
  data: FeatureImportanceItem[];
}

export const FeatureImportanceChart = memo(function FeatureImportanceChart({ data }: Props) {
  const [limit, setLimit] = useState(MAX_DEFAULT);

  // Show the strongest contributors first; the full list stays reachable.
  const sorted = useMemo(
    () => [...(data ?? [])].sort((a, b) => Math.abs(b.importance) - Math.abs(a.importance)),
    [data],
  );
  const chartData = useMemo(
    () => sorted.slice(0, limit).map((f) => ({ ...f, short: truncate(f.feature, 26) })),
    [sorted, limit],
  );
  const totalAbs = sorted.reduce((s, f) => s + Math.abs(f.importance), 0);
  const positiveOnly = sorted.every((f) => f.importance >= 0);

  if (!sorted.length) {
    return (
      <ChartCard title="Feature importance" subtitle="Which inputs drive the model">
        <div className="min-h-[200px] grid place-items-center text-sm text-zinc-500 text-center px-4">
          This model does not expose feature importances, so nothing can be shown here.
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Feature importance"
      subtitle={
        positiveOnly
          ? 'Relative contribution of each input'
          : 'Signed contribution: negative values push the prediction the other way'
      }
      stats={[{ label: 'Features', value: String(sorted.length) }]}
      actions={
        sorted.length > MAX_DEFAULT ? (
          <button
            type="button"
            onClick={() => setLimit(limit === MAX_DEFAULT ? sorted.length : MAX_DEFAULT)}
            className="rounded border border-border bg-surface px-3 py-1 text-xs font-medium text-zinc-300 transition-colors hover:border-[rgba(255,255,255,0.22)] hover:text-white"
          >
            {limit === MAX_DEFAULT ? `Show all ${sorted.length}` : 'Show top 12'}
          </button>
        ) : undefined
      }
    >
      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 28, bottom: 4, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" tick={AXIS} stroke={AXIS.stroke} />
            <YAxis
              type="category"
              dataKey="short"
              width={168}
              tick={AXIS}
              stroke={AXIS.stroke}
              tickFormatter={(v: string) => v}
            />
            <Tooltip
              {...TOOLTIP}
              formatter={(v: number) => [
                `${Number(v).toFixed(5)}${totalAbs > 0 ? ` (${((Math.abs(v) / totalAbs) * 100).toFixed(1)}%)` : ''}`,
                'importance',
              ]}
              labelFormatter={(l) => {
                const row = chartData.find((r) => r.short === l);
                return row?.feature ?? String(l);
              }}
            />
            <Bar dataKey="importance" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={GRADIENT[Math.min(2, Math.floor((i / Math.max(chartData.length, 1)) * 3))]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
});

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
