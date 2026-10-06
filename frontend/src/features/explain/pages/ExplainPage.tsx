import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, AlertCircle, Loader2, Sparkles, Globe, BarChart3,
  TrendingUp, MapPin, MessageSquare, Activity, ChevronRight,
} from 'lucide-react';
import {
  explainService,
  type ComprehensiveExplanation,
  type ModelEvaluation,
} from '../services/explain.service';
import { http, getErrorMessage } from '../../../services/http';
import { filterUsableModels } from '../../../services/models.service';
import { Select } from '../../../components/ui/Select';
import type { Model, Dataset } from '../../../types/api';
import { FeatureImportanceChart } from '../components/FeatureImportanceChart';
import { ShapWaterfall } from '../components/ShapWaterfall';
import { ConfusionMatrix } from '../components/ConfusionMatrix';
import { RocCurve } from '../components/RocCurve';
import { PrecisionRecallCurve } from '../components/PrecisionRecallCurve';
import { PredictionPreviewTable } from '../components/PredictionPreview';
import { GlobalExplanationView } from '../components/GlobalExplanationView';
import { LIMEExplanationView } from '../components/LIMEExplanationView';
import { PredictionExplanationView } from '../components/PredictionExplanationView';
import styles from './ExplainPage.module.css';

type TabId = 'global' | 'importance' | 'shap' | 'lime' | 'prediction' | 'evaluation';

const TABS: { id: TabId; label: string; icon: typeof Globe }[] = [
  { id: 'global', label: 'Global Overview', icon: Globe },
  { id: 'importance', label: 'Feature Importance', icon: BarChart3 },
  { id: 'shap', label: 'SHAP Values', icon: TrendingUp },
  { id: 'lime', label: 'LIME Local', icon: MapPin },
  { id: 'prediction', label: 'Prediction', icon: MessageSquare },
  { id: 'evaluation', label: 'Evaluation', icon: Activity },
];

export default function ExplainPage() {
  const [modelName, setModelName] = useState('');
  const [fileName, setFileName] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [result, setResult] = useState<ComprehensiveExplanation | null>(null);
  const [evalResult, setEvalResult] = useState<ModelEvaluation | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('global');

  const modelsQuery = useQuery({
    queryKey: ['models'],
    queryFn: () => http.get<{ models: Model[] }>('/models'),
    select: (data) => filterUsableModels(data.models),
    staleTime: 30_000,
  });

  const datasetsQuery = useQuery({
    queryKey: ['datasets'],
    queryFn: () => http.get<{ datasets: Dataset[] }>('/datasets'),
    select: (data) => data.datasets ?? [],
    staleTime: 30_000,
  });

  const selectedDataset = useMemo(
    () => datasetsQuery.data?.find((d) => d.name === fileName),
    [datasetsQuery.data, fileName],
  );

  const columns = useMemo(() => {
    if (selectedDataset?.columns) return selectedDataset.columns;
    return [];
  }, [selectedDataset]);

  const models = modelsQuery.data ?? [];
  const datasets = datasetsQuery.data ?? [];

  // Loading/failure/empty all previously rendered as the same bare
  // "Select a model" control, so an empty dropdown gave no reason why.
  const modelPlaceholder = modelsQuery.isLoading
    ? 'Loading models...'
    : modelsQuery.isError
      ? 'Could not load models'
      : modelsQuery.isFetching
        ? 'Refreshing models...'
        : 'Select a model';

  const modelLoadError = modelsQuery.isError
    ? getErrorMessage(modelsQuery.error) || 'Failed to load models'
    : null;

  const comprehensiveMutation = useMutation({
    mutationFn: () => explainService.comprehensive(modelName, fileName, targetColumn),
    onSuccess: (data) => { setResult(data); setEvalResult(null); },
  });

  const evaluateMutation = useMutation({
    mutationFn: () => explainService.evaluate(modelName, fileName, targetColumn),
    onSuccess: (data) => { setEvalResult(data); setResult(null); },
  });

  const handleComprehensive = () => {
    if (!modelName.trim() || !fileName.trim() || !targetColumn.trim()) return;
    comprehensiveMutation.mutate();
  };

  const handleEvaluate = () => {
    if (!modelName.trim() || !fileName.trim() || !targetColumn.trim()) return;
    evaluateMutation.mutate();
  };

  const isLoading = comprehensiveMutation.isPending || evaluateMutation.isPending;
  const error = comprehensiveMutation.error || evaluateMutation.error;

  return (
    <div className={styles.page}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Explainable AI</h1>
            <p className={styles.subtitle}>
              Understand your model with SHAP, LIME, Feature Importance, Global, Local, and Prediction explanations
            </p>
          </div>
        </div>

        <div className={styles.inputCard}>
          <div className={styles.inputRow}>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="explain-model-select">Model</label>
              <Select
                id="explain-model-select"
                containerClassName="w-full"
                triggerClassName={styles.select}
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                aria-describedby="explain-model-hint"
                placeholder={modelPlaceholder}
                options={models.map((m) => ({
                  value: m.name,
                  label: `${m.name} (${m.task_type || 'unknown'})`,
                }))}
              />
              <div id="explain-model-hint">
                {modelLoadError && (
                  <p className={styles.hint} role="alert">
                    <AlertCircle size={13} />
                    <span>{modelLoadError}</span>
                    <button type="button" className={styles.hintAction} onClick={() => modelsQuery.refetch()}>
                      Retry
                    </button>
                  </p>
                )}
                {!modelsQuery.isLoading && !modelsQuery.isError && models.length === 0 && (
                  <p className={styles.hint}>
                    No models available. Train a model first, or check that you are signed in.
                  </p>
                )}
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="explain-dataset-select">Dataset</label>
              <Select
                id="explain-dataset-select"
                containerClassName="w-full"
                triggerClassName={styles.select}
                value={fileName}
                onChange={(e) => {
                  setFileName(e.target.value);
                  setTargetColumn('');
                }}
                placeholder={datasetsQuery.isLoading ? 'Loading datasets...' : 'Select a dataset'}
                options={datasets.map((d) => ({
                  value: d.name,
                  label: `${d.name} (${d.rows?.toLocaleString()} rows, ${Array.isArray(d.columns) ? d.columns.length : '?'} cols)`,
                }))}
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="explain-target-select">Target Column</label>
              <Select
                id="explain-target-select"
                containerClassName="w-full"
                triggerClassName={styles.select}
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                disabled={!fileName}
                placeholder={!fileName ? 'Select dataset first' : 'Select target column'}
                options={columns.map((col) => ({ value: col, label: col }))}
              />
            </div>
            <div className={styles.buttonGroup}>
              <button
                className={styles.evalBtn}
                onClick={handleComprehensive}
                disabled={isLoading || !modelName || !fileName || !targetColumn}
              >
                {comprehensiveMutation.isPending ? (
                  <Loader2 size={16} className={styles.spin} />
                ) : (
                  <Sparkles size={16} />
                )}
                Full Explain
              </button>
              <button
                className={styles.evalBtnSecondary}
                onClick={handleEvaluate}
                disabled={isLoading || !modelName || !fileName || !targetColumn}
              >
                {evaluateMutation.isPending ? (
                  <Loader2 size={16} className={styles.spin} />
                ) : (
                  <Activity size={16} />
                )}
                Evaluate Only
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.errorBanner}>
              <AlertCircle size={16} />
              <span>{(error as Error).message || 'Request failed'}</span>
            </div>
          )}
        </div>

        {(result || evalResult) && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
            {result ? (
              <>
                <div className={styles.statsRow}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Task Type</span>
                    <span className={styles.statValue}>{result.task_type}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Features</span>
                    <span className={styles.statValue}>{result.data_summary.n_features}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Train Size</span>
                    <span className={styles.statValue}>{result.data_summary.train_size.toLocaleString()}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Test Size</span>
                    <span className={styles.statValue}>{result.data_summary.test_size.toLocaleString()}</span>
                  </div>
                </div>

                <div className={styles.tabsBar}>
                  {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <Icon size={15} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className={styles.tabContent}
                  >
                    {activeTab === 'global' && (
                      <GlobalExplanationView data={result.global_explanation} />
                    )}
                    {activeTab === 'importance' && (
                      <div className={styles.results}>
                        <FeatureImportanceChart data={result.feature_importance.features} />
                      </div>
                    )}
                    {activeTab === 'shap' && (
                      <div className={styles.results}>
                        <ShapWaterfall data={result.shap_values} />
                      </div>
                    )}
                    {activeTab === 'lime' && (
                      <div className={styles.results}>
                        {result.local_explanations.map((exp, i) => (
                          <LIMEExplanationView key={i} data={exp.lime_explanation} sampleIndex={i} />
                        ))}
                      </div>
                    )}
                    {activeTab === 'prediction' && (
                      <div className={styles.results}>
                        {result.prediction_explanations.map((exp, i) => (
                          <PredictionExplanationView key={i} data={exp} sampleIndex={i} />
                        ))}
                      </div>
                    )}
                    {activeTab === 'evaluation' && (
                      <div className={styles.results}>
                        {evalResult?.confusion_matrix && <ConfusionMatrix data={evalResult.confusion_matrix} />}
                        {evalResult?.roc_curve && evalResult?.pr_curve && (
                          <div className={styles.twoCol}>
                            <RocCurve data={evalResult.roc_curve} />
                            <PrecisionRecallCurve data={evalResult.pr_curve} />
                          </div>
                        )}
                        {evalResult?.prediction_preview && evalResult.prediction_preview.length > 0 && (
                          <PredictionPreviewTable data={evalResult.prediction_preview} />
                        )}
                        {!evalResult && (
                          <div className={styles.emptyTab}>
                            <Activity size={24} />
                            <p>Click "Evaluate Only" to load confusion matrix, ROC & PR curves</p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </>
            ) : evalResult && (
              <>
                <div className={styles.statsRow}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Task Type</span>
                    <span className={styles.statValue}>{evalResult.task_type}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Features</span>
                    <span className={styles.statValue}>{evalResult.feature_names.length}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Train Size</span>
                    <span className={styles.statValue}>{evalResult.train_size.toLocaleString()}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Test Size</span>
                    <span className={styles.statValue}>{evalResult.test_size.toLocaleString()}</span>
                  </div>
                  {evalResult.roc_curve?.auc != null && (
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>AUC</span>
                      <span className={`${styles.statValue} ${styles.aucHighlight}`}>{evalResult.roc_curve.auc.toFixed(4)}</span>
                    </div>
                  )}
                </div>
                <div className={styles.results}>
                  <div className={styles.twoCol}>
                    <FeatureImportanceChart data={evalResult.feature_importance} />
                    <ShapWaterfall data={evalResult.shap_values} />
                  </div>
                  {evalResult.confusion_matrix && <ConfusionMatrix data={evalResult.confusion_matrix} />}
                  <div className={styles.twoCol}>
                    <RocCurve data={evalResult.roc_curve!} />
                    <PrecisionRecallCurve data={evalResult.pr_curve!} />
                  </div>
                  {evalResult.prediction_preview && evalResult.prediction_preview.length > 0 && (
                    <PredictionPreviewTable data={evalResult.prediction_preview} />
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

        {!result && !evalResult && !isLoading && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Brain size={32} />
            </div>
            <h3 className={styles.emptyTitle}>Enter a model and dataset to begin</h3>
            <p className={styles.emptyDesc}>
              Provide a trained model file, dataset, and target column to generate explanations
            </p>
            <div className={styles.emptyCards}>
              <div className={styles.emptyCard}>
                <Globe size={18} />
                <div>
                  <strong>Global Overview</strong>
                  <p>Feature statistics, interactions, prediction distribution</p>
                </div>
              </div>
              <div className={styles.emptyCard}>
                <TrendingUp size={18} />
                <div>
                  <strong>SHAP & LIME</strong>
                  <p>Per-feature contribution to predictions</p>
                </div>
              </div>
              <div className={styles.emptyCard}>
                <MessageSquare size={18} />
                <div>
                  <strong>Prediction Explanation</strong>
                  <p>Why the model made a specific prediction</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
