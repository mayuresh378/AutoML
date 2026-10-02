export interface ApiError {
  code: string;
  details?: string;
  field?: string;
}

export interface ApiResponse<T = any> {
  status: 'ok' | 'error';
  data?: T;
  message?: string;
  error?: ApiError;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface PaginatedApiResponse<T> extends ApiResponse<PaginatedResponse<T>> {}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'viewer';
  email_verified: boolean;
  avatar_url?: string | null;
  preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  refresh_token: string;
  user: User;
}

export interface Dataset {
  id: string;
  name: string;
  /**
   * Only returned by a few endpoints (import-url, import-database, version
   * detail). The dataset list endpoint returns `name` only, so this must stay
   * optional -- declaring it required let `d.filename` compile while always
   * evaluating to `undefined` at runtime and silently broke consumers.
   */
  filename?: string;
  rows: number;
  columns: string[];
  size_kb: number;
  status: 'uploaded' | 'processing' | 'ready' | 'error';
  description?: string;
  tags?: string[];
  version?: number;
  source?: 'upload' | 'url' | 'database';
  source_url?: string;
  shared_with?: string[];
  created_at: string;
  updated_at: string;
}

export interface DatasetPreview {
  columns: string[];
  rows: Record<string, any>[];
  total: number;
  dtypes: Record<string, string>;
}

export interface DatasetProfile {
  name: string;
  rows: number;
  columns: number;
  column_details: ColumnProfile[];
  missing_values: number;
  missing_pct: number;
  duplicates: number;
  dtypes: Record<string, string>;
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  missing: number;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  std?: number;
  outliers?: number;
  unique_values?: number;
  top_values?: Record<string, number>;
}

export interface TargetCandidate {
  column: string;
  score: number;
  reason: string;
}

export interface TargetDetection {
  candidates: TargetCandidate[];
  suggested: string | null;
}

export interface MissingColumn {
  column: string;
  missing: number;
  pct: number;
  dtype: string;
}

export interface MissingAnalysis {
  total_missing: number;
  missing_pct: number;
  severity: string;
  columns: MissingColumn[];
}

export interface DuplicateAnalysis {
  count: number;
  pct: number;
  severity: string;
}

export interface OutlierColumn {
  column: string;
  outliers: number;
  pct: number;
  lower_bound: number;
  upper_bound: number;
}

export interface OutlierAnalysis {
  total_outliers: number;
  columns: OutlierColumn[];
  mean_pct: number;
}

export interface ClassDistribution {
  [key: string]: { count: number; pct: number };
}

export interface ClassImbalance {
  detected: boolean;
  target?: string;
  distribution?: ClassDistribution;
  imbalance_ratio?: number;
  severity?: string;
  classes?: number;
}

export interface CorrelationPair {
  x: string;
  y: string;
  value: number;
}

export interface CorrelationAnalysis {
  matrix: Array<{ column: string; [col: string]: number | string }>;
  columns: string[];
  top_correlations: CorrelationPair[];
  size: number;
  message?: string;
}

export interface DistributionColumn {
  column: string;
  bins: number[];
  bin_edges: number[];
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  skewness: number;
}

export interface DistributionAnalysis {
  columns: DistributionColumn[];
}

export interface QualityScore {
  total: number;
  grade: string;
  components: Record<string, number>;
  deductions: string[];
}

export interface Recommendation {
  action: string;
  priority: string;
  message: string;
  columns?: string[];
}

export interface DatasetAnalysisResult {
  name: string;
  rows: number;
  columns: number;
  target: string | null;
  target_detection: TargetDetection | null;
  feature_types: Record<string, string[]>;
  missing: MissingAnalysis;
  duplicates: DuplicateAnalysis;
  outliers: OutlierAnalysis;
  class_imbalance: ClassImbalance;
  correlation: CorrelationAnalysis;
  distributions: DistributionAnalysis;
  quality_score: QualityScore;
  recommendations: Recommendation[];
  insights: string[];
}

export interface Experiment {
  id: string;
  name: string;
  model: string;
  task_type: string;
  dataset: string;
  dataset_version?: string | null;
  target: string;
  cv_score: number | null;
  metrics?: Record<string, any>;
  training_time: number | null;
  total_time: number | null;
  memory_usage?: number | null;
  cpu_usage?: number | null;
  status: 'running' | 'completed' | 'failed' | 'queued' | 'success';
  params?: Record<string, any>;
  notes?: string | null;
  feature_importance?: { feature: string; importance: number }[];
  confusion_matrix?: number[][];
  user_id?: string | null;
  project_id?: string | null;
  run_at: string | null;
  created_at: string;
}

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  mae?: number;
  mse?: number;
  rmse?: number;
  r2_score?: number;
  confusion_matrix?: number[][];
}

export interface Model {
  id?: string;
  name: string;
  algorithm?: string;
  model_type?: string;
  task_type?: string;
  dataset_name?: string;
  target_column?: string;
  status?: 'training' | 'ready' | 'failed' | 'archived' | 'staging' | 'production' | 'registered';
  metrics?: ModelMetrics;
  version?: number;
  size_bytes?: number;
  size_kb?: number;
  file_path?: string;
  file_size_kb?: number;
  best_score?: number;
  cv_score?: number;
  framework?: string;
  experiment_id?: string;
  user_id?: string;
  params?: Record<string, any>;
  tags?: string[];
  description?: string;
  owner?: string;
  owner_email?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived' | 'completed' | 'development' | 'training' | string;
  problem_type?: 'classification' | 'regression' | 'time_series' | 'clustering' | string;
  visibility?: 'private' | 'team' | string;
  version?: number;
  tags?: string[];
  notes?: string;
  owner?: string;
  dataset_count?: number;
  experiment_count?: number;
  model_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_triggered_at?: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at?: string;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  member_count: number;
  created_at: string;
}

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  downloads: number;
  rating: number;
  installed: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id?: string;
  actor: string;
  action: string;
  target: string;
  resource_type?: string;
  resource_id?: string;
  target_type: string;
  details?: string;
  ip_address?: string;
  status?: string;
  run_at?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'info' | 'warning' | 'error';
  read: boolean;
  created_at: string;
}

export interface AuthSession {
  id: string;
  device_info?: string;
  ip_address?: string;
  is_current: boolean;
  last_active_at: string;
  created_at: string;
}

export interface SearchResults {
  users: User[];
  projects: Project[];
  datasets: Dataset[];
  models: Model[];
  experiments?: Array<Record<string, any>>;
  predictions?: Array<Record<string, any>>;
  registry_models?: Array<Record<string, any>>;
}

export interface MonitoringStats {
  total_models: number;
  total_datasets: number;
  total_experiments: number;
  total_predictions: number;
  avg_training_time?: number;
  success_rate: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  database: 'connected' | 'disconnected';
  disk_usage_pct: number;
  uptime_seconds: number;
  version: string;
}

export interface TrainingJob {
  id: string;
  experiment_name: string;
  dataset_name: string;
  target_column: string;
  algorithm: string;
  status: 'queued' | 'training' | 'completed' | 'failed';
  progress: number;
  eta?: string;
  created_at: string;
}

export interface HPOParamRange {
  low?: number;
  high?: number;
  step?: number;
  log?: boolean;
  values?: (string | number)[];
}

export interface HPOResult {
  name: string;
  best_params?: Record<string, any>;
  cv_score?: number;
  fold_scores?: number[];
  metrics?: Record<string, any>;
  training_time?: number;
  n_candidates?: number;
  trials?: number;
  error?: string;
}

export interface HPOProgress {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'starting';
  current_model?: string;
  current?: number;
  total?: number;
  best_params?: Record<string, any>;
  best_score?: number;
  error?: string;
  message?: string;
  model_results?: { name: string; params?: Record<string, any>; score?: number; error?: string }[];
  best_model?: string;
  best_metrics?: Record<string, any>;
  experiments?: { id: string; name: string; model: string; cv_score: number }[];
  saved_model_name?: string;
  save_warning?: string;
  timestamp?: number;
}

export interface HPOAvailability {
  optuna: boolean;
  bayesian: boolean;
  grid: boolean;
  random: boolean;
  param_ranges: Record<string, Record<string, HPOParamRange>>;
  classification_models?: string[];
  regression_models?: string[];
}

export interface TargetAnalysis {
  target_column: string;
  task_type: 'classification' | 'regression';
  total_samples: number;
  missing_count: number;
  n_classes?: number;
  min_class_count?: number;
  max_class_count?: number;
  class_counts?: Record<string, number>;
  high_cardinality: boolean;
  identifier_like: boolean;
  cardinality_reason?: string;
  example_values?: string[];
  blocked: boolean;
  block_reason?: string;
  warning?: string;
  cv_folds_selected: number;
  safe_cv_folds: number;
  cv_adjusted: boolean;
  cv_valid: boolean;
  cv_note?: string;
}

export type EngineTaskType = 'classification' | 'regression' | 'clustering' | 'time_series';

export interface EngineDataset {
  name: string;
  columns: string[];
  rows: number;
}

export interface EngineResult {
  name: string;
  status: 'success' | 'error';
  cv_score?: number;
  metrics?: Record<string, any>;
  training_time?: number;
  feature_importance?: { feature: string; importance: number }[];
  best_params?: Record<string, any>;
  model_path?: string;
  error?: string;
}

export interface EngineProgress {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'preprocessing' | 'training';
  current_model?: string;
  current?: number;
  total?: number;
  task_type?: EngineTaskType;
  message?: string;
  results?: EngineResult[];
  best_model?: string;
  best_metrics?: Record<string, any>;
  elapsed?: number;
  error?: string;
  experiments?: { id: string; name: string; model: string }[];
  timestamp?: number;
}
