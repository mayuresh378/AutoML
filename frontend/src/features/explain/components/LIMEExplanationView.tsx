import { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { LIMEExplanation } from '../services/explain.service';
import styles from './LIMEExplanationView.module.css';

interface Props {
  data: LIMEExplanation;
  sampleIndex?: number;
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export const LIMEExplanationView = memo(function LIMEExplanationView({ data, sampleIndex }: Props) {
  if (!data) return null;

  const chartData = data.local_coefficients.map((d) => ({
    name: d.feature.length > 20 ? d.feature.slice(0, 18) + '...' : d.feature,
    fullName: d.feature,
    coefficient: d.coefficient,
    absCoefficient: d.abs_coefficient,
    contribution: d.contribution,
    featureValue: d.feature_value,
    direction: d.direction,
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>LIME Local Explanation</h3>
        {sampleIndex != null && <span className={styles.badge}>Sample #{sampleIndex + 1}</span>}
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Intercept</span>
          <span className={styles.statValue}>{data.intercept.toFixed(4)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Predicted Value</span>
          <span className={styles.statValue}>{String(data.predicted_value)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Local R²</span>
          <span className={`${styles.statValue} ${data.model_r2 > 0.5 ? styles.goodR2 : ''}`}>
            {data.model_r2.toFixed(4)}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Positive Factors</span>
          <span className={styles.statValue}>{data.top_positive.length}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Negative Factors</span>
          <span className={styles.statValue}>{data.top_negative.length}</span>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Local Linear Coefficients</h4>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 30)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <ReferenceLine x={0} stroke="var(--color-text-tertiary)" />
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number, name: string) => [typeof value === 'number' ? value.toFixed(4) : value, name === 'coefficient' ? 'Coefficient' : 'Contribution']}
                  labelFormatter={(label: string) => chartData.find((d) => d.name === label)?.fullName || label}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const item = chartData.find((d) => d.name === label);
                    return (
                      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{item?.fullName || label}</div>
                        <div>Coefficient: <span style={{ fontFamily: 'monospace' }}>{item?.coefficient.toFixed(4)}</span></div>
                        <div>Feature Value: <span style={{ fontFamily: 'monospace' }}>{item?.featureValue}</span></div>
                        <div>Contribution: <span style={{ fontFamily: 'monospace' }}>{item?.contribution.toFixed(4)}</span></div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="coefficient" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.direction === 'positive' ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.top_positive.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Top Positive Factors</h4>
          <div className={styles.factorList}>
            {data.top_positive.slice(0, 5).map((f, i) => (
              <div key={i} className={`${styles.factorRow} ${styles.positive}`}>
                <span className={styles.factorRank}>#{i + 1}</span>
                <span className={styles.factorName}>{f.feature}</span>
                <div className={styles.factorBar}>
                  <div className={`${styles.factorFill} ${styles.posFill}`} style={{ width: `${Math.min((f.abs_coefficient / (data.local_coefficients[0]?.abs_coefficient || 1)) * 100, 100)}%` }} />
                </div>
                <span className={`${styles.factorValue} ${styles.posValue}`}>+{f.coefficient.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.top_negative.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Top Negative Factors</h4>
          <div className={styles.factorList}>
            {data.top_negative.slice(0, 5).map((f, i) => (
              <div key={i} className={`${styles.factorRow} ${styles.negative}`}>
                <span className={styles.factorRank}>#{i + 1}</span>
                <span className={styles.factorName}>{f.feature}</span>
                <div className={styles.factorBar}>
                  <div className={`${styles.factorFill} ${styles.negFill}`} style={{ width: `${Math.min((f.abs_coefficient / (data.local_coefficients[0]?.abs_coefficient || 1)) * 100, 100)}%` }} />
                </div>
                <span className={`${styles.factorValue} ${styles.negValue}`}>{f.coefficient.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
