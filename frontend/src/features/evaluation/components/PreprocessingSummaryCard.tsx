import { Cpu, CheckCircle, ShieldCheck } from 'lucide-react';
import styles from './PreprocessingSummaryCard.module.css';

interface Props {
  steps?: string[];
  trainSize?: number;
  testSize?: number;
  inputFeatures?: string[];
}

export function PreprocessingSummaryCard({ steps = [], trainSize, testSize, inputFeatures = [] }: Props) {
  if (!steps.length && !inputFeatures.length) return null;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <Cpu className={styles.icon} />
          <h3 className={styles.title}>Automated Data Preprocessing Summary</h3>
        </div>
        <span className={styles.badge}>AutoML Pipeline</span>
      </div>

      <div className={styles.body}>
        <div className={styles.stepsList}>
          <h4 className={styles.sectionHeading}>Applied Transformations:</h4>
          <ul>
            {steps.map((step, idx) => (
              <li key={idx} className={styles.stepItem}>
                <CheckCircle className={styles.checkIcon} />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.metaSide}>
          {trainSize !== undefined && testSize !== undefined && (
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Data Split Ratio</span>
              <span className={styles.metaValue}>
                {trainSize} Train / {testSize} Test (80/20)
              </span>
            </div>
          )}

          {inputFeatures.length > 0 && (
            <div className={styles.metaCard}>
              <span className={styles.metaLabel}>Active Model Features ({inputFeatures.length})</span>
              <div className={styles.featureTags}>
                {inputFeatures.slice(0, 10).map((f) => (
                  <span key={f} className={styles.featureTag}>
                    {f}
                  </span>
                ))}
                {inputFeatures.length > 10 && (
                  <span className={styles.moreTag}>+{inputFeatures.length - 10} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
