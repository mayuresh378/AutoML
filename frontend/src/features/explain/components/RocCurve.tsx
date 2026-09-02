import { memo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { RocCurveData } from '../services/explain.service';
import styles from './RocCurve.module.css';

interface Props {
  data: RocCurveData;
}

const CLASS_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

export const RocCurve = memo(function RocCurve({ data }: Props) {
  if (!data) return null;

  // Binary ROC
  if (data.fpr && data.tpr) {
    const chartData = data.fpr.map((fpr, i) => ({
      fpr,
      tpr: data.tpr[i],
    }));

    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>ROC Curve</h3>
          <span className={styles.aucBadge}>AUC = {data.auc.toFixed(4)}</span>
        </div>
        <div className={styles.chartArea}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="fpr"
                type="number"
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                label={{ value: 'False Positive Rate', position: 'bottom', offset: 0, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
              />
              <YAxis
                type="number"
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [value.toFixed(4), 'TPR']}
                labelFormatter={(label: string) => `FPR: ${Number(label).toFixed(4)}`}
              />
              <ReferenceLine
                segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                stroke="var(--color-text-tertiary)"
                strokeDasharray="6 4"
                strokeWidth={1}
              />
              <Line
                type="monotone"
                dataKey="tpr"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#6366f1' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Multiclass ROC
  if (data.per_class) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3 className={styles.title}>ROC Curve (One-vs-Rest)</h3>
          <span className={styles.aucBadge}>Macro AUC = {data.macro_auc?.toFixed(4)}</span>
        </div>
        <div className={styles.legend}>
          {data.per_class.map((cls, i) => (
            <div key={cls.label} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: CLASS_COLORS[i % CLASS_COLORS.length] }} />
              {cls.label} (AUC = {cls.auc.toFixed(3)})
            </div>
          ))}
        </div>
        <div className={styles.chartArea}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="number"
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                label={{ value: 'FPR', position: 'bottom', offset: 0, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
              />
              <YAxis
                type="number"
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                label={{ value: 'TPR', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
              />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
              />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="var(--color-text-tertiary)" strokeDasharray="6 4" strokeWidth={1} />
              {data.per_class.map((cls, i) => {
                const lineData = cls.fpr.map((fpr, j) => ({ fpr, tpr: cls.tpr[j] }));
                return (
                  <Line
                    key={cls.label}
                    type="monotone"
                    data={lineData}
                    dataKey="tpr"
                    name={cls.label}
                    stroke={CLASS_COLORS[i % CLASS_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
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
