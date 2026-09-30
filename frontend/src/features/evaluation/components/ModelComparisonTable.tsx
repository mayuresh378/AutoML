import { Trophy, CheckCircle, BarChart3 } from 'lucide-react';
import type { TaskType } from '../services/evaluation.service';
import styles from './ModelComparisonTable.module.css';

interface ModelComparisonItem {
  model_name: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  roc_auc?: number;
  mae?: number;
  mse?: number;
  rmse?: number;
  r2?: number;
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
                      <td className={styles.numCell}>{(m.accuracy ?? 0).toFixed(4)}</td>
                      <td className={styles.numCell}>{(m.precision ?? 0).toFixed(4)}</td>
                      <td className={styles.numCell}>{(m.recall ?? 0).toFixed(4)}</td>
                      <td className={styles.numCell}>{(m.f1 ?? 0).toFixed(4)}</td>
                      <td className={styles.numCell}>
                        {m.roc_auc !== undefined ? m.roc_auc.toFixed(4) : 'N/A'}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={styles.numCell}>{(m.r2 ?? 0).toFixed(4)}</td>
                      <td className={styles.numCell}>{(m.mae ?? 0).toFixed(4)}</td>
                      <td className={styles.numCell}>{(m.mse ?? 0).toFixed(4)}</td>
                      <td className={styles.numCell}>{(m.rmse ?? 0).toFixed(4)}</td>
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
