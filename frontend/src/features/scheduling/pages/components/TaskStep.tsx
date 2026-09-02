import { Target, GitBranch, Layers, Clock } from 'lucide-react';
import { SectionCard } from './SectionCard';
import styles from './TaskStep.module.css';

const TASKS = [
  { id: 'classification', label: 'Classification', icon: Target, metrics: ['Accuracy', 'F1', 'ROC'] },
  { id: 'regression', label: 'Regression', icon: GitBranch, metrics: ['MAE', 'RMSE', 'R²'] },
  { id: 'clustering', label: 'Clustering', icon: Layers, metrics: ['Silhouette'] },
  { id: 'time_series', label: 'Time Series', icon: Clock, metrics: ['Forecasting'] },
] as const;

interface Props {
  selected: string;
  onSelect: (task: string) => void;
}

export function TaskStep({ selected, onSelect }: Props) {
  return (
    <SectionCard number={2} title="Task Selection" subtitle="Choose the type of problem you're solving">
      <div className={styles.grid}>
        {TASKS.map(t => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              className={`${styles.card} ${active ? styles.active : ''}`}
              onClick={() => onSelect(t.id)}
            >
              <div className={styles.iconWrap}>
                <t.icon size={20} />
              </div>
              <span className={styles.name}>{t.label}</span>
              <div className={styles.metrics}>
                {t.metrics.map(m => (
                  <span key={m} className={styles.metric}>{m}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
