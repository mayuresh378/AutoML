export interface TrainingJob {
  id: string;
  datasetName: string;
  targetColumn: string;
  algorithm: string;
  status: 'queued' | 'training' | 'complete';
  progress: number;
  eta: string;
}

export interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
}

export const trainingQueue: TrainingJob[] = [
  { id: 'job_8841', datasetName: 'customer_churn.csv', targetColumn: 'churned', algorithm: 'Gradient Boosting', status: 'training', progress: 68, eta: '2m 10s' },
  { id: 'job_8840', datasetName: 'iris.csv', targetColumn: 'species', algorithm: 'Random Forest', status: 'training', progress: 34, eta: '4m 45s' },
  { id: 'job_8839', datasetName: 'fraud_signals.csv', targetColumn: 'is_fraud', algorithm: 'Logistic Regression', status: 'queued', progress: 0, eta: 'waiting' },
  { id: 'job_8838', datasetName: 'housing_prices.csv', targetColumn: 'price', algorithm: 'Gradient Boosting', status: 'queued', progress: 0, eta: 'waiting' },
];

export const activityFeed: ActivityItem[] = [
  { id: 'a1', actor: 'You', action: 'uploaded', target: 'customer_churn.csv', time: '4 min ago' },
  { id: 'a2', actor: 'AutoML Engine', action: 'finished training', target: 'iris-baseline', time: '1h ago' },
  { id: 'a3', actor: 'You', action: 'deployed', target: 'fraud-detect-v2', time: '3h ago' },
  { id: 'a4', actor: 'AutoML Engine', action: 'flagged a schema drift in', target: 'housing_prices.csv', time: '5h ago' },
  { id: 'a5', actor: 'You', action: 'created project', target: 'Q3 Churn Model', time: '1d ago' },
];

export const systemMetrics = {
  gpu: { label: 'GPU', value: 74, detail: 'NVIDIA A10G · 1 of 2 in use' },
  cpu: { label: 'CPU', value: 41, detail: '16 vCPU cluster' },
  memory: { label: 'Memory', value: 58, detail: '18.6 GB / 32 GB' },
  storage: { label: 'Storage', value: 22, detail: '112 GB / 500 GB' },
};

export const liveStats = {
  modelsTrained: 128,
  activeDeployments: 6,
  inferenceRequestsToday: 18420,
  avgLatencyMs: 42,
};
