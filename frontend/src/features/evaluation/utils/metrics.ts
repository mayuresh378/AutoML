import type {
  EvaluationMetrics,
  InsightSeverity,
  TaskType,
} from '../services/evaluation.service';

export type MetricDirection = 'higher' | 'lower';

export interface MetricMeta {
  key: keyof EvaluationMetrics;
  label: string;
  short: string;
  direction: MetricDirection;
  /** Shown under the value so a number is never left unexplained. */
  hint: string;
  digits: number;
  /**
   * Lowercased tokens that identify this metric inside a server `unavailable`
   * message, so an absent value can be shown with its actual reason.
   */
  reasonKeys: string[];
}

/**
 * Metrics are grouped by task: showing MAE next to ROC-AUC would be noise, and
 * showing an absent metric as `0` would be a lie.
 */
export const CLASSIFICATION_METRICS: MetricMeta[] = [
  { key: 'accuracy', label: 'Accuracy', short: 'ACC', direction: 'higher', digits: 4, hint: 'Share of test rows predicted correctly.', reasonKeys: ['accuracy'] },
  { key: 'precision', label: 'Precision', short: 'PREC', direction: 'higher', digits: 4, hint: 'Of predicted positives, how many were right.', reasonKeys: ['precision'] },
  { key: 'recall', label: 'Recall', short: 'REC', direction: 'higher', digits: 4, hint: 'Of actual positives, how many were found.', reasonKeys: ['recall'] },
  { key: 'f1', label: 'F1 Score', short: 'F1', direction: 'higher', digits: 4, hint: 'Harmonic mean of precision and recall.', reasonKeys: ['f1'] },
  { key: 'roc_auc', label: 'ROC AUC', short: 'AUC', direction: 'higher', digits: 4, hint: 'Ranking quality across all thresholds. 0.5 is chance.', reasonKeys: ['roc', 'auc'] },
  { key: 'mcc', label: 'Matthews Correlation', short: 'MCC', direction: 'higher', digits: 4, hint: 'Balanced correlation, usable with imbalanced classes.', reasonKeys: ['mcc', 'matthews'] },
  { key: 'cohen_kappa', label: 'Cohen Kappa', short: 'KAPPA', direction: 'higher', digits: 4, hint: 'Accuracy corrected for chance agreement.', reasonKeys: ['kappa'] },
  { key: 'log_loss', label: 'Log Loss', short: 'LOGLOSS', direction: 'lower', digits: 4, hint: 'Penalises confident wrong answers. Lower is better.', reasonKeys: ['log loss', 'logloss', 'calibration', 'probabilit'] },
];

export const REGRESSION_METRICS: MetricMeta[] = [
  { key: 'r2', label: 'R² Score', short: 'R2', direction: 'higher', digits: 4, hint: 'Share of target variance explained. 1.0 is perfect.', reasonKeys: ['r2', 'r²', 'coefficient of determination'] },
  { key: 'rmse', label: 'RMSE', short: 'RMSE', direction: 'lower', digits: 4, hint: 'Root mean squared error, in target units.', reasonKeys: ['rmse', 'root mean squared'] },
  { key: 'mae', label: 'MAE', short: 'MAE', direction: 'lower', digits: 4, hint: 'Mean absolute error, in target units.', reasonKeys: ['mae', 'mean absolute'] },
  { key: 'mse', label: 'MSE', short: 'MSE', direction: 'lower', digits: 4, hint: 'Mean squared error. Sensitive to outliers.', reasonKeys: ['mse', 'mean squared'] },
  { key: 'mape', label: 'MAPE', short: 'MAPE', direction: 'lower', digits: 4, hint: 'Mean absolute percentage error, as a fraction.', reasonKeys: ['mape', 'percentage'] },
];

export function metricsForTask(task: TaskType): MetricMeta[] {
  return task === 'regression' ? REGRESSION_METRICS : CLASSIFICATION_METRICS;
}

export function formatMetric(value: number | null | undefined, digits = 4): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value !== 0 && Math.abs(value) < 0.0001) return value.toExponential(2);
  return value.toFixed(digits);
}

/**
 * Map a metric to a qualitative band. The thresholds mirror the backend's
 * `build_insights` bands so the UI and the text insights never disagree.
 */
export function metricBand(meta: MetricMeta, value: number): { label: string; severity: InsightSeverity } {
  if (meta.direction === 'lower') {
    if (value <= 0.01) return { label: 'excellent', severity: 'positive' };
    if (value <= 0.1) return { label: 'good', severity: 'positive' };
    if (value <= 0.3) return { label: 'fair', severity: 'info' };
    return { label: 'poor', severity: 'warning' };
  }
  if (value >= 0.95) return { label: 'excellent', severity: 'positive' };
  if (value >= 0.85) return { label: 'strong', severity: 'positive' };
  if (value >= 0.7) return { label: 'moderate', severity: 'info' };
  return { label: 'weak', severity: 'warning' };
}

/** The metric a comparison table should rank models by. */
export function primaryMetricKey(task: TaskType): keyof EvaluationMetrics {
  return task === 'regression' ? 'r2' : 'accuracy';
}

export const SEVERITY_LABELS: Record<InsightSeverity, string> = {
  positive: 'Strength',
  info: 'Observation',
  warning: 'Watch',
  critical: 'Problem',
};
