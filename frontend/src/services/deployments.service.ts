import { http } from './http';
import type { Deployment, DeploymentHistoryEntry } from '../types/api';

export const deploymentsService = {
  list: () => http.get<{ deployments: Deployment[] }>('/deployments'),

  get: (id: string) => http.get<Deployment>(`/deployments/${id}`),

  create: (model_name: string, endpoint_name: string) => {
    const form = new FormData();
    form.append('model_name', model_name);
    form.append('endpoint_name', endpoint_name);
    return http.post<Deployment>('/deployments', form);
  },

  remove: (dep_id: string) => http.delete(`/deployments/${dep_id}`),

  updateStatus: (dep_id: string, status: string) => {
    const form = new FormData();
    form.append('status', status);
    return http.put(`/deployments/${dep_id}/status`, form);
  },

  updateAccess: (dep_id: string, data: {
    allow_anonymous?: boolean;
    api_key_required?: boolean;
    rate_limit?: number | null;
    allowed_users?: string[];
    allowed_ips?: string[];
  }) => {
    const form = new FormData();
    if (data.allow_anonymous !== undefined) form.append('allow_anonymous', String(data.allow_anonymous));
    if (data.api_key_required !== undefined) form.append('api_key_required', String(data.api_key_required));
    if (data.rate_limit !== undefined) form.append('rate_limit', String(data.rate_limit ?? ''));
    if (data.allowed_users !== undefined) form.append('allowed_users', JSON.stringify(data.allowed_users));
    if (data.allowed_ips !== undefined) form.append('allowed_ips', JSON.stringify(data.allowed_ips));
    return http.put(`/deployments/${dep_id}/access`, form);
  },

  history: (dep_id: string) =>
    http.get<{ history: DeploymentHistoryEntry[] }>(`/deployments/${dep_id}/history`),

  apiSpec: (dep_id: string) =>
    http.get(`/deployments/${dep_id}/api-spec`),

  fastapiCode: (dep_id: string) =>
    http.get<{ code: string; filename: string }>(`/deployments/${dep_id}/fastapi`),

  dockerCompose: (dep_id: string) =>
    http.get<{ compose: string; dockerfile: string; image: string; port: number }>(`/deployments/${dep_id}/docker`),

  exportOnnx: (dep_id: string) =>
    http.post(`/deployments/${dep_id}/export/onnx`),

  exportPickle: (dep_id: string) =>
    http.post<{ message: string; download_url: string; filename: string; size_bytes: number }>(`/deployments/${dep_id}/export/pickle`),

  download: (dep_id: string) => `/api/v1/deployments/${dep_id}/download`,
};
