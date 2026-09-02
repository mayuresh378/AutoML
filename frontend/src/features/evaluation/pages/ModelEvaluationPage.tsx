import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, Loader2, BarChart3, Target, TrendingUp,
  GitBranch, Sliders, Lightbulb, Activity, PieChart, ChevronDown,
  Rocket, FileCheck, ArrowUpDown, Table2, Brain,
} from 'lucide-react';
import {
  evaluationService,
  type ComprehensiveEvaluation,
  type ModelComparisonResult,
  type EvaluationMetrics,
} from '../services/evaluation.service';
import { http } from '../../../services/http';
import type { Model, Dataset } from '../../../types/api';
import { ConfusionMatrix } from '../../explain/components/ConfusionMatrix';
import { RocCurve } from '../../explain/components/RocCurve';
import { PrecisionRecallCurve } from '../../explain/components/PrecisionRecallCurve';
import { FeatureImportanceChart } from '../../explain/components/FeatureImportanceChart';
import { LearningCurve } from '../components/LearningCurve';
import { ValidationCurve } from '../components/ValidationCurve';
import { ResidualPlot } from '../components/ResidualPlot';
import { PredictionDistribution } from '../components/PredictionDistribution';
import styles from './ModelEvaluationPage.module.css';

type TabId = 'confusion' | 'roc' | 'pr' | 'learning' | 'validation' | 'importance' | 'residual' | 'distribution';

const CHART_TABS: { id: TabId; label: string; icon: typeof Target }[] = [
  { id: 'confusion', label: 'Confusion Matrix', icon: Target },
  { id: 'roc', label: 'ROC Curve', icon: TrendingUp },
  { id: 'pr', label: 'PR Curve', icon: GitBranch },
  { id: 'learning', label: 'Learning Curve', icon: BarChart3 },
  { id: 'validation', label: 'Validation Curve', icon: Sliders },
  { id: 'importance', label: 'Feature Importance', icon: Lightbulb },
  { id: 'residual', label: 'Residual Plot', icon: Activity },
  { id: 'distribution', label: 'Prediction Dist.', icon: PieChart },
];

type PageView = 'evaluate' | 'compare';

function fmtMetric(val: number | null | undefined, isPercent = true): string {
  if (val === null || val === undefined) return '—';
  if (isPercent) return `${(val * 100).toFixed(1)}%`;
  return val.toFixed(4);
}

function metricColor(val: number | null | undefined, threshold = 0.85): string {
  if (val === null || val === undefined) return '';
  if (val >= threshold) return styles.metricValueGood;
  if (val >= threshold - 0.15) return '';
  return styles.metricValueWarn;
}

function renderInsights(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <h4 key={i} style={{ margin: '12px 0 4px', fontSize: 'var(--text-body-lg)' }}>{line.replace(/\*\*/g, '')}</h4>;
    }
    if (!line.trim()) return <br key={i} />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={i} style={{ margin: '4px 0' }}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.replace(/\*\*/g, '')}</strong>
            : part
        )}
      </p>
    );
  });
}

export default function ModelEvaluationPage() {
  const [view, setView] = useState<PageView>('evaluate');
  const [modelName, setModelName] = useState('');
  const [fileName, setFileName] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [result, setResult] = useState<ComprehensiveEvaluation | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('confusion');
  const [compareSelected, setCompareSelected] = useState<Set<string>>(new Set());
  const [compareResults, setCompareResults] = useState<ModelComparisonResult[]>([]);
  const [compareSortKey, setCompareSortKey] = useState<string>('');
  const [compareSortAsc, setCompareSortAsc] = useState(false);

  const modelsQuery = useQuery({
    queryKey: ['models'],
    queryFn: () => http.get<{ models: Model[] }>('/models'),
    select: (data) => data.models ?? [],
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
    if (selectedDataset?.name) {
      const name = selectedDataset.name.toLowerCase();
      if (name.includes('iris')) return ['sepal_length', 'sepal_width', 'petal_length', 'petal_width', 'species'];
    }
    return [];
  }, [selectedDataset]);

  const models = modelsQuery.data ?? [];
  const datasets = datasetsQuery.data ?? [];

  const evaluateMutation = useMutation({
    mutationFn: () => evaluationService.comprehensive(modelName, fileName, targetColumn),
    onSuccess: (data) => { setResult(data); setView('evaluate'); },
  });

  const compareMutation = useMutation({
    mutationFn: () => {
      const names = Array.from(compareSelected);
      return evaluationService.compare(names, fileName, targetColumn);
    },
    onSuccess: (data) => { setCompareResults(data.results || []); },
  });

  const handleEvaluate = () => {
    if (!modelName.trim() || !fileName.trim() || !targetColumn.trim()) return;
    evaluateMutation.mutate();
  };

  const handleCompare = () => {
    if (compareSelected.size < 2 || !fileName.trim() || !targetColumn.trim()) return;
    compareMutation.mutate();
  };

  function toggleCompareSelect(name: string) {
    setCompareSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const sortedCompare = useMemo(() => {
    if (!compareResults.length) return compareResults;
    if (!compareSortKey) return compareResults;
    return [...compareResults].sort((a, b) => {
      const aVal = compareSortKey === 'model_name'
        ? a.model_name
        : compareSortKey === 'training_time'
          ? (a.training_time ?? Infinity)
          : (a.metrics as any)?.[compareSortKey] ?? (compareSortKey === 'r2' ? (a.metrics as any)?.r2 : -Infinity);
      const bVal = compareSortKey === 'model_name'
        ? b.model_name
        : compareSortKey === 'training_time'
          ? (b.training_time ?? Infinity)
          : (b.metrics as any)?.[compareSortKey] ?? (compareSortKey === 'r2' ? (b.metrics as any)?.r2 : -Infinity);
      if (typeof aVal === 'string') return compareSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return compareSortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [compareResults, compareSortKey, compareSortAsc]);

  function findBestVal(results: ModelComparisonResult[], key: string): any {
    const valid = results.filter((r) => r.metrics && !r.error);
    if (!valid.length) return null;
    const isLowerBetter = ['log_loss', 'mae', 'mse', 'rmse', 'mape', 'training_time'].includes(key);
    let best = valid[0];
    for (const r of valid) {
      const bv = key === 'training_time' ? (best.training_time ?? Infinity) : (best.metrics as any)?.[key] ?? (isLowerBetter ? Infinity : -Infinity);
      const rv = key === 'training_time' ? (r.training_time ?? Infinity) : (r.metrics as any)?.[key] ?? (isLowerBetter ? Infinity : -Infinity);
      if (isLowerBetter ? rv < bv : rv > bv) best = r;
    }
    return key === 'training_time' ? best.training_time : (best.metrics as any)?.[key];
  }

  function handleSortCompare(key: string) {
    if (compareSortKey === key) setCompareSortAsc(!compareSortAsc);
    else { setCompareSortKey(key); setCompareSortAsc(false); }
  }

  const metrics = result?.metrics;

  const comparisonMetricKeys = ['accuracy', 'precision', 'recall', 'f1', 'roc_auc', 'mcc', 'cohen_kappa', 'log_loss', 'mae', 'mse', 'rmse', 'r2', 'mape', 'training_time'];
  const comparisonMetricLabels: Record<string, string> = {
    accuracy: 'Accuracy', precision: 'Precision', recall: 'Recall', f1: 'F1 Score',
    roc_auc: 'ROC AUC', mcc: 'MCC', cohen_kappa: "Cohen's Kappa", log_loss: 'Log Loss',
    mae: 'MAE', mse: 'MSE', rmse: 'RMSE', r2: 'R²', mape: 'MAPE', training_time: 'Training Time',
  };

  return (
    <div className={styles.page}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <div className={styles.header}>
          <h1 className={styles.title}>Model Evaluation</h1>
          <p className={styles.subtitle}>Comprehensive evaluation with metrics, charts, predictions, and model comparison</p>
        </div>

        <div className={styles.inputCard}>
          <div className={styles.inputRow}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Model</label>
              <div className={styles.selectWrapper}>
                <select className={styles.select} value={modelName} onChange={(e) => setModelName(e.target.value)}>
                  <option value="">{modelsQuery.isLoading ? 'Loading...' : 'Select model'}</option>
                  {models.map((m) => (
                    <option key={m.name} value={m.name}>{m.name} ({m.task_type || 'unknown'})</option>
                  ))}
                </select>
                <ChevronDown size={16} className={styles.selectIcon} />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Dataset</label>
              <div className={styles.selectWrapper}>
                <select className={styles.select} value={fileName} onChange={(e) => { setFileName(e.target.value); setTargetColumn(''); }}>
                  <option value="">{datasetsQuery.isLoading ? 'Loading...' : 'Select dataset'}</option>
                  {datasets.map((d) => (
                    <option key={d.name} value={d.name}>{d.name} ({d.rows?.toLocaleString()} rows)</option>
                  ))}
                </select>
                <ChevronDown size={16} className={styles.selectIcon} />
              </div>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Target Column</label>
              <div className={styles.selectWrapper}>
                <select className={styles.select} value={targetColumn} onChange={(e) => setTargetColumn(e.target.value)} disabled={!fileName}>
                  <option value="">{!fileName ? 'Select dataset first' : 'Select target'}</option>
                  {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                </select>
                <ChevronDown size={16} className={styles.selectIcon} />
              </div>
            </div>
            <button className={styles.evalBtn} onClick={handleEvaluate} disabled={evaluateMutation.isPending || !modelName || !fileName || !targetColumn}>
              {evaluateMutation.isPending ? <Loader2 size={16} className={styles.spin} /> : <BarChart3 size={16} />}
              Evaluate
            </button>
            <button
              className={styles.evalBtn}
              style={{ background: 'var(--color-secondary)' }}
              onClick={handleCompare}
              disabled={compareMutation.isPending || compareSelected.size < 2 || !fileName || !targetColumn}
            >
              {compareMutation.isPending ? <Loader2 size={16} className={styles.spin} /> : <Table2 size={16} />}
              Compare ({compareSelected.size})
            </button>
          </div>
          {evaluateMutation.isError && (
            <div className={styles.errorBanner}>
              <AlertCircle size={16} />
              <span>{(evaluateMutation.error as Error)?.message || 'Evaluation failed'}</span>
            </div>
          )}
          {compareMutation.isError && (
            <div className={styles.errorBanner}>
              <AlertCircle size={16} />
              <span>{(compareMutation.error as Error)?.message || 'Comparison failed'}</span>
            </div>
          )}
          {models.length > 0 && (
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)', alignSelf: 'center' }}>Compare:</span>
              {models.map((m) => (
                <button
                  key={m.name}
                  onClick={() => toggleCompareSelect(m.name)}
                  style={{
                    padding: '2px 8px', borderRadius: 'var(--radius-md)', border: '1px solid',
                    borderColor: compareSelected.has(m.name) ? 'var(--color-secondary)' : 'var(--color-border)',
                    background: compareSelected.has(m.name) ? 'rgba(79,70,229,0.08)' : 'var(--color-surface)',
                    color: compareSelected.has(m.name) ? 'var(--color-secondary)' : 'var(--color-text-secondary)',
                    fontSize: 'var(--text-caption)', cursor: 'pointer', fontFamily: 'var(--font-mono)',
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {result && view === 'evaluate' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
            {result.warnings && result.warnings.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                {result.warnings.map((w, i) => (
                  <div key={i} className={styles.errorBanner} style={{ background: 'rgba(234, 179, 8, 0.08)', color: '#a16207', marginBottom: i < result.warnings!.length - 1 ? 'var(--space-2)' : 0 }}>
                    <AlertCircle size={16} />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.metricsRow}>
              {metrics?.accuracy !== undefined && (
                <div className={`${styles.metricCard} ${metricColor(metrics.accuracy) ? styles.metricCardHighlight : ''}`}>
                  <span className={styles.metricLabel}>Accuracy</span>
                  <span className={`${styles.metricValue} ${metricColor(metrics.accuracy)}`}>{fmtMetric(metrics.accuracy)}</span>
                </div>
              )}
              {metrics?.precision !== undefined && (
                <div className={`${styles.metricCard} ${metricColor(metrics.precision) ? styles.metricCardHighlight : ''}`}>
                  <span className={styles.metricLabel}>Precision</span>
                  <span className={`${styles.metricValue} ${metricColor(metrics.precision)}`}>{fmtMetric(metrics.precision)}</span>
                </div>
              )}
              {metrics?.recall !== undefined && (
                <div className={`${styles.metricCard} ${metricColor(metrics.recall) ? styles.metricCardHighlight : ''}`}>
                  <span className={styles.metricLabel}>Recall</span>
                  <span className={`${styles.metricValue} ${metricColor(metrics.recall)}`}>{fmtMetric(metrics.recall)}</span>
                </div>
              )}
              {metrics?.f1 !== undefined && (
                <div className={`${styles.metricCard} ${metricColor(metrics.f1) ? styles.metricCardHighlight : ''}`}>
                  <span className={styles.metricLabel}>F1 Score</span>
                  <span className={`${styles.metricValue} ${metricColor(metrics.f1)}`}>{fmtMetric(metrics.f1)}</span>
                </div>
              )}
              {metrics?.roc_auc !== undefined && (
                <div className={`${styles.metricCard} ${metricColor(metrics.roc_auc) ? styles.metricCardHighlight : ''}`}>
                  <span className={styles.metricLabel}>ROC AUC</span>
                  <span className={`${styles.metricValue} ${metricColor(metrics.roc_auc)}`}>{fmtMetric(metrics.roc_auc, false)}</span>
                </div>
              )}
              {metrics?.mcc !== undefined && (
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>MCC</span>
                  <span className={styles.metricValue}>{fmtMetric(metrics.mcc, false)}</span>
                </div>
              )}
              {metrics?.cohen_kappa !== undefined && (
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Cohen's Kappa</span>
                  <span className={styles.metricValue}>{fmtMetric(metrics.cohen_kappa, false)}</span>
                </div>
              )}
              {metrics?.log_loss !== undefined && (
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Log Loss</span>
                  <span className={styles.metricValue}>{fmtMetric(metrics.log_loss, false)}</span>
                </div>
              )}
              {metrics?.r2 !== undefined && (
                <div className={`${styles.metricCard} ${metricColor(metrics.r2, 0.75) ? styles.metricCardHighlight : ''}`}>
                  <span className={styles.metricLabel}>R²</span>
                  <span className={`${styles.metricValue} ${metricColor(metrics.r2, 0.75)}`}>{fmtMetric(metrics.r2, false)}</span>
                </div>
              )}
              {metrics?.rmse !== undefined && (
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>RMSE</span>
                  <span className={styles.metricValue}>{fmtMetric(metrics.rmse, false)}</span>
                </div>
              )}
              {metrics?.mae !== undefined && (
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>MAE</span>
                  <span className={styles.metricValue}>{fmtMetric(metrics.mae, false)}</span>
                </div>
              )}
              {metrics?.mape !== undefined && (
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>MAPE</span>
                  <span className={styles.metricValue}>{fmtMetric(metrics.mape, false)}</span>
                </div>
              )}
              {result.train_size > 0 && (
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Train / Test</span>
                  <span className={styles.metricValue} style={{ fontSize: 'var(--text-body)' }}>{result.train_size.toLocaleString()} / {result.test_size.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className={styles.tabsBar}>
              {CHART_TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`} onClick={() => setActiveTab(tab.id)}>
                    <Icon size={15} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }} className={styles.tabContent}>
                {activeTab === 'confusion' && (result.confusion_matrix ? <ConfusionMatrix data={result.confusion_matrix} /> : <div className={styles.emptyTab}>Confusion matrix not available for regression</div>)}
                {activeTab === 'roc' && (result.roc_curve ? <RocCurve data={result.roc_curve} /> : <div className={styles.emptyTab}>ROC curve not available</div>)}
                {activeTab === 'pr' && (result.pr_curve ? <PrecisionRecallCurve data={result.pr_curve} /> : <div className={styles.emptyTab}>PR curve not available</div>)}
                {activeTab === 'learning' && <LearningCurve data={result.learning_curve} />}
                {activeTab === 'validation' && <ValidationCurve data={result.validation_curve} />}
                {activeTab === 'importance' && (result.feature_importance.length > 0 ? <FeatureImportanceChart data={result.feature_importance} /> : <div className={styles.emptyTab}>Feature importance not available</div>)}
                {activeTab === 'residual' && (result.residual_plot ? <ResidualPlot data={result.residual_plot} /> : <div className={styles.emptyTab}>Residual plot only for regression</div>)}
                {activeTab === 'distribution' && <PredictionDistribution data={result.prediction_distribution} />}
              </motion.div>
            </AnimatePresence>

            {result.prediction_samples && result.prediction_samples.length > 0 && (
              <div className={styles.section} style={{ marginTop: 'var(--space-6)' }}>
                <h3 className={styles.sectionTitle}><Table2 size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Prediction Samples</h3>
                <div className={styles.samplesCard}>
                  <div className={styles.samplesScroll}>
                    <table className={styles.samplesTable}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Actual</th>
                          <th>Predicted</th>
                          {result.task_type === 'classification' ? <th>Correct</th> : <th>Residual</th>}
                          {result.task_type === 'classification' && <th>Probabilities</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {result.prediction_samples.map((s, i) => (
                          <tr key={i}>
                            <td style={{ color: 'var(--color-text-tertiary)' }}>{i + 1}</td>
                            <td style={{ fontWeight: 600 }}>{String(s.actual)}</td>
                            <td style={{ fontWeight: 600 }}>{String(s.predicted)}</td>
                            {result.task_type === 'classification' ? (
                              <td>
                                {s.correct !== undefined ? (
                                  s.correct ? <span className={styles.correctBadge}>Correct</span> : <span className={styles.incorrectBadge}>Wrong</span>
                                ) : '—'}
                              </td>
                            ) : (
                              <td>{s.residual !== undefined ? s.residual.toFixed(4) : '—'}</td>
                            )}
                            {result.task_type === 'classification' && (
                              <td style={{ fontSize: 'var(--text-tiny)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {s.probability ? Object.entries(s.probability).map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`).join(', ') : '—'}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {result.ai_insights && (
              <div className={styles.section} style={{ marginTop: 'var(--space-6)' }}>
                <h3 className={styles.sectionTitle}><Brain size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />AI Insights</h3>
                <div className={styles.insightsCard}>
                  <div className={styles.insightsContent}>{renderInsights(result.ai_insights)}</div>
                  <div className={styles.actionsRow}>
                    <button className={styles.registerBtn}>
                      <FileCheck size={16} />
                      Register Model
                    </button>
                    <button className={styles.deployBtn}>
                      <Rocket size={16} />
                      Deploy
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {compareResults.length > 0 && view === 'evaluate' && (
          <div className={styles.section} style={{ marginTop: 'var(--space-6)' }}>
            <h3 className={styles.sectionTitle}><Table2 size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Model Comparison</h3>
            <div className={styles.comparisonCard}>
              <div className={styles.comparisonScroll}>
                <table className={styles.comparisonTable}>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      {sortedCompare.map((r) => (
                        <th key={r.model_name} className={styles.metricLabelCell} style={{ cursor: 'default' }}>
                          {r.model_name}
                          {r.error && <span style={{ color: 'var(--color-danger)', fontSize: 'var(--text-tiny)', marginLeft: 4 }}>(error)</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonMetricKeys.map((key) => {
                      const bestVal = findBestVal(sortedCompare, key);
                      return (
                        <tr key={key}>
                          <td className={`${styles.metricLabelCell} ${compareSortKey === key ? styles.sorted : ''}`} onClick={() => handleSortCompare(key)}>
                            <ArrowUpDown size={12} style={{ marginRight: 4, opacity: 0.5 }} />
                            {comparisonMetricLabels[key]}
                          </td>
                          {sortedCompare.map((r) => {
                            if (r.error) return <td key={r.model_name} className={styles.errorCell}>Error</td>;
                            let val: any;
                            if (key === 'training_time') val = r.training_time;
                            else val = (r.metrics as any)?.[key];
                            if (val === null || val === undefined) return <td key={r.model_name}>—</td>;
                            const isBest = bestVal !== null && val === bestVal && sortedCompare.length > 1;
                            const formatted = key === 'training_time'
                              ? (typeof val === 'number' ? `${val.toFixed(1)}s` : val)
                              : (['accuracy', 'precision', 'recall', 'f1', 'roc_auc'].includes(key) ? `${(val * 100).toFixed(1)}%` : typeof val === 'number' ? val.toFixed(4) : val);
                            return (
                              <td key={r.model_name} className={isBest ? styles.bestValue : ''}>
                                {formatted}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!result && !compareResults.length && !evaluateMutation.isPending && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><BarChart3 size={32} /></div>
            <h3 className={styles.emptyTitle}>Select a model and dataset to evaluate</h3>
            <p className={styles.emptyDesc}>Choose from your trained models and uploaded datasets to generate comprehensive evaluation with metrics, charts, predictions, and model comparison</p>
            <div className={styles.vizGrid}>
              <div className={styles.vizCard}><Target size={16} /><span>Confusion Matrix</span></div>
              <div className={styles.vizCard}><TrendingUp size={16} /><span>ROC Curve</span></div>
              <div className={styles.vizCard}><GitBranch size={16} /><span>PR Curve</span></div>
              <div className={styles.vizCard}><BarChart3 size={16} /><span>Learning Curve</span></div>
              <div className={styles.vizCard}><Sliders size={16} /><span>Validation Curve</span></div>
              <div className={styles.vizCard}><Lightbulb size={16} /><span>Feature Importance</span></div>
              <div className={styles.vizCard}><Table2 size={16} /><span>Prediction Samples</span></div>
              <div className={styles.vizCard}><Brain size={16} /><span>AI Insights</span></div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
