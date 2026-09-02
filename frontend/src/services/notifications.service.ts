import { http } from './http';
import type { Notification } from '../types/api';

export const notificationsService = {
  list: () => http.get<{ notifications: Notification[] }>('/notifications'),

  markRead: (id: string) => http.post(`/notifications/${id}/read`),

  markAllRead: () => http.post('/notifications/read-all'),

  dismiss: (id: string) => http.delete(`/notifications/${id}`),

  unreadCount: () => http.get<{ count: number }>('/notifications/unread-count'),
};
