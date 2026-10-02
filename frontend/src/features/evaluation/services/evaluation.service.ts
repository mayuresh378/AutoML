import { http } from '../../../services/http';

export interface ConfusionMatrixData {
  matrix: number[][];
  labels: string[];
}

export interface RocCurveData {
  fpr: number[];
  tpr: number[];
  auc: number;
  per_class?: { label: string; fpr: number[]; tpr: number[]; auc: number }[];
  macro_auc?: number;
}

export interface PrCurveData {
  precision: number[];
  recall: number[];
  average_precision: number;
  per_class?: { label: string; precision: number[]; recall: number[]; ap: number }[];
  macro_ap?: number;
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
  normalized: number;
}

export interface LearningCurveData {
  train_sizes: number[];
  train_mean: number[];
  train_std: number[];
  val_mean: number[];
  val_std: number[];
  scoring: string;
  error?: string;
}

export interface ValidationCurveData {
  param_name: string;
  param_range: string[];
  train_mean: number[];
  train_std: number[];
  val_mean: number[];
  val_std: number[];
  scoring: string;
  error?: string;
}

export interface ResidualPlotData {
  predicted: number[];
  residuals: number[];
  actual: number[];
  mean_residual: number;
  std_residual: number;
}

export interface PredictionDistributionData {
  type: 'classification' | 'regression';
  predictions: { label: string; count: number; pct: number }[] | number[];
  actual?: number[];
  total?: number;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
}

export interface PredictionSample {
  actual: string | number;
  predicted: string | number;
  correct?: boolean;
  probability?: Record<string, number> | null;
  residual?: number;
  abs_error?: number;
}

export interface ClassDistributionItem {
  label: string;
  count: number;
  pct: number;
}

export type TaskType = 'classification' | 'regression';

export interface EvaluationMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  mcc?: number;
  cohen_kappa?: number;
  log_loss?: number;
  roc_auc?: number;
  mae?: number;
  mse?: number;
  rmse?: number;
  r2?: number;
  mape?: number;
}

export type InsightSeverity = 'info' | 'positive' | 'warning' | 'critical';

export interface EvaluationInsight {
  key: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  evidence?: Record<string, unknown> | null;
}

export interface DatasetAnalyzeResponse {
  file_name: string;
  rows: number;
  columns: string[];
  missing_count: number;
  duplicate_count: number;
  dtypes: Record<string, string>;
  suggested_target: string;
  target_confidence: 'High' | 'Medium' | 'Low';
  detected_task_type: TaskType;
  potential_id_columns: string[];
  numeric_columns: string[];
  categorical_columns: string[];
  preview_data: Record<string, unknown>[];
}

export interface ComprehensiveEvaluation {
  model_name: string;
  dataset_name: string;
  target_column: string;
  task_type: TaskType;
  /** Columns the estimator actually consumes, after any preprocessor. */
  input_feature_names: string[];
  feature_names: string[];
  metrics: EvaluationMetrics;
  train_size: number;
  test_size: number;
  confusion_matrix: ConfusionMatrixData | null;
  roc_curve: RocCurveData | null;
  pr_curve: PrCurveData | null;
  feature_importance: FeatureImportanceItem[];
  learning_curve: LearningCurveData;
  validation_curve: ValidationCurveData;
  residual_plot: ResidualPlotData | null;
  prediction_distribution: PredictionDistributionData;
  prediction_samples: PredictionSample[];
  class_distribution: ClassDistributionItem[] | null;
  insights: EvaluationInsight[];
  /** Rendered text form of `insights`, persisted with the record. */
  ai_insights?: string;
  warnings: string[];
  /** Metrics/charts that do not apply or could not be computed, with reasons. */
  unavailable: string[];
  preprocessing_summary?: string[];
  model_comparison?: {
    model_name: string;
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1?: number;
    roc_auc?: number;
    mae?: number;
    mse?: number;
    rmse?: number;
    r2?: number;
  }[];
  best_model_name?: string;
  evaluation_id?: string;
  created_at?: string;
}

export interface StoredEvaluation {
  id: string;
  model_id?: string;
  model_name: string;
  dataset_name: string;
  target_column: string;
  task_type: TaskType;
  metrics: EvaluationMetrics;
  /**
   * Full evaluation payload. Verified against the live API: this is null and
   * the real payload arrives in `results_summary`, so consumers must read
   * `results_summary` and fall back to `result`.
   */
  result: ComprehensiveEvaluation | null;
  results_summary?: ComprehensiveEvaluation | null;
  ai_insights?: string;
  created_at?: string;
}

export interface ModelComparisonResult {
  model_name: string;
  file_name?: string;
  dataset_name?: string;
  target_column?: string;
  task_type?: TaskType;
  metrics?: EvaluationMetrics;
  train_size?: number;
  test_size?: number;
  /** Present when this individual model could not be evaluated. */
  error?: string;
}

export interface EvaluationRecordItem {
  id: string;
  model_id?: string;
  model_name: string;
  dataset_id?: string;
  dataset_name: string;
  target_column: string;
  task_type: TaskType;
  metrics: EvaluationMetrics;
  ai_insights?: string;
  created_at?: string;
}

export interface EvaluateRequest {
  model_name: string;
  dataset_name: string;
  target_column: string;
}

export interface DatasetEvaluationRequest {
  file_name: string;
  dataset_name?: string;
  target_column?: string;
  task_type?: TaskType;
}

export interface HistoryParams {
  search?: string;
  sort_by?: 'created_at' | 'model_name' | 'dataset_name' | 'target_column' | 'task_type';
  order?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

export interface HistoryResponse {
  evaluations: EvaluationRecordItem[];
  total: number;
  offset: number;
  limit: number;
}

export const evaluationService = {
  /**
   * Run a full model-based evaluation.
   */
  evaluate: (payload: EvaluateRequest, init?: { signal?: AbortSignal }) => {
    return http.post<ComprehensiveEvaluation>(
      '/evaluation/evaluate',
      payload,
      { ...init, timeoutMs: 120_000 },
    );
  },

  /**
   * Analyze raw CSV dataset for automatic target detection and task identification.
   */
  analyzeDataset: (fileName: string, targetColumn?: string) => {
    return http.post<DatasetAnalyzeResponse>(
      '/evaluation/analyze',
      { file_name: fileName, target_column: targetColumn },
      { timeoutMs: 30_000 }
    );
  },

  /**
   * Run end-to-end dataset-driven baseline training and model evaluation.
   */
  evaluateDataset: (payload: DatasetEvaluationRequest, init?: { signal?: AbortSignal }) => {
    return http.post<ComprehensiveEvaluation>(
      '/evaluation/run-dataset',
      payload,
      { ...init, timeoutMs: 180_000 }
    );
  },

  /**
   * Evaluate several models on one shared test set.
   */
  compare: (modelNames: string[], fileName: string, targetColumn: string) => {
    const form = new FormData();
    form.append('model_names', JSON.stringify(modelNames));
    form.append('file_name', fileName);
    form.append('target_column', targetColumn);
    return http.post<{ results: ModelComparisonResult[]; total: number; failed: number }>(
      '/models/compare',
      form,
      { timeoutMs: 180_000 },
    );
  },

  history: (params: HistoryParams = {}) => {
    return http.get<HistoryResponse>('/evaluation/history', params);
  },

  get: (evalId: string) => {
    return http.get<StoredEvaluation>(`/evaluation/${encodeURIComponent(evalId)}`);
  },
};


