import { http } from './http';
import type { Experiment, TrainingJob } from '../types/api';

export interface TrainingProgress {
  status: string;
  progress: number;
  current_step: string;
  current_model?: string;
  model_index?: number;
  total_models?: number;
  completed_models?: number;
  message: string;
  logs: { time: number; message: string }[];
  metrics_history: { model: string; accuracy?: number; r2?: number; rmse?: number; cv_score?: number; f1?: number }[];
  latest_result?: { name: string; metrics: Record<string, number>; cv_score: number; time: number };
  best_model?: { name: string; metrics: Record<string, number>; cv_score: number };
  all_results?: { name: string; metrics: Record<string, number>; cv_score: number; time: number }[];
  cpu_percent?: number;
  elapsed?: number;
  start_time?: number;
}

export interface AlgorithmInfo {
  name: string;
  available: boolean;
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
    file_name: string;
    target_column: string;
    task_type?: string;
    algorithms?: string;
    cv_folds?: number;
    optimize_hyperparameters?: boolean;
    project_id?: string;
  }) => {
    const form = new FormData();
    form.append('file_name', config.file_name);
    form.append('target_column', config.target_column);
    form.append('task_type', config.task_type || 'classification');
    form.append('algorithms', config.algorithms || 'all');
    form.append('cv_folds', String(config.cv_folds || 5));
    form.append('optimize_hyperparameters', String(config.optimize_hyperparameters ?? true));
    if (config.project_id) form.append('project_id', config.project_id);
    return http.post<{ job_id: string; status: string }>('/training/run', form);
  },

  subscribeProgress: (jobId: string, onProgress: (data: TrainingProgress) => void): (() => void) => {
    const url = `/api/v1/training/${jobId}/progress`;
    const eventSource = new EventSource(url);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress(data);
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled' || data.status === 'timeout') {
          eventSource.close();
        }
      } catch {}
    };
    eventSource.onerror = () => eventSource.close();
    return () => eventSource.close();
  },

  list: () => http.get<{ experiments: Experiment[] }>('/training'),

  get: (id: string) => http.get<Experiment>(`/training/${id}`),

  cancel: (id: string) => http.post(`/training/${id}/cancel`),

  queue: () => http.get<{ jobs: TrainingJob[] }>('/training/queue'),

  algorithms: () => http.get<{ classification: AlgorithmInfo[]; regression: AlgorithmInfo[]; optional: Record<string, boolean> }>('/training/algorithms'),
};
