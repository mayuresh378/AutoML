import { memo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { LearningCurveData } from '../services/evaluation.service';
import styles from './LearningCurve.module.css';

interface Props {
  data: LearningCurveData;
}

export const LearningCurve = memo(function LearningCurve({ data }: Props) {
  if (!data || data.error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Learning Curve</h3>
        </div>
        <div className={styles.error}>{data?.error || 'No data available'}</div>
      </div>
    );
  }

  const chartData = data.train_sizes.map((size, i) => ({
    size,
    train_mean: data.train_mean[i],
    train_upper: Math.min(data.train_mean[i] + data.train_std[i], 1),
    train_lower: Math.max(data.train_mean[i] - data.train_std[i], 0),
    val_mean: data.val_mean[i],
    val_upper: Math.min(data.val_mean[i] + data.val_std[i], 1),
    val_lower: Math.max(data.val_mean[i] - data.val_std[i], 0),
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Learning Curve</h3>
        <span className={styles.badge}>Scoring: {data.scoring}</span>
      </div>
      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="size"
              type="number"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              label={{ value: 'Training Set Size', position: 'bottom', offset: 0, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
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
            <Area
              type="monotone"
              dataKey="train_mean"
              name="Training Score"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.1}
              strokeWidth={2}
              dot={{ r: 3, fill: '#6366f1' }}
            />
            <Area
              type="monotone"
              dataKey="val_mean"
              name="Validation Score"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.1}
              strokeWidth={2}
              dot={{ r: 3, fill: '#f59e0b' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.insight}>
        {data.train_mean[data.train_mean.length - 1] - data.val_mean[data.val_mean.length - 1] > 0.1
          ? 'High variance (overfitting): Large gap between training and validation scores.'
          : data.val_mean[data.val_mean.length - 1] < 0.6
          ? 'High bias (underfitting): Both scores are low. Consider a more complex model.'
          : 'Good fit: Training and validation scores are close and high.'}
      </div>
    </div>
  );
});
