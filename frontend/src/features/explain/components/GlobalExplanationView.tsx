import { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';
import type { GlobalExplanation } from '../services/explain.service';
import styles from './GlobalExplanationView.module.css';

interface Props {
  data: GlobalExplanation;
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export const GlobalExplanationView = memo(function GlobalExplanationView({ data }: Props) {
  if (!data) return null;

  const importanceData = (data.feature_importance_summary || []).slice(0, 12).map((d) => ({
    name: d.feature.length > 22 ? d.feature.slice(0, 20) + '...' : d.feature,
    fullName: d.feature,
    importance: Math.abs(d.importance),
    normalized: d.normalized,
  }));

  const statsData = (data.feature_statistics || []).slice(0, 10).map((d) => ({
    name: d.feature.length > 18 ? d.feature.slice(0, 16) + '...' : d.feature,
    cv: d.coefficient_of_variation,
    range: d.range,
  }));

  const classDist = data.prediction_distribution?.class_distribution || {};
  const pieData = Object.entries(classDist).map(([label, count]) => ({ name: label, value: count }));

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Model Insights</h3>
        <div className={styles.insightGrid}>
          <div className={styles.insightCard}>
            <span className={styles.insightLabel}>Total Features</span>
            <span className={styles.insightValue}>{data.model_insights.n_features}</span>
          </div>
          <div className={styles.insightCard}>
            <span className={styles.insightLabel}>Total Samples</span>
            <span className={styles.insightValue}>{data.model_insights.n_samples.toLocaleString()}</span>
          </div>
          <div className={styles.insightCard}>
            <span className={styles.insightLabel}>Task Type</span>
            <span className={styles.insightValue}>{data.prediction_distribution.task_type}</span>
          </div>
          <div className={styles.insightCard}>
            <span className={styles.insightLabel}>Has Interactions</span>
            <span className={styles.insightValue}>{data.model_insights.has_interactions ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      {data.most_important_features?.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Most Important Features</h3>
          <div className={styles.featureChips}>
            {data.most_important_features.map((f, i) => (
              <span key={f} className={styles.featureChip}>
                <span className={styles.chipRank}>#{i + 1}</span> {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {importanceData.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Feature Importance Summary</h3>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={Math.max(280, importanceData.length * 30)}>
              <BarChart data={importanceData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [typeof value === 'number' ? value.toFixed(4) : value, 'Importance']}
                  labelFormatter={(label: string) => importanceData.find((d) => d.name === label)?.fullName || label}
                />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                  {importanceData.map((entry, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.feature_statistics?.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Feature Variability (Coefficient of Variation)</h3>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={Math.max(240, statsData.length * 28)}>
              <BarChart data={statsData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [typeof value === 'number' ? value.toFixed(4) : value, 'CV']}
                />
                <Bar dataKey="cv" radius={[0, 4, 4, 0]}>
                  {statsData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.feature_interactions?.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Feature Interactions</h3>
          <div className={styles.interactionList}>
            {data.feature_interactions.slice(0, 8).map((inter, i) => (
              <div key={i} className={styles.interactionRow}>
                <span className={styles.interactionFeatures}>{inter.feature_a} ↔ {inter.feature_b}</span>
                <div className={styles.interactionBar}>
                  <div
                    className={`${styles.interactionFill} ${inter.strength === 'strong' ? styles.strong : styles.moderate}`}
                    style={{ width: `${Math.abs(inter.correlation) * 100}%` }}
                  />
                </div>
                <span className={styles.interactionValue}>{inter.correlation.toFixed(3)}</span>
                <span className={`${styles.interactionStrength} ${inter.strength === 'strong' ? styles.strongBadge : styles.moderateBadge}`}>
                  {inter.strength}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pieData.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Class Distribution</h3>
          <div className={styles.chartArea}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
});
