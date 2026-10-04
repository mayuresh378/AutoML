import { describe, it, expect } from 'vitest';
import { normalizeProgress, normalizeResult, pickBestResult } from '../../../services/training.service';

/**
 * These payloads are the real `data:` frames captured from
 * `GET /api/v1/training/{job_id}/progress` while training actual models.
 */
const REGRESSION_FRAME = {
  status: 'completed',
  progress: 100,
  current_step: 'complete',
  message: 'Best model: KNN (r2=0.85)',
  task_type: 'regression',
  rank_metric: 'r2',
  failed_count: 0,
  elapsed: 3.9,
  start_time: 1,
  logs: [],
  metrics_history: [{ model: 'Ridge', mse: 19.2, rmse: 4.38, mae: 3.4, r2: -0.0645, cv_score: 0.0312 }],
  all_results: [
    {
      name: 'Ridge', algorithm: 'Ridge', status: 'success',
      metrics: { mse: 19.2201, rmse: 4.3841, mae: 3.4021, r2: -0.0645 },
      cv_score: 0.0312, training_time: 0.11, time: 0.11,
    },
    {
      name: 'DecisionTree', algorithm: 'DecisionTree', status: 'success',
      metrics: { mse: 9.4, rmse: 3.0663, mae: 2.4, r2: 0.7427 },
      cv_score: 0.7833, training_time: 0.14, time: 0.14,
    },
    {
      name: 'KNN', algorithm: 'KNN', status: 'success',
      metrics: { mse: 5.3521, rmse: 2.3135, mae: 1.8, r2: 0.85 },
      cv_score: 0.8747, training_time: 0.14, time: 0.14,
    },
  ],
  best_model: { name: 'KNN', status: 'success', metrics: { r2: 0.85 }, cv_score: 0.8747, training_time: 0.14 },
};

const CLASSIFICATION_FRAME = {
  status: 'completed',
  progress: 100,
  current_step: 'complete',
  task_type: 'classification',
  rank_metric: 'accuracy',
  logs: [],
  metrics_history: [],
  all_results: [
    {
      name: 'DecisionTree', status: 'success',
      metrics: { accuracy: 0.8412, precision: 0.84, recall: 0.84, f1: 0.84, confusion_matrix: [[1, 2]] },
      cv_score: 0.8505, training_time: 0.12, time: 0.12,
    },
    {
      name: 'LogisticRegression', status: 'success',
      metrics: { accuracy: 0.875, precision: 0.87, recall: 0.87, f1: 0.87, confusion_matrix: [[1, 2]] },
      cv_score: 0.8912, training_time: 0.51, time: 0.51,
    },
  ],
  best_model: { name: 'LogisticRegression', status: 'success', metrics: { accuracy: 0.875 }, cv_score: 0.8912 },
};

/** Every algorithm failed - the payload shape behind the original bug. */
const ALL_FAILED_FRAME = {
  status: 'completed',
  progress: 100,
  task_type: 'regression',
  all_results: [
    { name: 'Ridge', error: "TypeError: got an unexpected keyword argument 'squared'" },
    { name: 'DecisionTree', error: "TypeError: got an unexpected keyword argument 'squared'" },
    { name: 'KNN', error: "TypeError: got an unexpected keyword argument 'squared'" },
  ],
};

describe('training result normalization', () => {
  it('reads real regression metrics and never invents an accuracy', () => {
    const p = normalizeProgress(REGRESSION_FRAME);
    expect(p.task_type).toBe('regression');
    expect(p.rank_metric).toBe('r2');
    expect(p.all_results).toHaveLength(3);
    for (const r of p.all_results!) {
      expect(r.status).toBe('success');
      expect(r.metrics).not.toBeNull();
      expect(r.metrics).not.toHaveProperty('accuracy');
      expect(r.metrics!.r2).toBeTypeOf('number');
      expect(r.training_time).toBeTypeOf('number');
      expect(r.cv_score).toBeTypeOf('number');
    }
  });

  it('maps training_time (and the legacy time alias) onto one field', () => {
    const p = normalizeProgress(REGRESSION_FRAME);
    expect(p.all_results!.map((r) => r.training_time)).toEqual([0.11, 0.14, 0.14]);
    // Legacy backend shape: only `time` was ever sent.
    const legacy = normalizeResult({ name: 'Ridge', metrics: { r2: 0.5 }, cv_score: 0.4, time: 1.24 });
    expect(legacy!.training_time).toBe(1.24);
  });

  it('surfaces a per-algorithm failure instead of blank metrics', () => {
    const p = normalizeProgress(ALL_FAILED_FRAME);
    expect(p.all_results).toHaveLength(3);
    for (const r of p.all_results!) {
      expect(r.status).toBe('error');
      expect(r.metrics).toBeNull();
      expect(r.cv_score).toBeNull();
      expect(r.training_time).toBeNull();
      expect(r.error).toContain('squared');
    }
  });

  it('drops a best_model that carries no metrics', () => {
    const p = normalizeProgress({ status: 'completed', all_results: [], best_model: { name: 'Ridge' } });
    expect(p.best_model).toBeUndefined();
  });
});

describe('pickBestResult', () => {
  it('picks the highest R², so a negative-scoring Ridge is not the winner', () => {
    const p = normalizeProgress(REGRESSION_FRAME);
    const best = pickBestResult(p.all_results!, 'r2');
    expect(best!.name).toBe('KNN');
    expect(best!.name).not.toBe('Ridge');
  });

  it('ranks classification on accuracy, not list position', () => {
    const p = normalizeProgress(CLASSIFICATION_FRAME);
    expect(p.all_results!.map((r) => r.name)).toEqual(['DecisionTree', 'LogisticRegression']);
    const best = pickBestResult(p.all_results!, 'accuracy');
    expect(best!.name).toBe('LogisticRegression');
  });

  it('returns null when nothing was measured, so no "Best" badge appears', () => {
    const failed = normalizeProgress(ALL_FAILED_FRAME);
    expect(pickBestResult(failed.all_results!, 'r2')).toBeNull();
    expect(pickBestResult([], 'accuracy')).toBeNull();
  });

  it('ignores failed rows even when they carry a stale metric value', () => {
    const results = [
      { name: 'Broken', status: 'error' as const, metrics: { accuracy: 0.99 }, cv_score: 0.99, training_time: 1, error: 'boom' },
      { name: 'Working', status: 'success' as const, metrics: { accuracy: 0.6 }, cv_score: 0.6, training_time: 1, error: null },
    ];
    expect(pickBestResult(results, 'accuracy')!.name).toBe('Working');
  });

  it('treats MAE/MSE/RMSE as reported-only, never as the ranking metric', () => {
    // Ridge has the best MAE but a far worse R²; ranking on R² must still win
    // for the model with the higher R².
    const results = [
      { name: 'A', status: 'success' as const, metrics: { r2: 0.5, mae: 10 }, cv_score: 0.5, training_time: 1, error: null },
      { name: 'B', status: 'success' as const, metrics: { r2: 0.9, mae: 99 }, cv_score: 0.9, training_time: 1, error: null },
    ];
    expect(pickBestResult(results, 'r2')!.name).toBe('B');
  });
});

describe('task detection defaults', () => {
  it('falls back to classification only when the frame omits task_type', () => {
    const p = normalizeProgress({ status: 'completed', all_results: [] });
    expect(p.task_type).toBe('classification');
    expect(p.rank_metric).toBe('accuracy');
  });

  it('defaults logs and metrics_history to empty arrays instead of undefined', () => {
    const p = normalizeProgress({ status: 'running' });
    expect(p.logs).toEqual([]);
    expect(p.metrics_history).toEqual([]);
    expect(p.all_results).toBeUndefined();
  });
});
