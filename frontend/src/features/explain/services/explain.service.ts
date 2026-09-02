import { http } from '../../../services/http';

export interface FeatureImportance {
  feature: string;
  importance: number;
  normalized: number;
}

export interface ShapValue {
  feature: string;
  value: number;
  abs_value: number;
  direction: 'positive' | 'negative';
  feature_value?: number;
}

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

export interface PredictionPreview {
  actual: string;
  predicted: string;
  top_classes: { label: string; probability: number }[];
}

export interface ModelEvaluation {
  model_name: string;
  task_type: string;
  feature_names: string[];
  feature_importance: FeatureImportance[];
  shap_values: ShapValue[];
  confusion_matrix: ConfusionMatrixData | null;
  roc_curve: RocCurveData | null;
  pr_curve: PrCurveData | null;
  prediction_preview: PredictionPreview[];
  test_size: number;
  train_size: number;
}

export interface FeatureStat {
  feature: string;
  mean: number;
  std: number;
  min: number;
  max: number;
  range: number;
  coefficient_of_variation: number;
}

export interface LIMECoefficient {
  feature: string;
  coefficient: number;
  abs_coefficient: number;
  feature_value: number;
  direction: 'positive' | 'negative';
  contribution: number;
}

export interface LIMEExplanation {
  intercept: number;
  predicted_value: any;
  local_coefficients: LIMECoefficient[];
  top_positive: LIMECoefficient[];
  top_negative: LIMECoefficient[];
  model_r2: number;
}

export interface PredictionContribution {
  feature: string;
  feature_value: number;
  shap_value: number;
  shap_direction: 'positive' | 'negative';
  importance_rank: number;
}

export interface PredictionExplanation {
  prediction: any;
  predicted_class: any;
  confidence: number | null;
  probabilities: Record<string, number>;
  feature_contributions: PredictionContribution[];
  top_positive_factors: PredictionContribution[];
  top_negative_factors: PredictionContribution[];
  explanation_text: string;
  shap_summary: ShapValue[];
  lime_summary: LIMEExplanation;
}

export interface GlobalExplanation {
  feature_statistics: FeatureStat[];
  most_important_features: string[];
  feature_importance_summary: FeatureImportance[];
  prediction_distribution: {
    task_type: string;
    total_samples: number;
    confidence_distribution?: Record<string, number>;
    class_distribution?: Record<string, number>;
  };
  feature_interactions: { feature_a: string; feature_b: string; correlation: number; strength: string }[];
  model_insights: {
    n_features: number;
    n_samples: number;
    high_importance_features: string[];
    has_interactions: boolean;
  };
}

export interface FeatureImportanceResult {
  features: FeatureImportance[];
  methods: Record<string, any>;
  total_features: number;
  top_5: FeatureImportance[];
  bottom_5: FeatureImportance[];
}

export interface ComprehensiveExplanation {
  model_name: string;
  task_type: string;
  feature_names: string[];
  feature_importance: FeatureImportanceResult;
  shap_values: ShapValue[];
  global_explanation: GlobalExplanation;
  local_explanations: any[];
  prediction_explanations: PredictionExplanation[];
  data_summary: {
    total_samples: number;
    train_size: number;
    test_size: number;
    n_features: number;
    task_type: string;
  };
}

export const explainService = {
  evaluate: (modelName: string, fileName: string, targetColumn: string) => {
    const form = new FormData();
    form.append('file_name', fileName);
    form.append('target_column', targetColumn);
    return http.post<ModelEvaluation>(`/models/${encodeURIComponent(modelName)}/evaluation`, form);
  },

  comprehensive: (modelName: string, fileName: string, targetColumn: string) => {
    const form = new FormData();
    form.append('file_name', fileName);
    form.append('target_column', targetColumn);
    return http.post<ComprehensiveExplanation>(`/models/${encodeURIComponent(modelName)}/explain`, form);
  },
};
