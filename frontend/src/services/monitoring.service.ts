import { http } from './http';
import type { MonitoringMetrics } from '../types/api';

export const monitoringService = {
  metrics: () => http.get<MonitoringMetrics>('/monitoring/metrics'),

  stats: () => http.get<{
    modelsTrained: number;
    activeDeployments: number;
    inferenceRequestsToday: number;
    avgLatencyMs: number;
    total_models: number;
    total_datasets: number;
    total_experiments: number;
    total_predictions: number;
    avg_training_time: number;
    success_rate: number;
  }>('/monitoring/stats'),

  dashboard: () => http.get<MonitoringDashboard>('/monitoring/dashboard'),
};

export interface MonitoringDashboard {
  predictions: {
    total: number;
    today: number;
    last_hour: number;
    requests_per_minute: number;
  };
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    histogram: { bucket: string; count: number }[];
    sparkline: { i: number; latency: number }[];
  };
  cpu: number;
  cpu_cores: number;
  load_avg: number;
  ram: number;
  ram_total_gb: number;
  ram_used_gb: number;
  disk: number;
  disk_free_gb: number;
  traffic: {
    per_hour: { hour: string; count: number }[];
    requests_per_minute: number;
  };
  model_drift: { score: number; status: string };
  data_drift: { score: number; status: string };
  drift_timeline: { time: string; model_drift: number; data_drift: number }[];
  alerts: { severity: string; title: string; message: string; time: string }[];
  logs: { model: string; prediction: string; confidence: number; latency_ms: number; time: string }[];
  error_rate: number;
  success_rate: number;
  confidence_distribution: { bucket: string; count: number }[];
}
