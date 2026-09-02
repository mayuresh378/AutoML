import { http } from './http';
import type { ApiKey } from '../types/api';

export const apiKeysService = {
  list: () => http.get<{ api_keys: ApiKey[] }>('/api-keys'),

  create: (name: string) => {
    const form = new FormData();
    form.append('name', name);
    return http.post<ApiKey>('/api-keys', form);
  },

  remove: (key_id: string) => http.delete(`/api-keys/${key_id}`),
};
