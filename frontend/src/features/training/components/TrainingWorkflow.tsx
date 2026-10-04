import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Target, Brain, Sliders, Activity, BarChart3, Play, Package,
  ChevronRight, Check, Loader2, AlertCircle,
} from 'lucide-react';
import { trainingService, TrainingProgress, pickBestResult } from '../../../services/training.service';
import { LiveTrainingProgress } from './LiveTrainingProgress';
import { AccuracyChart } from './AccuracyChart';
import styles from './TrainingWorkflow.module.css';

interface TrainingWorkflowProps {
  datasets: { name: string; columns?: string[]; id?: string }[];
}

type Step = 'task' | 'algorithms' | 'hyperparams' | 'training' | 'metrics';

const STEPS: { id: Step; label: string; icon: any }[] = [
  { id: 'task', label: 'Task', icon: Target },
  { id: 'algorithms', label: 'Algorithms', icon: Brain },
  { id: 'hyperparams', label: 'Hyperparameters', icon: Sliders },
  { id: 'training', label: 'Training', icon: Activity },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
];

const CLASSIFICATION_ALGOS = [
  { name: 'RandomForest', label: 'Random Forest', desc: 'Ensemble of decision trees' },
  { name: 'GradientBoosting', label: 'Gradient Boosting', desc: 'Sequential ensemble method' },
  { name: 'XGBoost', label: 'XGBoost', desc: 'Extreme gradient boosting' },
  { name: 'LightGBM', label: 'LightGBM', desc: 'Fast gradient boosting' },
  { name: 'CatBoost', label: 'CatBoost', desc: 'Categorical boosting' },
  { name: 'SVC', label: 'SVM', desc: 'Support vector classification' },
  { name: 'KNN', label: 'KNN', desc: 'K-nearest neighbors' },
  { name: 'LogisticRegression', label: 'Logistic Regression', desc: 'Linear classifier' },
  { name: 'DecisionTree', label: 'Decision Tree', desc: 'Single tree classifier' },
  { name: 'NaiveBayes', label: 'Naive Bayes', desc: 'Probabilistic classifier' },
];

const REGRESSION_ALGOS = [
  { name: 'RandomForest', label: 'Random Forest', desc: 'Ensemble of decision trees' },
  { name: 'GradientBoosting', label: 'Gradient Boosting', desc: 'Sequential ensemble method' },
  { name: 'XGBoost', label: 'XGBoost', desc: 'Extreme gradient boosting' },
  { name: 'LightGBM', label: 'LightGBM', desc: 'Fast gradient boosting' },
  { name: 'CatBoost', label: 'CatBoost', desc: 'Categorical boosting' },
  { name: 'SVR', label: 'SVR', desc: 'Support vector regression' },
  { name: 'KNN', label: 'KNN', desc: 'K-nearest neighbors' },
  { name: 'Ridge', label: 'Ridge', desc: 'L2 regularized linear' },
  { name: 'Lasso', label: 'Lasso', desc: 'L1 regularized linear' },
  { name: 'DecisionTree', label: 'Decision Tree', desc: 'Single tree regressor' },
];

/** Formats a 0-1 score, or a dash when the value was never measured. */
function formatPct(value: number | null | undefined): string {
  return value == null ? '—' : `${(value * 100).toFixed(1)}%`;
}

/** Formats a raw metric (R², RMSE, MAE, MSE) that is not a 0-1 percentage. */
function formatPlain(value: number | null | undefined): string {
  return value == null ? '—' : value.toFixed(4);
}

/** Reads the task's headline metric out of a result's metric bag. */
function formatScore(
  metrics: Record<string, number> | null | undefined,
  key: 'accuracy' | 'r2',
): string {
  if (!metrics) return '—';
  return key === 'r2' ? formatPlain(metrics.r2) : formatPct(metrics.accuracy);
}

export function TrainingWorkflow({ datasets }: TrainingWorkflowProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('task');
  const [taskType, setTaskType] = useState<'classification' | 'regression'>('classification');
  const [selectedDataset, setSelectedDataset] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [selectedAlgos, setSelectedAlgos] = useState<string[]>([]);
  const [cvFolds, setCvFolds] = useState(5);
  const [optimizeHpo, setOptimizeHpo] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const selectedDs = useMemo(() => datasets.find((d) => d.name === selectedDataset), [datasets, selectedDataset]);
  const dsColumns = useMemo(() => (selectedDs as any)?.columns || [], [selectedDs]);

  const results = useMemo(() => progress?.all_results ?? [], [progress]);
  const isRegression = progress?.task_type === 'regression';
  const rankMetric = progress?.rank_metric ?? (taskType === 'regression' ? 'r2' : 'accuracy');
  const rankLabel = rankMetric === 'r2' ? 'R²' : 'Accuracy';

  /** Columns are driven by the metrics the backend actually produced. The
   *  headline column already shows R² for regression, so no extra R² column. */
  const showF1 = useMemo(() => results.some((r) => r.metrics?.f1 != null), [results]);
  const showRmse = useMemo(() => results.some((r) => r.metrics?.rmse != null), [results]);
  const showMae = useMemo(() => results.some((r) => r.metrics?.mae != null), [results]);

  /**
   * The winner is derived from measured values only, and stays null while no
   * algorithm has a score, so "Best" can never sit on an empty row.
   */
  const bestName = useMemo(() => {
    const best = pickBestResult(results, rankMetric);
    return best ? best.name : null;
  }, [results, rankMetric]);

  /** Successful models first (best score on top), then failures. Copy before
   *  sorting: sorting in place mutated the array held in React state. */
  const sortedResults = useMemo(() => {
    const score = (r: typeof results[number]) =>
      r.status === 'success' && r.metrics ? (r.metrics[rankMetric] as number) : -Infinity;
    return [...results].sort((a, b) => {
      if (score(a) !== score(b)) return score(b) - score(a);
      return 0;
    });
  }, [results, rankMetric]);

  const metricsError = useMemo(() => {
    if (requestError) return requestError;
    if (progress?.status === 'failed') {
      return progress.error || progress.message || 'Training failed for an unknown reason';
    }
    if (progress?.status === 'cancelled') return 'Training was cancelled';
    if (progress?.status === 'timeout') return 'Training timed out before results were received';
    if (progress?.status === 'completed' && results.every((r) => r.status === 'error')) {
      return 'No algorithm produced valid metrics. Check the training logs for the underlying errors.';
    }
    return null;
  }, [requestError, progress, results]);

  const metricsErrorTitle = useMemo(() => {
    if (progress?.status === 'cancelled') return 'Training cancelled';
    if (progress?.status === 'timeout') return 'Training timed out';
    if (requestError || progress?.status === 'failed') return 'Training failed';
    return 'No valid metrics';
  }, [requestError, progress]);

  const currentStepIdx = STEPS.findIndex((s) => s.id === step);

  useEffect(() => {
    if (step === 'algorithms') {
      const algos = taskType === 'classification' ? CLASSIFICATION_ALGOS : REGRESSION_ALGOS;
      setSelectedAlgos(algos.map((a) => a.name));
    }
  }, [step, taskType]);

  useEffect(() => {
    if (!jobId || !progress) return;
    // Move on once the run has finished, whatever the outcome. The Metrics step
    // renders either the table or the real error, so a run that produced no
    // numbers always lands somewhere that explains why.
    if (['completed', 'failed', 'cancelled', 'timeout'].includes(progress.status)) {
      setStep('metrics');
    }
  }, [progress, jobId]);

  // Close the stream if the component goes away, otherwise it keeps calling
  // setProgress on an unmounted tree.
  useEffect(() => () => unsubscribeRef.current?.(), []);

  const handleStartTraining = useCallback(async () => {
    if (!selectedDataset || !targetColumn.trim()) return;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    // Clear the previous run so the Metrics step can never show stale numbers
    // from an earlier job while the new one starts.
    setProgress(null);
    setRequestError(null);
    setJobId(null);
    setStep('training');
    try {
      const payload = {
        file_name: selectedDataset,
        target_column: targetColumn.trim(),
        task_type: taskType,
        algorithms: selectedAlgos.join(','),
        cv_folds: cvFolds,
        optimize_hyperparameters: optimizeHpo,
      };
      console.log('TRAINING API REQUEST:', payload);
      const result = await trainingService.runWorkflow(payload);
      console.log('TRAINING API RESPONSE:', result);
      setJobId(result.job_id);
      unsubscribeRef.current = trainingService.subscribeProgress(result.job_id, (data) => {
        setProgress(data);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRequestError(message);
      setProgress({
        status: 'failed', progress: 0, current_step: 'failed',
        message, error: message, logs: [], metrics_history: [],
        task_type: taskType,
      });
    }
  }, [selectedDataset, targetColumn, taskType, selectedAlgos, cvFolds, optimizeHpo]);

  const handleCancel = useCallback(() => {
    if (jobId) trainingService.cancel(jobId);
  }, [jobId]);

  const toggleAlgo = useCallback((name: string) => {
    setSelectedAlgos((prev) => prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]);
  }, []);

  return (
    <div className={styles.workflow}>
      {/* Step Indicator */}
      <div className={styles.stepper}>
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = s.id === step;
          const isDone = i < currentStepIdx;
          const isClickable = i <= currentStepIdx + 1 || isDone;
          return (
            <div key={s.id} className={styles.stepWrapper}>
              <button
                className={`${styles.stepBtn} ${isActive ? styles.stepActive : ''} ${isDone ? styles.stepDone : ''}`}
                onClick={() => isClickable && !isActive && setStep(s.id)}
                disabled={!isClickable}
              >
                <div className={`${styles.stepCircle} ${isActive ? styles.circleActive : isDone ? styles.circleDone : ''}`}>
                  {isDone ? <Check className={styles.stepCheck} /> : <Icon className={styles.stepIcon} />}
                </div>
                <span className={styles.stepLabel}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className={`${styles.stepLine} ${isDone ? styles.lineDone : ''}`} />}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className={styles.stepContent}>
        <AnimatePresence mode="wait">
          {step === 'task' && (
            <motion.div key="task" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className={styles.stepPanel}>
              <h3 className={styles.panelTitle}>Select Task Type</h3>
              <p className={styles.panelDesc}>Choose the type of machine learning problem you want to solve.</p>
              <div className={styles.taskGrid}>
                <button className={`${styles.taskCard} ${taskType === 'classification' ? styles.taskCardActive : ''}`} onClick={() => setTaskType('classification')}>
                  <div className={styles.taskIcon}>🎯</div>
                  <div className={styles.taskName}>Classification</div>
                  <div className={styles.taskDesc}>Predict categories or labels (e.g., spam/not spam, disease type)</div>
                </button>
                <button className={`${styles.taskCard} ${taskType === 'regression' ? styles.taskCardActive : ''}`} onClick={() => setTaskType('regression')}>
                  <div className={styles.taskIcon}>📈</div>
                  <div className={styles.taskName}>Regression</div>
                  <div className={styles.taskDesc}>Predict continuous values (e.g., price, temperature, revenue)</div>
                </button>
              </div>

              <h3 className={`${styles.panelTitle} ${styles.mt8}`}>Select Dataset & Target</h3>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Dataset</label>
                  <select className={styles.formSelect} value={selectedDataset} onChange={(e) => { setSelectedDataset(e.target.value); setTargetColumn(''); }}>
                    <option value="">Choose a dataset</option>
                    {datasets.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Target Column</label>
                  <select className={styles.formSelect} value={targetColumn} onChange={(e) => setTargetColumn(e.target.value)} disabled={!selectedDataset}>
                    <option value="">Choose target</option>
                    {dsColumns.map((c: string) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.stepActions}>
                <button className={styles.btnNext} disabled={!selectedDataset || !targetColumn} onClick={() => setStep('algorithms')}>
                  Continue <ChevronRight className={styles.btnIcon} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'algorithms' && (
            <motion.div key="algorithms" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className={styles.stepPanel}>
              <h3 className={styles.panelTitle}>Select Algorithms</h3>
              <p className={styles.panelDesc}>Choose which algorithms to train. Selected algorithms will be compared.</p>
              <div className={styles.algoGrid}>
                {(taskType === 'classification' ? CLASSIFICATION_ALGOS : REGRESSION_ALGOS).map((algo) => (
                  <button key={algo.name} className={`${styles.algoCard} ${selectedAlgos.includes(algo.name) ? styles.algoCardActive : ''}`} onClick={() => toggleAlgo(algo.name)}>
                    <div className={styles.algoCheck}>
                      {selectedAlgos.includes(algo.name) ? <Check className={styles.algoCheckIcon} /> : <div className={styles.algoUncheck} />}
                    </div>
                    <div className={styles.algoInfo}>
                      <div className={styles.algoName}>{algo.label}</div>
                      <div className={styles.algoDesc}>{algo.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className={styles.stepActions}>
                <button className={styles.btnBack} onClick={() => setStep('task')}>Back</button>
                <button className={styles.btnNext} disabled={selectedAlgos.length === 0} onClick={() => setStep('hyperparams')}>
                  Continue <ChevronRight className={styles.btnIcon} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'hyperparams' && (
            <motion.div key="hyperparams" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className={styles.stepPanel}>
              <h3 className={styles.panelTitle}>Hyperparameter Optimization</h3>
              <p className={styles.panelDesc}>Configure the optimization settings for model training.</p>

              <div className={styles.hpoForm}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>CV Folds</label>
                  <select className={styles.formSelect} value={cvFolds} onChange={(e) => setCvFolds(Number(e.target.value))}>
                    {[2, 3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}-Fold Cross Validation</option>)}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Optimization Strategy</label>
                  <div className={styles.hpoOptions}>
                    <button className={`${styles.hpoOption} ${optimizeHpo ? styles.hpoOptionActive : ''}`} onClick={() => setOptimizeHpo(true)}>
                      <div className={styles.hpoOptionTitle}>Auto-Tune (Recommended)</div>
                      <div className={styles.hpoOptionDesc}>RandomizedSearchCV with 5 iterations per model. Finds best hyperparameters automatically.</div>
                    </button>
                    <button className={`${styles.hpoOption} ${!optimizeHpo ? styles.hpoOptionActive : ''}`} onClick={() => setOptimizeHpo(false)}>
                      <div className={styles.hpoOptionTitle}>Default Params</div>
                      <div className={styles.hpoOptionDesc}>Train with default hyperparameters. Faster but may not find optimal settings.</div>
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.stepActions}>
                <button className={styles.btnBack} onClick={() => setStep('algorithms')}>Back</button>
                <button className={styles.btnPrimary} onClick={handleStartTraining}>
                  <Play className={styles.btnIcon} /> Start Training ({selectedAlgos.length} models)
                </button>
              </div>
            </motion.div>
          )}

          {step === 'training' && (
            <motion.div key="training" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className={styles.stepPanel}>
              <h3 className={styles.panelTitle}>Training in Progress</h3>
              {progress ? (
                <LiveTrainingProgress progress={progress} onCancel={handleCancel} />
              ) : (
                <div className={styles.loadingState}>
                  <Loader2 className={styles.loadingSpin} />
                  <span>Initializing training...</span>
                </div>
              )}
            </motion.div>
          )}

          {step === 'metrics' && (
            <motion.div key="metrics" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className={styles.stepPanel}>
              <h3 className={styles.panelTitle}>Training Results</h3>
              {metricsError && (
                <div className={styles.errorBanner}>
                  <AlertCircle className={styles.errorIcon} />
                  <div>
                    <div className={styles.errorTitle}>{metricsErrorTitle}</div>
                    <div className={styles.errorText}>{metricsError}</div>
                  </div>
                </div>
              )}
              {!metricsError && results.length === 0 && (
                <div className={styles.loadingState}>
                  <Loader2 className={styles.loadingSpin} />
                  <span>Waiting for training results...</span>
                </div>
              )}
              {!metricsError && results.length > 0 && progress?.metrics_history && progress.metrics_history.length > 0 && (
                <AccuracyChart metricsHistory={progress.metrics_history} metricLabel={rankLabel} />
              )}

              {results.length > 0 && (
                <div className={styles.resultsTable}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Algorithm</th>
                        <th>{rankLabel}</th>
                        <th>CV Score</th>
                        {showF1 && <th>F1</th>}
                        {showRmse && <th>RMSE</th>}
                        {showMae && <th>MAE</th>}
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults.map((r) => {
                        const isBest = bestName != null && r.name === bestName;
                        if (r.status === 'error') {
                          return (
                            <tr key={r.name} className={styles.errorRow}>
                              <td className={styles.algoCell}>{r.name}</td>
                              <td colSpan={6} className={styles.errorCell}>
                                <AlertCircle className={styles.errorIcon} /> {r.error || 'Training failed for this algorithm'}
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={r.name} className={isBest ? styles.bestRow : ''}>
                            <td className={styles.algoCell}>
                              {r.name}
                              {isBest && <span className={styles.bestBadge}>Best</span>}
                            </td>
                            <td>{formatScore(r.metrics, rankMetric)}</td>
                            <td>{formatPct(r.cv_score)}</td>
                            {showF1 && <td>{formatPct(r.metrics?.f1)}</td>}
                            {showRmse && <td>{formatPlain(r.metrics?.rmse)}</td>}
                            {showMae && <td>{formatPlain(r.metrics?.mae)}</td>}
                            <td>{r.training_time != null ? `${r.training_time.toFixed(2)}s` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className={styles.stepActions}>
                <button className={styles.btnBack} onClick={() => setStep('training')}>Back to Training</button>
                <button className={styles.btnPrimary} onClick={() => navigate('/app/models')}>
                  <Package className={styles.btnIcon} /> Open Model Registry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
