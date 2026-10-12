import { Trophy, CheckCircle, BarChart3 } from 'lucide-react';
import type { TaskType } from '../services/evaluation.service';
import styles from './ModelComparisonTable.module.css';

interface ModelComparisonItem {
  model_name: string;
  accuracy?: number | null;
  precision?: number | null;
  recall?: number | null;
  f1?: number | null;
  roc_auc?: number | null;
  mae?: number | null;
  mse?: number | null;
  rmse?: number | null;
  r2?: number | null;
}

/**
 * The backend sends a metric as `null` (not absent) when it could not be
 * computed — e.g. `roc_auc` for a classifier without `predict_proba`. Render
 * those as `N/A` instead of crashing on `null.toFixed()`.
 */
function fmtMetric(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(4) : 'N/A';
}

interface Props {
  models: ModelComparisonItem[];
  bestModelName?: string;
  taskType: TaskType;
}

export function ModelComparisonTable({ models = [], bestModelName, taskType }: Props) {
  if (!models.length) return null;

  const isClassification = taskType === 'classification';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <BarChart3 className={styles.icon} />
          <h3 className={styles.title}>Baseline Candidate Model Comparison</h3>
        </div>
        <span className={styles.badge}>{models.length} Models Trained</span>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Model Name</th>
              {isClassification ? (
                <>
                  <th>Accuracy</th>
                  <th>Precision</th>
                  <th>Recall</th>
                  <th>F1-Score</th>
                  <th>ROC-AUC</th>
                </>
              ) : (
                <>
                  <th>R² Score</th>
                  <th>MAE</th>
                  <th>MSE</th>
                  <th>RMSE</th>
                </>
              )}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const isBest = m.model_name === bestModelName;
              return (
                <tr key={m.model_name} className={isBest ? styles.bestRow : undefined}>
                  <td className={styles.modelNameCell}>
                    {isBest && <Trophy className={styles.trophyIcon} />}
                    <span className={styles.modelName}>{m.model_name}</span>
                  </td>

                  {isClassification ? (
                    <>
                      <td className={styles.numCell}>{fmtMetric(m.accuracy)}</td>
                      <td className={styles.numCell}>{fmtMetric(m.precision)}</td>
                      <td className={styles.numCell}>{fmtMetric(m.recall)}</td>
                      <td className={styles.numCell}>{fmtMetric(m.f1)}</td>
                      <td className={styles.numCell}>{fmtMetric(m.roc_auc)}</td>
                    </>
                  ) : (
                    <>
                      <td className={styles.numCell}>{fmtMetric(m.r2)}</td>
                      <td className={styles.numCell}>{fmtMetric(m.mae)}</td>
                      <td className={styles.numCell}>{fmtMetric(m.mse)}</td>
                      <td className={styles.numCell}>{fmtMetric(m.rmse)}</td>
                    </>
                  )}

                  <td>
                    {isBest ? (
                      <span className={styles.bestBadge}>
                        <CheckCircle className={styles.checkIcon} /> Best Model
                      </span>
                    ) : (
                      <span className={styles.candidateBadge}>Candidate</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
