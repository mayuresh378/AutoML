import { Check, ArrowDown } from 'lucide-react';
import { SectionCard } from './SectionCard';
import styles from './PreprocessStep.module.css';

const OPTIONS: { key: string; label: string }[] = [
  { key: 'imputation', label: 'Missing Value Imputation' },
  { key: 'dedupe', label: 'Remove Duplicates' },
  { key: 'outlier', label: 'Outlier Detection' },
  { key: 'scaling', label: 'Feature Scaling' },
  { key: 'labelEncoding', label: 'Label Encoding' },
  { key: 'oneHot', label: 'One Hot Encoding' },
  { key: 'featureSelection', label: 'Feature Selection' },
  { key: 'pca', label: 'PCA' },
  { key: 'balancing', label: 'Class Balancing' },
  { key: 'leakage', label: 'Data Leakage Detection' },
];

const PIPELINE: string[] = ['Raw CSV', 'Missing Values', 'Encoding', 'Scaling', 'Feature Selection', 'Train / Test Split'];

interface Props {
  options: Record<string, boolean>;
  onToggle: (key: string) => void;
}

export function PreprocessStep({ options, onToggle }: Props) {
  return (
    <SectionCard number={3} title="Data Preprocessing" subtitle="Enable preprocessing steps to run before training">
      <div className={styles.wrap}>
        <div className={styles.checkGrid}>
          {OPTIONS.map(o => {
            const on = !!options[o.key];
            return (
              <button
                key={o.key}
                className={`${styles.option} ${on ? styles.on : ''}`}
                onClick={() => onToggle(o.key)}
              >
                <span className={`${styles.checkbox} ${on ? styles.checked : ''}`}>
                  {on && <Check size={11} />}
                </span>
                <span className={styles.optionLabel}>{o.label}</span>
              </button>
            );
          })}
        </div>

        <div className={styles.preview}>
          <span className={styles.previewTitle}>Pipeline Preview</span>
          <div className={styles.pipe}>
            {PIPELINE.map((p, i) => (
              <div key={p} className={styles.pipeItem}>
                <div className={styles.pipeNode}>
                  {i === 0 ? 'CSV' : p}
                </div>
                {i < PIPELINE.length - 1 && <ArrowDown size={12} className={styles.pipeArrow} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
