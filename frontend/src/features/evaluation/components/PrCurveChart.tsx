import { memo, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { PrCurveData } from '../services/evaluation.service';
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
const PALETTE = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#38bdf8', '#fb7185', '#a3e635'];

interface Props {
  data: PrCurveData | null;
  reason?: string;
}

export const PrCurveChart = memo(function PrCurveChart({ data, reason }: Props) {
  const isMulticlass = Boolean(data?.per_class?.length);
  const classes = data?.per_class ?? [];
  const overall = data?.average_precision ?? data?.macro_ap;

  const chartData = useMemo(() => {
    if (!data) return [];
    if (isMulticlass) {
      const maxLen = Math.max(...classes.map((c) => c.recall.length));
      return Array.from({ length: maxLen }, (_, i) => {
        const point: Record<string, number | null> = { index: i };
        classes.forEach((c) => {
          const r = c.recall[i];
          point[c.label] = r == null ? null : c.precision[i];
        });
        return point;
      });
    }
    return (data.recall ?? []).map((recall, i) => ({ recall, precision: data.precision[i] }));
  }, [data, isMulticlass, classes]);

  if (!data || !chartData.length) {
    return (
      <ChartCard title="Precision-Recall curve" subtitle="Precision vs recall">
        <div className="min-h-[200px] grid place-items-center text-sm text-zinc-500 text-center px-4">
          {reason ?? 'Not available for this run.'}
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Precision-Recall curve"
      subtitle={
        isMulticlass
          ? 'One-vs-rest per class'
          : 'Useful when the positive class is rare'
      }
      stats={
        overall != null
          ? [{ label: isMulticlass ? 'Macro AP' : 'Avg precision', value: overall.toFixed(4) }]
          : undefined
      }
    >
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis
              dataKey={isMulticlass ? 'index' : 'recall'}
              type="number"
              domain={isMulticlass ? ['dataMin', 'dataMax'] : [0, 1]}
              tick={AXIS}
              stroke={AXIS.stroke}
              label={{ value: 'Recall', position: 'insideBottom', offset: -4, fill: AXIS.stroke, fontSize: 11 }}
            />
            <YAxis
              type="number"
              domain={[0, 1]}
              tick={AXIS}
              stroke={AXIS.stroke}
              label={{ value: 'Precision', angle: -90, position: 'insideLeft', fill: AXIS.stroke, fontSize: 11 }}
            />
            <Tooltip {...TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {isMulticlass
              ? classes.map((c, i) => (
                  <Area
                    key={c.label}
                    type="monotone"
                    dataKey={c.label}
                    name={`${c.label} (AP ${c.ap?.toFixed(3) ?? '—'})`}
                    stroke={PALETTE[i % PALETTE.length]}
                    strokeWidth={1.8}
                    fill="none"
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))
              : (
                <Area
                  type="monotone"
                  dataKey="precision"
                  name={overall != null ? `Precision-Recall (AP ${overall.toFixed(3)})` : 'Precision-Recall'}
                  stroke={PALETTE[1]}
                  strokeWidth={2}
                  fill="rgba(52,211,153,0.12)"
                  dot={false}
                  isAnimationActive={false}
                />
              )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
});
