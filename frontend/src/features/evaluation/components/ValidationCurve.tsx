import { memo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import type { ValidationCurveData } from '../services/evaluation.service';
import styles from './ValidationCurve.module.css';

interface Props {
  data: ValidationCurveData;
}

export const ValidationCurve = memo(function ValidationCurve({ data }: Props) {
  if (!data || data.error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Validation Curve</h3>
        </div>
        <div className={styles.error}>{data?.error || 'No data available'}</div>
      </div>
    );
  }

  const chartData = data.param_range.map((param, i) => ({
    param,
    train_mean: data.train_mean[i],
    val_mean: data.val_mean[i],
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Validation Curve</h3>
        <span className={styles.badge}>Parameter: {data.param_name}</span>
      </div>
      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="param"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              label={{ value: data.param_name, position: 'bottom', offset: 0, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
            />
            <YAxis
              type="number"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              label={{ value: data.scoring, angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
            />
            <Tooltip
              contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
              formatter={(value: number, name: string) => [typeof value === 'number' ? value.toFixed(4) : value, name]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="train_mean"
              name="Training Score"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#6366f1' }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="val_mean"
              name="Validation Score"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#f59e0b' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.insight}>
        {data.val_mean.length > 1 && data.val_mean[0] < data.val_mean[data.val_mean.length - 1]
          ? `Performance improves with higher ${data.param_name}. Try increasing it further.`
          : data.val_mean.length > 1 && data.val_mean[0] > data.val_mean[data.val_mean.length - 1]
          ? `Performance degrades with higher ${data.param_name}. A lower value may be better.`
          : `Optimal ${data.param_name} found in the tested range.`}
      </div>
    </div>
  );
});
