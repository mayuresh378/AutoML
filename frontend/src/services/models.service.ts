import { http } from './http';
import type { Model } from '../types/api';

/**
 * Statuses that make a model unusable in a selection dropdown.
 * A model that is merely "staging" or has no status at all is still trained
 * and loadable, so it stays selectable. Gating on `status === 'ready'`
 * instead of excluding the terminal states silently emptied these dropdowns,
 * because the API reports staged models as "staging".
 */
const UNUSABLE_STATUSES = new Set(['failed', 'archived']);

export function isModelUsable(model: Pick<Model, 'status'>): boolean {
  const status = (model.status ?? '').toString().toLowerCase();
  return !UNUSABLE_STATUSES.has(status);
}

export function filterUsableModels(models: Model[] | undefined | null): Model[] {
  return (models ?? []).filter(isModelUsable);
}

export const modelsService = {
  list: (options?: { allUsers?: boolean }) =>
    http.get<{ models: Model[] }>(options?.allUsers ? '/models?all_users=true' : '/models'),

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
