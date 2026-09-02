import { http } from './http';
import type { ActivityLog } from '../types/api';

export const activityService = {
  list: (limit = 50, offset = 0) =>
    http.get<{ activities: ActivityLog[] }>('/activity', { limit, offset }),

  get: (id: string) => http.get<ActivityLog>(`/activity/${id}`),
};
