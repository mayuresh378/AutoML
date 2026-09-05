import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingUp, Filter, Calendar } from 'lucide-react';
import SectionCard, { SectionRefresh } from './SectionCard';
import { useExperiments } from '../../../hooks/useApi';
import { getErrorMessage } from '../../../services/http';

type MetricDef = {
  key: string;
  label: string;
  unit: '%' | 'raw';
  higherIsBetter: boolean;
  color: string;
};

const METRIC_MAP: Record<string, MetricDef> = {
  accuracy: { key: 'accuracy', label: 'Accuracy', unit: '%', higherIsBetter: true, color: '#34d399' },
  f1: { key: 'f1', label: 'F1 Score', unit: '%', higherIsBetter: true, color: '#22d3ee' },
  precision: { key: 'precision', label: 'Precision', unit: '%', higherIsBetter: true, color: '#818cf8' },
  recall: { key: 'recall', label: 'Recall', unit: '%', higherIsBetter: true, color: '#a78bfa' },
  r2: { key: 'r2', label: 'R² Score', unit: 'raw', higherIsBetter: true, color: '#34d399' },
  rmse: { key: 'rmse', label: 'RMSE', unit: 'raw', higherIsBetter: false, color: '#fbbf24' },
};

function extractValue(exp: any, key: string): number | null {
  const m = exp.metrics || {};
  let v: unknown = null;
  switch (key) {
    case 'accuracy':
      v = m.accuracy ?? m.accuracy_score ?? null;
      break;
    case 'f1':
      v = m.f1_score ?? m.f1 ?? null;
      break;
    case 'precision':
      v = m.precision ?? m.precision_score ?? null;
      break;
    case 'recall':
      v = m.recall ?? m.recall_score ?? null;
      break;
    case 'r2':
      v = m.r2_score ?? m.r2 ?? null;
      break;
    case 'rmse':
      v = m.rmse ?? m.root_mean_squared_error ?? null;
      break;
  }
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  return v;
}

function isClassification(exp: any): boolean {
  const t = String(exp.task_type || exp.problem_type || '').toLowerCase();
  return t.includes('class') || t.includes('binary') || t.includes('multi');
}

function isRegression(exp: any): boolean {
  const t = String(exp.task_type || exp.problem_type || '').toLowerCase();
  return t.includes('regress') || t.includes('forecast') || t.includes('time');
}

function CustomTooltip({ active, payload, label, higherIsBetter, unit }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 shadow-xl">
      <div className="text-[11px] font-mono text-zinc-400 mb-0.5">{label}</div>
      <div className={`text-sm font-bold font-mono tabular-nums ${higherIsBetter ? 'text-emerald-400' : 'text-amber-400'}`}>
        {unit === '%' ? `${(v * 100).toFixed(1)}%` : Number(v).toFixed(3)}
      </div>
    </div>
  );
}

export default function ExperimentPerformanceChart() {
  const experiments = useExperiments();
  const [metricKey, setMetricKey] = useState('accuracy');
  const [timeRange, setTimeRange] = useState('7d');

  interface ChartPoint {
    label: string;
    fullLabel: string;
    value: number;
    date: string | null;
  }

  const { metric, points, availableMetrics, activeMetricKey } = useMemo(() => {
    const exps = (experiments.data ?? []).filter((e) => e.status === 'completed' || e.status === 'success');
    const classification = exps.filter(isClassification);
    const regression = exps.filter(isRegression);

    // Determine the metric list from the (actual) data. Prefer classification
    // metrics if any classification results exist, otherwise regression.
    const preferredKeys = classification.length >= regression.length
      ? ['accuracy', 'f1', 'precision', 'recall']
      : ['r2', 'rmse'];

    const avail = preferredKeys.filter((k) => exps.some((e) => extractValue(e, k) !== null));
    const fallback = (['accuracy', 'f1', 'precision', 'recall', 'r2', 'rmse'] as const).filter(
      (k) => exps.some((e) => extractValue(e, k) !== null),
    );
    const merged = [...avail, ...fallback.filter((k) => !avail.includes(k))];
    const activeKey = merged.includes(metricKey) ? metricKey : merged[0] ?? 'accuracy';

    const now = Date.now();
    const days = timeRange === '30d' ? 30 : 7;
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    const pts: ChartPoint[] = exps
      .filter((e) => {
        const t = e.created_at || e.run_at;
        const tMs = t ? new Date(t).getTime() : 0;
        return tMs >= cutoff;
      })
      .map((e): ChartPoint | null => {
        const v = extractValue(e, activeKey);
        if (v === null) return null;
        const label = e.name || 'Experiment';
        return {
          label: label.length > 18 ? `${label.slice(0, 18)}…` : label,
          fullLabel: label,
          value: v,
          date: e.created_at || e.run_at || null,
        };
      })
      .filter((x): x is ChartPoint => x !== null)
      .sort(
        (a, b) =>
          (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0),
      );

    return { metric: METRIC_MAP[activeKey], points: pts, availableMetrics: merged, activeMetricKey: activeKey };
  }, [experiments.data, metricKey, timeRange]);

  const isFetching = experiments.isFetching;
  const updatedAt = new Date();

  return (
    <SectionCard
      title="Experiment Performance"
      description="Real validation metrics from completed runs"
      icon={<TrendingUp className="w-4 h-4 text-indigo-400" />}
      action={
        <div className="flex items-center gap-2">
          {availableMetrics.length > 1 && (
            <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
              <Filter className="w-3 h-3 text-zinc-500 ml-1" />
              <select
                value={activeMetricKey}
                onChange={(e) => setMetricKey(e.target.value)}
                aria-label="Metric"
                className="bg-transparent text-xs font-mono text-zinc-200 focus:outline-none cursor-pointer pr-1"
              >
                {availableMetrics.map((k) => (
                  <option key={k} value={k} className="bg-zinc-900">
                    {METRIC_MAP[k]?.label ?? k}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg p-1">
            <Calendar className="w-3 h-3 text-zinc-500 ml-1" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              aria-label="Time range"
              className="bg-transparent text-xs font-mono text-zinc-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="7d" className="bg-zinc-900">Last 7</option>
              <option value="30d" className="bg-zinc-900">Last 30</option>
            </select>
          </div>
          <SectionRefresh refetch={experiments.refetch} isFetching={isFetching} updatedAt={updatedAt} />
        </div>
      }
      loading={experiments.isLoading}
      isError={experiments.isError}
      error={getErrorMessage(experiments.error, 'Failed to load experiment performance.')}
      onRetry={experiments.refetch}
      empty={points.length === 0}
      emptyTitle="No experiment data available yet"
      emptyDescription="Completed AutoML runs will appear here with their real validation metrics."
      skeleton={
        <div className="h-64 w-full">
          <div className="w-full h-full bg-white/[0.04] rounded-2xl animate-pulse" />
        </div>
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#71717a' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#71717a' }}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) =>
                metric.unit === '%' ? `${(v * 100).toFixed(0)}%` : Number(v).toFixed(2)
              }
            />
            <Tooltip
              content={({ active, payload, label }) => (
                <CustomTooltip active={active} payload={payload} label={label} higherIsBetter={metric.higherIsBetter} unit={metric.unit} />
              )}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />
            <Line
              type="monotone"
              dataKey="value"
              stroke={metric.color}
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: metric.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {metric.higherIsBetter ? (
        <p className="text-right text-[11px] font-mono text-zinc-500 mt-2">
          Showing {metric.label} · higher is better
        </p>
      ) : (
        <p className="text-right text-[11px] font-mono text-zinc-500 mt-2">
          Showing {metric.label} · lower is better
        </p>
      )}
    </SectionCard>
  );
}