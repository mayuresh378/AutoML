import { http } from './http';
import type { Model } from '../types/api';

export const modelsService = {
  list: () => http.get<{ models: Model[] }>('/models'),

  get: (name: string) => http.get<Model>(`/models/${encodeURIComponent(name)}`),

  remove: (name: string) => http.delete(`/models/${encodeURIComponent(name)}`),

  download: (name: string) => `/api/v1/models/${encodeURIComponent(name)}/download`,

  promote: (name: string) => http.put(`/models/${encodeURIComponent(name)}/promote`),

  archive: (name: string) => http.put(`/models/${encodeURIComponent(name)}/archive`),

  updateTags: (name: string, tags: string[]) => {
    const form = new FormData();
    form.append('tags', JSON.stringify(tags));
    return http.put(`/models/${encodeURIComponent(name)}/tags`, form);
  },

  updateStatus: (name: string, status: string) => {
    const form = new FormData();
    form.append('status', status);
    return http.put(`/models/${encodeURIComponent(name)}`, form);
  },

  compare: (names: string[]) => {
    const form = new FormData();
    form.append('names', JSON.stringify(names));
    return http.post<{ models: Model[] }>('/models/compare', form);
  },

  registry: {
    list: () => http.get<{ models: Model[] }>('/models/registry'),
    register: (model_name: string, version?: string) => {
      const form = new FormData();
      form.append('model_name', model_name);
      if (version) form.append('version', version);
      return http.post('/models/registry', form);
    },
  },
};
