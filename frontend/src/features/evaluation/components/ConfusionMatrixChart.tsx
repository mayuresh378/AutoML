import { memo } from 'react';
import type { ConfusionMatrixData } from '../services/evaluation.service';
import { ChartCard } from './ChartCard';
import styles from './ConfusionMatrixChart.module.css';

interface Props {
  data: ConfusionMatrixData | null;
  reason?: string;
}

export const ConfusionMatrixChart = memo(function ConfusionMatrixChart({ data, reason }: Props) {
  if (!data || !data.matrix?.length) {
    return (
      <ChartCard title="Confusion matrix" subtitle="Actual vs predicted counts">
        <div className={styles.unavailable}>{reason ?? 'Not available for this run.'}</div>
      </ChartCard>
    );
  }

  const { matrix, labels } = data;
  const total = matrix.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
  const max = Math.max(...matrix.flat(), 1);

  return (
    <ChartCard
      title="Confusion matrix"
      subtitle={`${labels.length} class${labels.length === 1 ? '' : 'es'} · ${total.toLocaleString()} test rows`}
    >
      <div className={styles.wrapper}>
        <span className={styles.axisLabel} data-axis="y">
          Actual
        </span>
        <div className={styles.gridArea}>
          <div
            className={styles.matrix}
            style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}
          >
            {matrix.map((row, i) =>
              row.map((count, j) => {
                const intensity = count / max;
                const correct = i === j;
                return (
                  <div
                    key={`${i}-${j}`}
                    className={styles.cell}
                    data-correct={correct}
                    style={{
                      background: correct
                        ? `rgba(52, 211, 153, ${0.08 + intensity * 0.34})`
                        : `rgba(248, 113, 113, ${0.06 + intensity * 0.4})`,
                    }}
                    title={`actual ${labels[i]} / predicted ${labels[j]}: ${count}`}
                  >
                    <span className={styles.count}>{count.toLocaleString()}</span>
                    {total > 0 && (
                      <span className={styles.pct}>{((count / total) * 100).toFixed(1)}%</span>
                    )}
                  </div>
                );
              }),
            )}
          </div>
          <div className={styles.axisRow} style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
            {labels.map((l) => (
              <span key={l} className={styles.axisLabel} data-axis="x" title={l}>
                {l}
              </span>
            ))}
          </div>
          <span className={styles.axisLabel} data-axis="x-caption">
            Predicted
          </span>
        </div>
      </div>
    </ChartCard>
  );
});
