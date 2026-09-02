import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Brain, Sliders, Activity, BarChart3, Rocket,
  ChevronRight, Check, Loader2, AlertCircle,
} from 'lucide-react';
import { trainingService, TrainingProgress } from '../../../services/training.service';
import { LiveTrainingProgress } from './LiveTrainingProgress';
import { AccuracyChart } from './AccuracyChart';
import styles from './TrainingWorkflow.module.css';

interface TrainingWorkflowProps {
  datasets: { name: string; columns?: string[]; id?: string }[];
}

type Step = 'task' | 'algorithms' | 'hyperparams' | 'training' | 'metrics' | 'deploy';

const STEPS: { id: Step; label: string; icon: any }[] = [
  { id: 'task', label: 'Task', icon: Target },
  { id: 'algorithms', label: 'Algorithms', icon: Brain },
  { id: 'hyperparams', label: 'Hyperparameters', icon: Sliders },
  { id: 'training', label: 'Training', icon: Activity },
  { id: 'metrics', label: 'Metrics', icon: BarChart3 },
  { id: 'deploy', label: 'Deploy', icon: Rocket },
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

export function TrainingWorkflow({ datasets }: TrainingWorkflowProps) {
  const [step, setStep] = useState<Step>('task');
  const [taskType, setTaskType] = useState<'classification' | 'regression'>('classification');
  const [selectedDataset, setSelectedDataset] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [selectedAlgos, setSelectedAlgos] = useState<string[]>([]);
  const [cvFolds, setCvFolds] = useState(5);
  const [optimizeHpo, setOptimizeHpo] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [deployed, setDeployed] = useState(false);

  const selectedDs = useMemo(() => datasets.find((d) => d.name === selectedDataset), [datasets, selectedDataset]);
  const dsColumns = useMemo(() => (selectedDs as any)?.columns || [], [selectedDs]);

  const currentStepIdx = STEPS.findIndex((s) => s.id === step);

  useEffect(() => {
    if (step === 'algorithms') {
      const algos = taskType === 'classification' ? CLASSIFICATION_ALGOS : REGRESSION_ALGOS;
      setSelectedAlgos(algos.map((a) => a.name));
    }
  }, [step, taskType]);

  useEffect(() => {
    if (!jobId || !progress) return;
    if (progress.status === 'completed') {
      setStep('metrics');
    } else if (progress.status === 'failed') {
      // stay on training step to show error
    }
  }, [progress, jobId]);

  const handleStartTraining = useCallback(async () => {
    if (!selectedDataset || !targetColumn.trim()) return;
    setStep('training');
    try {
      const result = await trainingService.runWorkflow({
        file_name: selectedDataset,
        target_column: targetColumn.trim(),
        task_type: taskType,
        algorithms: selectedAlgos.join(','),
        cv_folds: cvFolds,
        optimize_hyperparameters: optimizeHpo,
      });
      setJobId(result.job_id);
      const unsub = trainingService.subscribeProgress(result.job_id, (data) => {
        setProgress(data);
      });
      return () => unsub();
    } catch (err) {
      setProgress({ status: 'failed', progress: 0, current_step: 'error', message: String(err), logs: [], metrics_history: [] });
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
                  <Rocket className={styles.btnIcon} /> Start Training ({selectedAlgos.length} models)
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
              {progress?.metrics_history && progress.metrics_history.length > 0 && (
                <AccuracyChart metricsHistory={progress.metrics_history} />
              )}

              {progress?.all_results && (
                <div className={styles.resultsTable}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Algorithm</th>
                        <th>Accuracy</th>
                        <th>CV Score</th>
                        {progress.all_results[0]?.metrics?.f1 != null && <th>F1</th>}
                        {progress.all_results[0]?.metrics?.rmse != null && <th>RMSE</th>}
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.all_results.sort((a, b) => (b.metrics?.accuracy || 0) - (a.metrics?.accuracy || 0)).map((r, i) => (
                        <tr key={r.name} className={i === 0 ? styles.bestRow : ''}>
                          <td className={styles.algoCell}>
                            {r.name}
                            {i === 0 && <span className={styles.bestBadge}>Best</span>}
                          </td>
                          <td>{r.metrics?.accuracy != null ? `${(r.metrics.accuracy * 100).toFixed(1)}%` : '—'}</td>
                          <td>{r.cv_score != null ? `${(r.cv_score * 100).toFixed(1)}%` : '—'}</td>
                          {progress.all_results?.[0]?.metrics?.f1 != null && <td>{r.metrics?.f1 != null ? `${(r.metrics.f1 * 100).toFixed(1)}%` : '—'}</td>}
                          {progress.all_results?.[0]?.metrics?.rmse != null && <td>{r.metrics?.rmse ?? '—'}</td>}
                          <td>{r.time}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className={styles.stepActions}>
                <button className={styles.btnBack} onClick={() => setStep('training')}>Back to Training</button>
                <button className={styles.btnPrimary} onClick={() => setStep('deploy')}>
                  <Rocket className={styles.btnIcon} /> Deploy Best Model
                </button>
              </div>
            </motion.div>
          )}

          {step === 'deploy' && (
            <motion.div key="deploy" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className={styles.stepPanel}>
              <h3 className={styles.panelTitle}>Deploy Model</h3>
              <p className={styles.panelDesc}>Deploy the best model to production.</p>

              {progress?.best_model && (
                <div className={styles.deployCard}>
                  <div className={styles.deployInfo}>
                    <div className={styles.deployLabel}>Model</div>
                    <div className={styles.deployValue}>{progress.best_model.name}</div>
                    <div className={styles.deployMetrics}>
                      Accuracy: {progress.best_model.metrics?.accuracy != null ? (progress.best_model.metrics.accuracy * 100).toFixed(1) + '%' : '—'} ·
                      CV: {progress.best_model.cv_score != null ? (progress.best_model.cv_score * 100).toFixed(1) + '%' : '—'}
                    </div>
                  </div>
                  <button
                    className={`${styles.deployBtn} ${deployed ? styles.deployBtnDone : ''}`}
                    onClick={() => setDeployed(true)}
                    disabled={deployed}
                  >
                    {deployed ? <><Check className={styles.btnIcon} /> Deployed</> : <><Rocket className={styles.btnIcon} /> Deploy to Production</>}
                  </button>
                </div>
              )}

              {deployed && (
                <motion.div className={styles.deploySuccess} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Check className={styles.deploySuccessIcon} />
                  <div>
                    <div className={styles.deploySuccessTitle}>Model Deployed!</div>
                    <div className={styles.deploySuccessDesc}>Your model is now available for predictions via the API.</div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
