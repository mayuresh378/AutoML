import { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from 'recharts';
import {
  LineChart, Line,
} from 'recharts';
import type { PredictionDistributionData } from '../services/evaluation.service';
import styles from './PredictionDistribution.module.css';

interface Props {
  data: PredictionDistributionData;
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export const PredictionDistribution = memo(function PredictionDistribution({ data }: Props) {
  if (!data) return null;

  if (data.type === 'classification') {
    const chartData = (data.predictions as { label: string; count: number; pct: number }[]).map((d) => ({
      name: d.label,
      count: d.count,
      pct: d.pct,
    }));

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Prediction Distribution</h3>
          <span className={styles.badge}>Classification — {data.total} predictions</span>
        </div>
        <div className={styles.chartArea}>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                label={{ value: 'Count', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
              />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => [name === 'pct' ? `${value.toFixed(1)}%` : value, name === 'pct' ? 'Percentage' : 'Count']}
              />
              <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Class</th>
                <th className={styles.th}>Count</th>
                <th className={styles.th}>Percentage</th>
                <th className={styles.th}>Distribution</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((d, i) => (
                <tr key={i} className={styles.row}>
                  <td className={styles.cellLabel}>{d.name}</td>
                  <td className={styles.cellValue}>{d.count.toLocaleString()}</td>
                  <td className={styles.cellValue}>{d.pct.toFixed(1)}%</td>
                  <td className={styles.cellBar}>
                    <div className={styles.barTrack}>
                      <div className={styles.barFill} style={{ width: `${d.pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const preds = data.predictions as number[];
  const min = data.min ?? Math.min(...preds);
  const max = data.max ?? Math.max(...preds);
  const numBins = 25;
  const binWidth = (max - min) / numBins || 1;
  const bins: { bin: string; count: number }[] = [];
  for (let i = 0; i < numBins; i++) {
    const lo = min + i * binWidth;
    const hi = lo + binWidth;
    const count = preds.filter((p) => p >= lo && (i === numBins - 1 ? p <= hi : p < hi)).length;
    bins.push({ bin: `${lo.toFixed(2)}`, count });
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Prediction Distribution</h3>
        <span className={styles.badge}>Regression — {preds.length} predictions</span>
      </div>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Mean</span>
          <span className={styles.statValue}>{data.mean?.toFixed(4)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Std Dev</span>
          <span className={styles.statValue}>{data.std?.toFixed(4)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Min</span>
          <span className={styles.statValue}>{data.min?.toFixed(4)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Max</span>
          <span className={styles.statValue}>{data.max?.toFixed(4)}</span>
        </div>
      </div>
      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={bins} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="bin"
              tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
              label={{ value: 'Predicted Value', position: 'bottom', offset: 0, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              label={{ value: 'Frequency', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
            />
            <Tooltip
              contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
              formatter={(value: number) => [value, 'Count']}
            />
            <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
              {bins.map((_, i) => (
                <Cell key={i} fill="#6366f1" fillOpacity={0.6 + (i / numBins) * 0.4} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
