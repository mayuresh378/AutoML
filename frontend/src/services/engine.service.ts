import { http } from './http';
import type { Dataset } from '../types/api';

export interface EngineModelsResponse {
  classification: string[];
  regression: string[];
  clustering: string[];
  time_series: string[];
  optional: Record<string, boolean>;
}

export interface EngineDataset {
  name: string;
  columns: string[];
  rows: number;
}

export interface EngineResult {
  name: string;
  status: 'success' | 'error';
  cv_score?: number;
  metrics?: Record<string, any>;
  training_time?: number;
  feature_importance?: { feature: string; importance: number }[];
  best_params?: Record<string, any>;
  model_path?: string;
  error?: string;
}

export interface EngineProgress {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'preprocessing' | 'training';
  current_model?: string;
  current?: number;
  total?: number;
  task_type?: string;
  message?: string;
  results?: EngineResult[];
  best_model?: string;
  best_metrics?: Record<string, any>;
  elapsed?: number;
  error?: string;
  experiments?: { id: string; name: string; model: string }[];
  timestamp?: number;
}

export const engineService = {
  models: () => http.get<EngineModelsResponse>('/engine/models'),

  datasets: () => http.get<{ datasets: EngineDataset[] }>('/engine/datasets'),

  run: (config: {
    file_name: string;
    target_column?: string;
    task_type: string;
    models?: string[];
    cv_folds?: number;
    project_id?: string;
    n_clusters?: number;
    preprocess?: Record<string, boolean>;
    validation?: { method: string; cv_folds: number; test_size: number; shuffle: boolean; random_seed: number };
  }) => {
    const form = new FormData();
    form.append('file_name', config.file_name);
    form.append('target_column', config.target_column || '');
    form.append('task_type', config.task_type);
    form.append('models', JSON.stringify(config.models || []));
    form.append('cv_folds', String(config.cv_folds || 5));
    form.append('preprocess', JSON.stringify(config.preprocess || {}));
    form.append('validation', JSON.stringify(config.validation || {}));
    if (config.project_id) form.append('project_id', config.project_id);
    if (config.n_clusters != null) form.append('n_clusters', String(config.n_clusters));
    return http.post<{ job_id: string; status: string; total: number }>('/engine/run', form);
  },

  subscribeProgress: (jobId: string, onProgress: (data: EngineProgress) => void): (() => void) => {
    const url = `/api/v1/engine/${jobId}/progress`;
    const TERMINAL = ['completed', 'failed', 'cancelled'];
    let source: EventSource | null = null;
    let done = false;
    let closed = false;
    let attempts = 0;

    const attach = () => {
      source = new EventSource(url);
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          attempts = 0;
          onProgress(data);
          if (TERMINAL.includes(data.status)) {
            done = true;
            source?.close();
          }
        } catch {}
      };
      source.onerror = () => {
        source?.close();
        if (done || closed) return;
        attempts += 1;
        http.get<EngineProgress>(`/engine/${jobId}`).then((data) => {
          if (done || closed) return;
          if (TERMINAL.includes(data.status)) {
            onProgress(data);
          } else if (attempts <= 4) {
            setTimeout(attach, 1500 * attempts);
          } else {
            onProgress({ status: 'failed', error: 'Connection lost while streaming results', message: 'Training interrupted' });
          }
        }).catch(() => {
          if (done || closed) return;
          if (attempts <= 4) {
            setTimeout(attach, 1500 * attempts);
          } else {
            onProgress({ status: 'failed', error: 'Connection lost while streaming results', message: 'Training interrupted' });
          }
        });
      };
    };
    attach();
    return () => { closed = true; source?.close(); };
  },

  getResult: (jobId: string) => http.get<EngineProgress>(`/engine/${jobId}`),
};
