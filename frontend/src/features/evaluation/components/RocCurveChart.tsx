import { memo, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { RocCurveData } from '../services/evaluation.service';
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
  data: RocCurveData | null;
  reason?: string;
}

/** One-vs-rest ROC for multiclass, single curve for binary. */
export const RocCurveChart = memo(function RocCurveChart({ data, reason }: Props) {
  const isMulticlass = Boolean(data?.per_class?.length);
  const overall = data?.auc ?? data?.macro_auc;

  const chartData = useMemo(() => {
    if (!data) return [];
    if (isMulticlass) {
      const classes = data.per_class ?? [];
      const maxLen = Math.max(...classes.map((c) => c.fpr.length));
      return Array.from({ length: maxLen }, (_, i) => {
        const point: Record<string, number | null> = { index: i };
        classes.forEach((c) => {
          const f = c.fpr[i];
          point[c.label] = f == null ? null : c.tpr[i];
        });
        return point;
      });
    }
    return (data.fpr ?? []).map((fpr, i) => ({ fpr, tpr: data.tpr[i] }));
  }, [data, isMulticlass]);

  const classes = data?.per_class ?? [];

  if (!data || (!chartData.length && !isMulticlass)) {
    return (
      <ChartCard title="ROC curve" subtitle="True positive rate vs false positive rate">
        <div className="min-h-[200px] grid place-items-center text-sm text-zinc-500 text-center px-4">
          {reason ?? 'Not available for this run.'}
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="ROC curve"
      subtitle={
        isMulticlass
          ? 'One-vs-rest per class · diagonal is random guessing'
          : 'Higher curve is better · diagonal is random guessing'
      }
      stats={
        overall != null
          ? [{ label: isMulticlass ? 'Macro AUC' : 'AUC', value: overall.toFixed(4) }]
          : undefined
      }
    >
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: -18 }}>
            <defs>
              {(isMulticlass ? classes.map((_, i) => cKey(i)) : [cKey(0)]).map((key) => (
                <linearGradient key={key} id={`roc-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE[0]} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={PALETTE[0]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis
              dataKey={isMulticlass ? 'index' : 'fpr'}
              type="number"
              domain={isMulticlass ? ['dataMin', 'dataMax'] : [0, 1]}
              tick={AXIS}
              stroke={AXIS.stroke}
              label={{ value: 'False positive rate', position: 'insideBottom', offset: -4, fill: AXIS.stroke, fontSize: 11 }}
            />
            <YAxis
              type="number"
              domain={[0, 1]}
              tick={AXIS}
              stroke={AXIS.stroke}
              label={{ value: 'True positive rate', angle: -90, position: 'insideLeft', fill: AXIS.stroke, fontSize: 11 }}
            />
            <Tooltip {...TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine
              y={0.5}
              x={0.5}
              stroke="rgba(255,255,255,0.22)"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />
            {isMulticlass
              ? classes.map((c, i) => (
                  <Area
                    key={c.label}
                    type="monotone"
                    dataKey={c.label}
                    name={`${c.label} (AUC ${c.auc?.toFixed(3) ?? '—'})`}
                    stroke={PALETTE[i % PALETTE.length]}
                    strokeWidth={1.8}
                    fill={`url(#roc-${cKey(i)})`}
                    fillOpacity={0.06}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))
              : (
                <Area
                  type="monotone"
                  dataKey="tpr"
                  name={overall != null ? `ROC (AUC ${overall.toFixed(3)})` : 'ROC'}
                  stroke={PALETTE[0]}
                  strokeWidth={2}
                  fill="url(#roc-c0)"
                  fillOpacity={0.12}
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

const cKey = (i: number) => `c${i}`;
