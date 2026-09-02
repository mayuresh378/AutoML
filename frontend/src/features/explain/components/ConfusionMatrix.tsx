import { memo, useMemo } from 'react';
import type { ConfusionMatrixData } from '../services/explain.service';
import styles from './ConfusionMatrix.module.css';

interface Props {
  data: ConfusionMatrixData;
}

export const ConfusionMatrix = memo(function ConfusionMatrix({ data }: Props) {
  if (!data || !data.matrix || data.matrix.length === 0) return null;

  const { matrix, labels } = data;
  const maxVal = Math.max(...matrix.flat(), 1);

  const rowTotals = useMemo(() => matrix.map((row) => row.reduce((a, b) => a + b, 0)), [matrix]);
  const colTotals = useMemo(() => {
    return matrix[0].map((_: number, colIdx: number) => matrix.reduce((sum, row) => sum + row[colIdx], 0));
  }, [matrix]);
  const total = rowTotals.reduce((a, b) => a + b, 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Confusion Matrix</h3>
        <span className={styles.badge}>n = {total.toLocaleString()}</span>
      </div>
      <div className={styles.matrixWrapper}>
        <div className={styles.cornerCell}>
          <span className={styles.cornerLabel}>Actual ↓ / Predicted →</span>
        </div>
        {labels.map((label) => (
          <div key={`col-${label}`} className={styles.colHeader}>{label}</div>
        ))}
        <div className={styles.colHeader} style={{ fontWeight: 600 }}>Total</div>

        {matrix.map((row, rowIdx) => (
          <>
            <div key={`row-${rowIdx}`} className={styles.rowHeader}>{labels[rowIdx]}</div>
            {row.map((val, colIdx) => {
              const intensity = val / maxVal;
              const isDiag = rowIdx === colIdx;
              const bgColor = isDiag
                ? `rgba(34, 197, 94, ${0.1 + intensity * 0.7})`
                : `rgba(239, 68, 68, ${0.05 + intensity * 0.5})`;
              return (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  className={styles.cell}
                  style={{ background: bgColor }}
                >
                  <span className={styles.cellValue}>{val.toLocaleString()}</span>
                  {total > 0 && (
                    <span className={styles.cellPct}>{((val / total) * 100).toFixed(1)}%</span>
                  )}
                </div>
              );
            })}
            <div className={`${styles.cell} ${styles.totalCell}`}>{rowTotals[rowIdx].toLocaleString()}</div>
          </>
        ))}

        <div className={styles.rowHeader} style={{ fontWeight: 600 }}>Total</div>
        {colTotals.map((val: number, i: number) => (
          <div key={`ct-${i}`} className={`${styles.cell} ${styles.totalCell}`}>{val.toLocaleString()}</div>
        ))}
        <div className={`${styles.cell} ${styles.totalCell}`} style={{ fontWeight: 700 }}>{total.toLocaleString()}</div>
      </div>
    </div>
  );
});
