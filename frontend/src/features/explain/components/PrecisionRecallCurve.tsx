import { memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { PrCurveData } from '../services/explain.service';
import styles from './PrecisionRecallCurve.module.css';

interface Props {
  data: PrCurveData;
}

const CLASS_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

export const PrecisionRecallCurve = memo(function PrecisionRecallCurve({ data }: Props) {
  if (!data) return null;

  if (data.precision && data.recall) {
    const chartData = data.precision.map((prec, i) => ({
      recall: data.recall[i],
      precision: prec,
    }));

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Precision-Recall Curve</h3>
          <span className={styles.apBadge}>AP = {data.average_precision.toFixed(4)}</span>
        </div>
        <div className={styles.chartArea}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="recall"
                type="number"
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                label={{ value: 'Recall', position: 'bottom', offset: 0, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
              />
              <YAxis
                type="number"
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                label={{ value: 'Precision', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [value.toFixed(4), 'Precision']}
                labelFormatter={(label: string) => `Recall: ${Number(label).toFixed(4)}`}
              />
              <Line
                type="monotone"
                dataKey="precision"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#8b5cf6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  if (data.per_class) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>Precision-Recall Curve (One-vs-Rest)</h3>
          <span className={styles.apBadge}>Macro AP = {data.macro_ap?.toFixed(4)}</span>
        </div>
        <div className={styles.legend}>
          {data.per_class.map((cls, i) => (
            <div key={cls.label} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: CLASS_COLORS[i % CLASS_COLORS.length] }} />
              {cls.label} (AP = {cls.ap.toFixed(3)})
            </div>
          ))}
        </div>
        <div className={styles.chartArea}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} label={{ value: 'Recall', position: 'bottom', style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }} />
              <YAxis type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} label={{ value: 'Precision', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }} />
              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
              {data.per_class.map((cls, i) => {
                const lineData = cls.recall.map((r, j) => ({ recall: r, precision: cls.precision[j] }));
                return (
                  <Line key={cls.label} type="monotone" data={lineData} dataKey="precision" name={cls.label} stroke={CLASS_COLORS[i % CLASS_COLORS.length]} strokeWidth={2} dot={false} />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return null;
});
