import { memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { FeatureImportance } from '../services/explain.service';
import styles from './FeatureImportanceChart.module.css';

interface Props {
  data: FeatureImportance[];
}

function getColor(normalized: number): string {
  if (normalized >= 0.8) return '#6366f1';
  if (normalized >= 0.5) return '#818cf8';
  if (normalized >= 0.3) return '#a5b4fc';
  return '#c7d2fe';
}

export const FeatureImportanceChart = memo(function FeatureImportanceChart({ data }: Props) {
  if (!data || data.length === 0) return null;
  const chartData = data.slice(0, 15).map((d) => ({
    name: d.feature.length > 20 ? d.feature.slice(0, 18) + '...' : d.feature,
    fullName: d.feature,
    importance: Math.abs(d.importance),
    normalized: d.normalized,
    raw: d.importance,
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Feature Importance</h3>
        <span className={styles.badge}>{data.length} features</span>
      </div>
      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 32)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
            <YAxis
              dataKey="name"
              type="category"
              width={140}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => [typeof value === 'number' ? value.toFixed(4) : value, 'Importance']}
              labelFormatter={(label: string) => {
                const item = chartData.find((d) => d.name === label);
                return item?.fullName || label;
              }}
            />
            <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={getColor(entry.normalized)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
