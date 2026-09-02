import { http } from './http';
import type { Webhook } from '../types/api';

export const webhooksService = {
  list: () => http.get<{ webhooks: Webhook[] }>('/webhooks'),

  create: (data: { name: string; url: string; events: string[] }) =>
    http.post<Webhook>('/webhooks', data),

  remove: (webhook_id: string) => http.delete(`/webhooks/${webhook_id}`),

  test: (webhook_id: string) => http.post(`/webhooks/${webhook_id}/test`),
};
