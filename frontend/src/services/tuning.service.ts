import { http, BASE } from './http';
import type { HPOAvailability, HPOExperiment, HPOExperimentList, HPOProgress, TargetAnalysis } from '../types/api';

export const tuningService = {
  availability: () => http.get<HPOAvailability>('/hpo/availability'),

  params: () => http.get<{ classification: Record<string, unknown>; regression: Record<string, unknown>; ranges: Record<string, unknown> }>('/hpo/params'),

  analyzeTarget: (file_name: string, target_column: string, opts?: { task_type?: string; cv_folds?: number }) => {
    const form = new FormData();
    form.append('file_name', file_name);
    form.append('target_column', target_column);
    if (opts?.task_type) form.append('task_type', opts.task_type);
    form.append('cv_folds', String(opts?.cv_folds ?? 5));
    return http.post<TargetAnalysis>('/hpo/target-analysis', form);
  },

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

  cancel: (jobId: string) => http.delete<{ status: string; message: string }>(`/hpo/${jobId}`),

  experiments: () => http.get<HPOExperimentList>('/hpo/experiments'),

  experimentDetail: (expId: string) => http.get<HPOExperiment>(`/hpo/experiments/${expId}`),

  rerunExperiment: (expId: string) => http.post<{ job_id: string; status: string; rerun_of: string }>(`/hpo/experiments/${expId}/rerun`, null),

  deleteExperiment: (expId: string) => http.delete<{ status: string; id: string }>(`/hpo/experiments/${expId}`),

  /**
   * Subscribe to SSE progress with automatic reconnection and a fallback to
   * authenticated HTTP polling. Native EventSource cannot send Authorization
   * headers, so the SSE endpoint is public while `getResults` (the polling
   * fallback) is authenticated.
   */
  subscribeProgress: (jobId: string, onProgress: (data: HPOProgress) => void): (() => void) => {
    let closed = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let failures = 0;
    let retryDelay = 1500;
    const url = `${BASE}/hpo/${jobId}/progress`;

    function isTerminal(data: HPOProgress): boolean {
      return data?.status === 'completed' || data?.status === 'failed' || data?.status === 'cancelled';
    }

    function stop() {
      closed = true;
      if (es) { try { es.close(); } catch { /* noop */ } es = null; }
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    function apply(data: HPOProgress) {
      if (closed) return;
      onProgress(data);
      if (isTerminal(data)) stop();
    }

    function startPolling() {
      if (closed || pollTimer) return;
      pollTimer = setInterval(() => {
        if (closed) return;
        tuningService.getResults(jobId)
          .then((data) => { failures = 0; apply(data); })
          .catch(() => { /* transient; keep polling */ });
      }, 3000);
    }

    function connect() {
      if (closed) return;
      try { if (es) es.close(); } catch { /* noop */ }
      es = new EventSource(url);
      es.onmessage = (event) => {
        failures = 0;
        try {
          apply(JSON.parse(event.data) as HPOProgress);
        } catch { /* ignore malformed frames */ }
      };
      es.onerror = () => {
        failures += 1;
        try { if (es) es.close(); } catch { /* noop */ }
        es = null;
        if (closed) return;
        if (failures >= 5) { startPolling(); return; }
        setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 10000);
      };
    }

    connect();
    return stop;
  },

  getResults: (jobId: string) => http.get<HPOProgress>(`/hpo/${jobId}`),
};