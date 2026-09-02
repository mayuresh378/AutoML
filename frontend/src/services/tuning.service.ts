import { http } from './http';
import type { HPOAvailability, HPOProgress } from '../types/api';

export const tuningService = {
  availability: () => http.get<HPOAvailability>('/hpo/availability'),

  params: () => http.get('/hpo/params'),

  run: (config: {
    file_name: string;
    target_column: string;
    models: string[];
    method: string;
    cv_folds: number;
    n_iter: number;
    task_type?: string;
    project_id?: string;
  }) => {
    const form = new FormData();
    form.append('file_name', config.file_name);
    form.append('target_column', config.target_column);
    form.append('models', JSON.stringify(config.models));
    form.append('method', config.method);
    form.append('cv_folds', String(config.cv_folds));
    form.append('n_iter', String(config.n_iter));
    if (config.task_type) form.append('task_type', config.task_type);
    if (config.project_id) form.append('project_id', config.project_id);
    return http.post<{ job_id: string; status: string }>('/hpo/run', form);
  },

  subscribeProgress: (jobId: string, onProgress: (data: HPOProgress) => void): (() => void) => {
    const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api/v1';
    const url = `${BASE}/hpo/${jobId}/progress`;
    const es = new EventSource(url);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress(data);
      } catch { /* ignore */ }
    };
    es.onerror = () => { es.close(); };
    return () => es.close();
  },

  getResults: (jobId: string) => http.get<HPOProgress>(`/hpo/${jobId}`),
};
