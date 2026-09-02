import { memo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3 } from 'lucide-react';
import styles from './AccuracyChart.module.css';

interface AccuracyChartProps {
  metricsHistory: { model: string; accuracy?: number; r2?: number; cv_score?: number; f1?: number }[];
}

function getAccuracyValue(item: AccuracyChartProps['metricsHistory'][0]): number {
  if (item.accuracy != null) return item.accuracy;
  if (item.r2 != null) return item.r2;
  return 0;
}

function getBarColor(value: number): string {
  if (value >= 0.9) return '#22c55e';
  if (value >= 0.8) return '#eab308';
  if (value >= 0.7) return '#f97316';
  return '#ef4444';
}

export const AccuracyChart = memo(function AccuracyChart({ metricsHistory }: AccuracyChartProps) {
  if (!metricsHistory || metricsHistory.length === 0) return null;

  const data = metricsHistory.map((m) => ({
    name: m.model,
    accuracy: +(getAccuracyValue(m) * 100).toFixed(1),
    cv: m.cv_score != null ? +(m.cv_score * 100).toFixed(1) : undefined,
  }));

  const maxAcc = Math.max(...data.map((d) => d.accuracy));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <BarChart3 className={styles.headerIcon} />
        <span className={styles.headerText}>Model Comparison</span>
      </div>
      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              angle={-35}
              textAnchor="end"
              height={60}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [`${value}%`, name === 'accuracy' ? 'Accuracy' : 'CV Score']}
            />
            <Bar dataKey="accuracy" radius={[4, 4, 0, 0]} name="accuracy">
              {data.map((entry, index) => (
                <Cell key={index} fill={getBarColor(entry.accuracy / 100)} />
              ))}
            </Bar>
            {data.some((d) => d.cv != null) && (
              <Bar dataKey="cv" radius={[4, 4, 0, 0]} fill="rgba(79,70,229,0.4)" name="cv" />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {data.length > 0 && (
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#22c55e' }} /> 90%+
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#eab308' }} /> 80-90%
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#f97316' }} /> 70-80%
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#ef4444' }} /> &lt;70%
          </div>
        </div>
      )}
    </div>
  );
});
