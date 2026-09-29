import { http } from './http';
import type { MonitoringStats } from '../types/api';

export const monitoringService = {
  stats: () => http.get<MonitoringStats>('/monitoring/stats'),
};
