import { http, BASE } from './http';
import type { Experiment, TrainingJob } from '../types/api';

export type TaskType = 'classification' | 'regression';

/** Metric the "Best" badge is decided by. Higher is always better. */
export const RANK_METRIC: Record<TaskType, 'accuracy' | 'r2'> = {
  classification: 'accuracy',
  regression: 'r2',
};

/** Metrics where a lower value is the better model. */
export const LOWER_IS_BETTER = ['mae', 'mse', 'rmse', 'log_loss'] as const;

/**
 * One algorithm's outcome. `metrics` stays null when the model failed so a
 * failure can never be rendered as a score of zero or as a dash that looks
 * like a real (but missing) measurement.
 */
export interface AlgorithmResult {
  name: string;
  status: 'success' | 'error';
  metrics: Record<string, number> | null;
  cv_score: number | null;
  training_time: number | null;
  error: string | null;
}

export interface MetricsHistoryEntry {
  model: string;
  accuracy?: number;
  r2?: number;
  rmse?: number;
  mae?: number;
  mse?: number;
  f1?: number;
  precision?: number;
  recall?: number;
  cv_score?: number;
}

export interface TrainingProgress {
  status: string;
  progress: number;
  current_step: string;
  current_model?: string;
  model_index?: number;
  total_models?: number;
  completed_models?: number;
  message: string;
  error?: string;
  logs: { time: number; message: string }[];
  metrics_history: MetricsHistoryEntry[];
  latest_result?: AlgorithmResult;
  best_model?: AlgorithmResult;
  all_results?: AlgorithmResult[];
  task_type?: TaskType;
  rank_metric?: 'accuracy' | 'r2';
  failed_count?: number;
  saved_model_name?: string | null;
  save_warning?: string;
  cpu_percent?: number;
  elapsed?: number;
  start_time?: number;
}

export interface AlgorithmInfo {
  name: string;
  available: boolean;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Normalize one raw per-algorithm payload from the training stream.
 *
 * The backend sends `training_time`, but older builds of this endpoint sent
 * only `time`. Reading just one of them is what produced cells like a bare
 * "s" with no number in front of it, so both are accepted and mapped onto a
 * single field here.
 */
export function normalizeResult(raw: any): AlgorithmResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name ?? raw.algorithm ?? 'Unknown');
  const error = typeof raw.error === 'string' && raw.error ? raw.error : null;
  const metrics: Record<string, number> | null =
    raw.metrics && typeof raw.metrics === 'object' && Object.keys(raw.metrics).length > 0
      ? (raw.metrics as Record<string, number>)
      : null;
  return {
    name,
    // A row is only a success when the backend said so and it carries metrics.
    status: raw.status === 'error' || (error && !metrics) ? 'error' : 'success',
    metrics,
    cv_score: num(raw.cv_score),
    training_time: num(raw.training_time ?? raw.time),
    error,
  };
}

/**
 * Normalize a raw SSE frame into the shape the UI renders from. Nothing here
 * invents values: absent metrics stay null so the UI can show the real error.
 */
export function normalizeProgress(raw: any): TrainingProgress {
  const src = raw && typeof raw === 'object' ? raw : {};
  const taskType: TaskType = src.task_type === 'regression' ? 'regression' : 'classification';
  const allResults: AlgorithmResult[] | undefined = Array.isArray(src.all_results)
    ? (src.all_results as any[])
        .map((raw: any) => normalizeResult(raw))
        .filter((r): r is AlgorithmResult => r !== null)
    : undefined;
  const best = normalizeResult(src.best_model);
  return {
    status: String(src.status ?? 'unknown'),
    progress: num(src.progress) ?? 0,
    current_step: String(src.current_step ?? ''),
    current_model: src.current_model,
    model_index: num(src.model_index) ?? undefined,
    total_models: num(src.total_models) ?? undefined,
    completed_models: num(src.completed_models) ?? undefined,
    message: String(src.message ?? ''),
    error: typeof src.error === 'string' ? src.error : undefined,
    logs: Array.isArray(src.logs) ? src.logs : [],
    metrics_history: Array.isArray(src.metrics_history) ? src.metrics_history : [],
    latest_result: normalizeResult(src.latest_result) ?? undefined,
    // Drop a "best model" that has no metrics; the UI recomputes it from the
    // real values rather than trusting a badge that may predate the numbers.
    best_model: best && best.status === 'success' && best.metrics ? best : undefined,
    all_results: allResults,
    task_type: taskType,
    rank_metric: src.rank_metric === 'r2' ? 'r2' : RANK_METRIC[taskType],
    failed_count: num(src.failed_count) ?? undefined,
    saved_model_name: src.saved_model_name ?? null,
    save_warning: src.save_warning,
    cpu_percent: num(src.cpu_percent) ?? undefined,
    elapsed: num(src.elapsed) ?? undefined,
    start_time: num(src.start_time) ?? undefined,
  };
}

/**
 * Pick the best model from measured values only.
 *
 * Returns null unless at least one algorithm produced a real score for the
 * task's ranking metric, so "Best" can never appear next to an empty row.
 */
export function pickBestResult(
  results: AlgorithmResult[],
  rankMetric: 'accuracy' | 'r2',
): AlgorithmResult | null {
  const scored = results.filter(
    (r) => r.status === 'success' && r.metrics != null && num(r.metrics[rankMetric]) !== null,
  );
  if (scored.length === 0) return null;
  return scored.reduce((best, r) => ((r.metrics![rankMetric] as number) > (best.metrics![rankMetric] as number) ? r : best));
}

export const trainingService = {
  start: (file_name: string, target_column: string, hyperparameters?: Record<string, any>) => {
    const form = new FormData();
    form.append('file_name', file_name);
    form.append('target_column', target_column);
    if (hyperparameters) form.append('hyperparameters', JSON.stringify(hyperparameters));
    return http.post<Experiment>('/training', form);
  },

  runWorkflow: (config: {
    file_name: string; target_column: string; task_type?: string; algorithms?: string;
    cv_folds?: number; optimize_hyperparameters?: boolean; project_id?: string;
  }) => {
    const form = new FormData();
    form.append('file_name', config.file_name);
    form.append('target_column', config.target_column);
    form.append('task_type', config.task_type || 'classification');
    form.append('algorithms', config.algorithms || 'all');
    form.append('cv_folds', String(config.cv_folds || 5));
    form.append('optimize_hyperparameters', String(config.optimize_hyperparameters ?? true));
    if (config.project_id) form.append('project_id', config.project_id);
    return http.post<{ job_id: string; status: string; message?: string }>('/training/run', form);
  },

  subscribeProgress: (jobId: string, onProgress: (data: TrainingProgress) => void): (() => void) => {
    // Must be built from BASE like every other request. The hardcoded
    // "/api/v1/..." path resolved against the frontend origin, so in
    // production the stream never reached the API and the UI sat on the
    // training step forever with no results.
    const url = `${BASE}/training/${jobId}/progress`;
    console.log('TRAINING API REQUEST (SSE):', url);
    const eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);
        console.log('TRAINING API RESPONSE:', raw);
        const data = normalizeProgress(raw);
        console.log('TRAINING RESULTS:', data.all_results);
        onProgress(data);
        if (['completed', 'failed', 'cancelled', 'timeout'].includes(data.status)) {
          eventSource.close();
        }
      } catch (err) {
        console.error('TRAINING API RESPONSE: parse error', err);
      }
    };
    eventSource.onerror = () => {
      console.error('TRAINING API RESPONSE: SSE stream error');
      eventSource.close();
    };
    return () => eventSource.close();
  },

  list: () => http.get<{ jobs: TrainingJob[] }>('/training'),

  get: (id: string) => http.get<Experiment>(`/training/${id}`),

  cancel: (id: string) => http.post(`/training/${id}/cancel`),

  queue: () => http.get<{ jobs: TrainingJob[] }>('/training/queue'),

  algorithms: () => http.get<{ classification: AlgorithmInfo[]; regression: AlgorithmInfo[]; optional: Record<string, boolean> }>('/training/algorithms'),
};
