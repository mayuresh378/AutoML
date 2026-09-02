import { http } from './http';
import type { Pipeline, PipelineRun } from '../types/api';

export const pipelinesService = {
  list: () => http.get<{ pipelines: Pipeline[] }>('/pipelines'),

  get: (id: string) => http.get<Pipeline>(`/pipelines/${id}`),

  create: (name: string, steps: any[], description?: string) =>
    http.post<Pipeline>('/pipelines', { name, steps, description }),

  update: (id: string, data: { name?: string; description?: string; steps?: any[]; schedule?: string }) =>
    http.put<Pipeline>(`/pipelines/${id}`, data),

  delete: (id: string) => http.delete(`/pipelines/${id}`),

  run: (pipeline_id: string) =>
    http.post<PipelineRun>(`/pipelines/${pipeline_id}/run`),

  runs: (pipeline_id: string) =>
    http.get<{ runs: PipelineRun[] }>(`/pipelines/${pipeline_id}/runs`),

  getRun: (run_id: string) =>
    http.get<PipelineRun>(`/pipeline-runs/${run_id}`),
};
