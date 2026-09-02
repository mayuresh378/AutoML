import { memo } from 'react';
import type { PredictionPreview } from '../services/explain.service';
import styles from './PredictionPreview.module.css';

interface Props {
  data: PredictionPreview[];
}

export const PredictionPreviewTable = memo(function PredictionPreviewTable({ data }: Props) {
  if (!data || data.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Prediction Explanations</h3>
        <span className={styles.badge}>Top predictions from test set</span>
      </div>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>#</th>
              <th className={styles.th}>Actual</th>
              <th className={styles.th}>Predicted</th>
              <th className={styles.th}>Top Classes (Probability)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((pred, i) => {
              const isCorrect = pred.actual === pred.predicted;
              return (
                <tr key={i} className={styles.row}>
                  <td className={styles.cellIndex}>{i + 1}</td>
                  <td className={styles.cell}>{pred.actual}</td>
                  <td className={styles.cell}>
                    <span className={`${styles.predBadge} ${isCorrect ? styles.correct : styles.incorrect}`}>
                      {pred.predicted}
                    </span>
                  </td>
                  <td className={styles.cellClasses}>
                    {pred.top_classes.map((tc, j) => (
                      <span key={j} className={styles.classChip}>
                        <span className={styles.classLabel}>{tc.label}</span>
                        <span className={styles.classProb}>{(tc.probability * 100).toFixed(1)}%</span>
                        <div
                          className={styles.probBar}
                          style={{ width: `${tc.probability * 100}%` }}
                        />
                      </span>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
