import { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { PredictionExplanation } from '../services/explain.service';
import styles from './PredictionExplanationView.module.css';

interface Props {
  data: PredictionExplanation;
  sampleIndex?: number;
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export const PredictionExplanationView = memo(function PredictionExplanationView({ data, sampleIndex }: Props) {
  if (!data) return null;

  const chartData = data.feature_contributions.map((d) => ({
    name: d.feature.length > 22 ? d.feature.slice(0, 20) + '...' : d.feature,
    fullName: d.feature,
    shapValue: d.shap_value,
    featureValue: d.feature_value,
    direction: d.shap_direction,
    rank: d.importance_rank,
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Prediction Explanation</h3>
        {sampleIndex != null && <span className={styles.badge}>Sample #{sampleIndex + 1}</span>}
      </div>

      <div className={styles.predictionBox}>
        <div className={styles.predRow}>
          <span className={styles.predLabel}>Predicted Class</span>
          <span className={styles.predValue}>{String(data.predicted_class)}</span>
        </div>
        {data.confidence != null && (
          <div className={styles.predRow}>
            <span className={styles.predLabel}>Confidence</span>
            <div className={styles.confidenceBar}>
              <div className={styles.confidenceFill} style={{ width: `${data.confidence * 100}%` }} />
            </div>
            <span className={styles.confValue}>{(data.confidence * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>

      {data.explanation_text && (
        <div className={styles.explanationBox}>
          <p className={styles.explanationText}>{data.explanation_text}</p>
        </div>
      )}

      {Object.keys(data.probabilities).length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Class Probabilities</h4>
          <div className={styles.probList}>
            {Object.entries(data.probabilities)
              .sort(([, a], [, b]) => b - a)
              .map(([label, prob]) => (
                <div key={label} className={styles.probRow}>
                  <span className={styles.probLabel}>{label}</span>
                  <div className={styles.probBar}>
                    <div className={styles.probFill} style={{ width: `${prob * 100}%` }} />
                  </div>
                  <span className={styles.probValue}>{(prob * 100).toFixed(1)}%</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {chartData.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Feature Contributions (SHAP)</h4>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 28)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <ReferenceLine x={0} stroke="var(--color-text-tertiary)" />
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const item = chartData.find((d) => d.name === label);
                    return (
                      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{item?.fullName || label}</div>
                        <div>SHAP Value: <span style={{ fontFamily: 'monospace' }}>{item?.shapValue.toFixed(4)}</span></div>
                        <div>Feature Value: <span style={{ fontFamily: 'monospace' }}>{item?.featureValue}</span></div>
                        <div>Direction: <span style={{ color: item?.direction === 'positive' ? '#10b981' : '#ef4444' }}>{item?.direction}</span></div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="shapValue" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.direction === 'positive' ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {(data.top_positive_factors.length > 0 || data.top_negative_factors.length > 0) && (
        <div className={styles.twoCol}>
          {data.top_positive_factors.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Factors For</h4>
              <div className={styles.factorList}>
                {data.top_positive_factors.slice(0, 5).map((f, i) => (
                  <div key={i} className={`${styles.factorRow} ${styles.positive}`}>
                    <span className={styles.factorRank}>#{i + 1}</span>
                    <span className={styles.factorName}>{f.feature}</span>
                    <span className={`${styles.factorValue} ${styles.posValue}`}>+{f.shap_value.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.top_negative_factors.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Factors Against</h4>
              <div className={styles.factorList}>
                {data.top_negative_factors.slice(0, 5).map((f, i) => (
                  <div key={i} className={`${styles.factorRow} ${styles.negative}`}>
                    <span className={styles.factorRank}>#{i + 1}</span>
                    <span className={styles.factorName}>{f.feature}</span>
                    <span className={`${styles.factorValue} ${styles.negValue}`}>{f.shap_value.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
