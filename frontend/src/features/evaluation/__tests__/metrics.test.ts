import { describe, it, expect } from 'vitest';
import {
  CLASSIFICATION_METRICS,
  REGRESSION_METRICS,
  formatMetric,
  metricBand,
  metricsForTask,
  primaryMetricKey,
} from '../utils/metrics';

describe('metric definitions', () => {
  it('offers classification metrics for classification and regression metrics for regression', () => {
    expect(metricsForTask('classification')).toEqual(CLASSIFICATION_METRICS);
    expect(metricsForTask('regression')).toEqual(REGRESSION_METRICS);
  });

  it('never mixes task types', () => {
    // A regression tile showing ROC AUC would be meaningless, and a
    // classification tile showing RMSE would be noise.
    expect(CLASSIFICATION_METRICS.some((m) => m.key === 'r2')).toBe(false);
    expect(CLASSIFICATION_METRICS.some((m) => m.key === 'rmse')).toBe(false);
    expect(REGRESSION_METRICS.some((m) => m.key === 'accuracy')).toBe(false);
    expect(REGRESSION_METRICS.some((m) => m.key === 'roc_auc')).toBe(false);
  });

  it('gives every metric a direction and an explanation', () => {
    for (const m of [...CLASSIFICATION_METRICS, ...REGRESSION_METRICS]) {
      expect(m.direction === 'higher' || m.direction === 'lower').toBe(true);
      expect(m.hint.length).toBeGreaterThan(10);
      expect(m.label).not.toBe('');
    }
  });

  it('picks the task-appropriate ranking metric', () => {
    expect(primaryMetricKey('classification')).toBe('accuracy');
    expect(primaryMetricKey('regression')).toBe('r2');
  });
});

describe('formatMetric', () => {
  it('renders a missing metric as a dash instead of zero', () => {
    // Showing 0 for an absent metric is a lie about model quality.
    expect(formatMetric(null)).toBe('—');
    expect(formatMetric(undefined)).toBe('—');
    expect(formatMetric(NaN)).toBe('—');
    expect(formatMetric(Infinity)).toBe('—');
  });

  it('formats ordinary values to a fixed precision', () => {
    expect(formatMetric(0.94321)).toBe('0.9432');
    expect(formatMetric(1)).toBe('1.0000');
  });

  it('uses exponent notation for values that would round to zero', () => {
    expect(formatMetric(0.0000001)).toBe('1.00e-7');
  });

  it('keeps true zero readable', () => {
    expect(formatMetric(0)).toBe('0.0000');
  });
});

describe('metricBand', () => {
  const accuracy = CLASSIFICATION_METRICS.find((m) => m.key === 'accuracy')!;
  const rmse = REGRESSION_METRICS.find((m) => m.key === 'rmse')!;

  it('grades higher-is-better metrics against the backend thresholds', () => {
    expect(metricBand(accuracy, 0.99).label).toBe('excellent');
    expect(metricBand(accuracy, 0.9).label).toBe('strong');
    expect(metricBand(accuracy, 0.75).label).toBe('moderate');
    expect(metricBand(accuracy, 0.4).label).toBe('weak');
  });

  it('inverts the grading for lower-is-better metrics', () => {
    expect(metricBand(rmse, 0.001).label).toBe('excellent');
    expect(metricBand(rmse, 0.9).label).toBe('poor');
  });

  it('marks a weak higher-is-better metric as a warning', () => {
    expect(metricBand(accuracy, 0.5).severity).toBe('warning');
  });

  it('marks a strong result as positive', () => {
    expect(metricBand(accuracy, 0.96).severity).toBe('positive');
  });
});
