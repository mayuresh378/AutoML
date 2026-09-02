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
  probability?: Record<string, number>;
  residual?: number;
}

export interface ClassDistributionItem {
  label: string;
  count: number;
  pct: number;
}

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

export interface ComprehensiveEvaluation {
  model_name: string;
  task_type: string;
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
  ai_insights?: string;
  warnings?: string[];
}

export interface ModelComparisonResult {
  model_name: string;
  task_type?: string;
  metrics?: EvaluationMetrics;
  training_time?: number;
  feature_importance?: FeatureImportanceItem[];
  error?: string;
}

export const evaluationService = {
  comprehensive: (modelName: string, fileName: string, targetColumn: string) => {
    const form = new FormData();
    form.append('file_name', fileName);
    form.append('target_column', targetColumn);
    return http.post<ComprehensiveEvaluation>(`/models/${encodeURIComponent(modelName)}/evaluate-all`, form);
  },

  compare: (modelNames: string[], fileName: string, targetColumn: string) => {
    const form = new FormData();
    form.append('model_names', JSON.stringify(modelNames));
    form.append('file_name', fileName);
    form.append('target_column', targetColumn);
    return http.post<{ results: ModelComparisonResult[] }>('/models/compare', form);
  },
};
