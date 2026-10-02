import { Fragment, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Sliders, Database, Sparkles, SlidersHorizontal, ListChecks, Settings2,
  Rocket, Square, Loader2, CheckCircle2, XCircle, AlertTriangle, Trophy,
  Copy, ChevronDown, ChevronRight, Lock, FolderKanban, Search, Grid3X3,
  Brain, Zap, Clock, BarChart3,
} from 'lucide-react';
import {
  LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts';
import { datasetsService } from '../../../services/datasets.service';
import { projectsService } from '../../../services/projects.service';
import { tuningService } from '../../../services/tuning.service';
import type { HPOProgress, TargetAnalysis } from '../../../types/api';
import styles from './HyperparameterPage.module.css';

const METHODS = [
  { id: 'random', label: 'Random Search', desc: 'Samples random combos from the parameter space', icon: Search, requires: null, color: '#a78bfa' },
  { id: 'grid', label: 'Grid Search', desc: 'Exhaustive search over all combinations', icon: Grid3X3, requires: null, color: '#34d399' },
  { id: 'bayesian', label: 'Bayesian Opt', desc: 'Probabilistic search via Gaussian processes', icon: Brain, requires: 'bayesian', color: '#60a5fa' },
  { id: 'optuna', label: 'Optuna', desc: 'Tree-structured Parzen Estimator (TPE)', icon: Zap, requires: 'optuna', color: '#fbbf24' },
] as const;

const STEPS = [
  { id: 'dataset', title: 'Dataset', icon: Database },
  { id: 'method', title: 'Search Method', icon: Sparkles },
  { id: 'params', title: 'Parameters', icon: SlidersHorizontal },
  { id: 'models', title: 'Models', icon: ListChecks },
  { id: 'advanced', title: 'Advanced Settings', icon: Settings2 },
] as const;

function formatScore(val: number | null | undefined, task?: string): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  if (task === 'regression') return val.toFixed(4);
  return `${(val * 100).toFixed(2)}%`;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatValue(v: unknown): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/\.?0+$/, '');
  return String(v);
}

const fadeIn = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
};

export default function HyperparameterPage() {
  const { data: datasets = [], isLoading: loadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
    select: (d: any) => d.datasets || [],
  });

  const { data: availability, isLoading: loadingAvail } = useQuery({
    queryKey: ['hpo-availability'],
    queryFn: () => tuningService.availability(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
    select: (d: any) => d?.projects || [],
    retry: false,
    staleTime: 60_000,
  });

  const [selectedDataset, setSelectedDataset] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [modelQuery, setModelQuery] = useState('');
  const [method, setMethod] = useState('random');
  const [cvFolds, setCvFolds] = useState(5);
  const [nIter, setNIter] = useState(50);
  const [selectedProject, setSelectedProject] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<HPOProgress | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [runError, setRunError] = useState<string | null>(null);
  const [targetProfile, setTargetProfile] = useState<TargetAnalysis | null>(null);
  const [targetAnalyzing, setTargetAnalyzing] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const unsubRef = useRef<(() => void) | null>(null);
  const cvFoldsRef = useRef(5);
  const startRef = useRef(0);
  const modelDurRef = useRef<Record<string, number>>({});
  const prevResultsRef = useRef(0);

  const selectedDs = useMemo(
    () => datasets.find((d: any) => d.name === selectedDataset),
    [datasets, selectedDataset],
  );

  const dsColumns = useMemo(() => (selectedDs as any)?.columns || [], [selectedDs]);

  const taskType = targetProfile?.task_type;

  const compatibleModels = useMemo(() => {
    if (!availability) return [];
    const source = taskType === 'regression' ? availability.regression_models : availability.classification_models;
    if (source && source.length > 0) return source;
    return [];
  }, [availability, taskType]);

  const allModels = useMemo(() => {
    if (!availability) return [];
    if (compatibleModels.length > 0) return compatibleModels;
    const keys = new Set<string>();
    Object.keys(availability.param_ranges || {}).forEach((k) => keys.add(k));
    return Array.from(keys).sort();
  }, [availability, compatibleModels]);

  const filteredModels = useMemo(() => {
    const q = modelQuery.trim().toLowerCase();
    if (!q) return allModels;
    return allModels.filter((n) => n.toLowerCase().includes(q));
  }, [allModels, modelQuery]);

  const rangeHint = useCallback((name: string) => {
    if (!availability?.param_ranges?.[name]) return null;
    const keys = Object.keys(availability.param_ranges[name]);
    if (keys.length === 0) return null;
    return keys.slice(0, 4).join(', ') + (keys.length > 4 ? ` +${keys.length - 4}` : '');
  }, [availability]);

  useEffect(() => {
    setSelectedModels((prev) => {
      if (allModels.length === 0) return prev;
      const next = new Set(prev);
      let changed = false;
      for (const name of next) {
        if (!allModels.includes(name)) { next.delete(name); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [allModels]);

  useEffect(() => {
    cvFoldsRef.current = cvFolds;
  }, [cvFolds]);

  const isMethodAvailable = useCallback((methodId: string) => {
    if (!availability) return false;
    const m = METHODS.find((x) => x.id === methodId);
    if (!m) return false;
    if (!m.requires) return true;
    return (availability as any)[m.requires] === true;
  }, [availability]);

  const toggleModel = useCallback((name: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const selectAllModels = useCallback(() => {
    setSelectedModels(new Set(allModels));
  }, [allModels]);

  const deselectAllModels = useCallback(() => {
    setSelectedModels(new Set());
  }, []);

  const isRunning = progress?.status === 'running' || progress?.status === 'queued' || progress?.status === 'starting';
  const isDone = progress?.status === 'completed' || progress?.status === 'failed' || progress?.status === 'cancelled';
  const isCancelled = progress?.status === 'cancelled';
  const isFailed = progress?.status === 'failed';
  const targetBlocked = !!targetProfile?.blocked;
  const canRun = !!selectedDataset && !!targetColumn && selectedModels.size > 0 && isMethodAvailable(method) && !isRunning && !targetBlocked;

  const completedModels = progress?.model_results?.length || 0;
  const bestScore = progress?.best_score ?? null;
  const metricKey = taskType === 'regression' ? 'r2' : 'accuracy';
  const metricLabel = taskType === 'regression' ? 'R²' : 'Accuracy';
  const primaryMetric = progress?.best_metrics?.[metricKey] ?? null;

  // Step flow
  const stepDone = [
    !!selectedDataset && !!targetColumn && !targetBlocked && !targetError,
    !!method && isMethodAvailable(method),
    cvFolds >= 1 && nIter >= 1,
    selectedModels.size > 0,
  ];
  const firstOpen = stepDone.findIndex((d) => !d);
  const stepState = (idx: number): 'done' | 'active' | 'locked' => {
    if (idx === 4) return 'done';
    if (firstOpen === -1) return 'done';
    if (idx < firstOpen) return 'done';
    return idx === firstOpen ? 'active' : 'locked';
  };
  const stepCls = (idx: number): string => {
    const s = stepState(idx);
    return s === 'active' ? styles.isActive : s === 'locked' ? styles.isLocked : styles.isDone;
  };
  const renderBadge = (idx: number) => {
    const s = stepState(idx);
    if (idx < 4 && s === 'done') return <CheckCircle2 size={13} />;
    if (idx < 4 && s === 'locked') return <Lock size={12} />;
    return <>{idx + 1}</>;
  };

  const chartData = useMemo(() => {
    if (!progress?.model_results) return [];
    const rows = progress.model_results.filter((r) => r.score != null);
    let bestVal = -Infinity;
    return rows.map((r, i) => {
      const score = r.score != null ? +(r.score * 100).toFixed(2) : 0;
      if (score > bestVal) bestVal = score;
      return { trial: i + 1, score, name: r.name, best: score === bestVal, isBest: progress?.best_model === r.name };
    });
  }, [progress?.model_results, progress?.best_model]);

  function resetProgressTimers() {
    startRef.current = 0;
    modelDurRef.current = {};
    prevResultsRef.current = 0;
    setElapsedMs(0);
  }

  function resetState() {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    setJobId(null);
    setProgress(null);
    setRunError(null);
    setStopping(false);
    setExpandedResults(new Set());
    resetProgressTimers();
  }

  async function handleRun() {
    if (!canRun) return;
    setRunError(null);
    setProgress(null);
    setStopping(false);
    setExpandedResults(new Set());
    resetProgressTimers();
    try {
      const res = await tuningService.run({
        file_name: selectedDataset,
        target_column: targetColumn,
        models: Array.from(selectedModels),
        method,
        cv_folds: cvFolds,
        n_iter: nIter,
        task_type: taskType,
        project_id: selectedProject || undefined,
      });
      setJobId(res.job_id);
      startRef.current = Date.now();
      setProgress({ status: 'queued', model_results: [] });
    } catch (err: any) {
      const msg = err?.message || 'Failed to start HPO';
      setRunError(msg);
    }
  }

  async function handleStop() {
    if (stopping || !jobId) return;
    setStopping(true);
    try {
      await tuningService.cancel(jobId);
    } catch {
      // Cancel may fail if the job just finished; the live SSE will surface the real terminal state.
    }
  }

  useEffect(() => {
    if (!jobId) return;
    const unsub = tuningService.subscribeProgress(jobId, (data) => {
      setProgress(data);
      setElapsedMs(Date.now() - (startRef.current || Date.now()));

      const rows = data.model_results || [];
      const count = rows.length;
      if (count > prevResultsRef.current) {
        let prev = prevResultsRef.current > 0 ? undefined : startRef.current;
        rows.slice(prevResultsRef.current).forEach((row) => {
          if (row.name && !(row.name in modelDurRef.current)) {
            const now = Date.now();
            modelDurRef.current[row.name] = prev ? now - prev : 0;
            prev = now;
          }
        });
        prevResultsRef.current = count;
      }

      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        unsubRef.current?.();
        unsubRef.current = null;
        if (data.status === 'cancelled') setStopping(false);
      }
    });
    unsubRef.current = unsub;
    return () => { unsub(); unsubRef.current = null; };
  }, [jobId]);

  useEffect(() => {
    if (!selectedDataset || !targetColumn) {
      setTargetProfile(null);
      setTargetError(null);
      setTargetAnalyzing(false);
      return;
    }
    let cancelled = false;
    const folds = cvFoldsRef.current;
    setTargetAnalyzing(true);
    setTargetError(null);
    tuningService.analyzeTarget(selectedDataset, targetColumn, { cv_folds: folds })
      .then((p) => {
        if (cancelled) return;
        setTargetProfile(p);
        setTargetAnalyzing(false);
        if (p.task_type === 'classification' && p.safe_cv_folds && p.safe_cv_folds >= 2 && p.safe_cv_folds < folds) {
          setCvFolds(p.safe_cv_folds);
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        setTargetProfile(null);
        setTargetError(err?.message || 'Could not analyze target column');
        setTargetAnalyzing(false);
      });
    return () => { cancelled = true; };
  }, [selectedDataset, targetColumn, cvFolds]);

  function toggleExpandResult(name: string) {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const methodLabel = METHODS.find((m) => m.id === method)?.label || method;
  const allConfigured = firstOpen === -1;

  return (
    <div className={styles.page}>
      <motion.div className={styles.header} initial="hidden" animate="visible" variants={fadeIn}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Sliders size={20} />
          </div>
          <div>
            <h1 className={styles.title}>Hyperparameter Optimization</h1>
            <p className={styles.subtitle}>Grid, Random, Bayesian, or Optuna — tuned against your data in real time</p>
          </div>
        </div>
        {isDone && (
          <button className={styles.resetBtn} onClick={resetState}>
            <Sliders size={13} /> New Optimization
          </button>
        )}
      </motion.div>

      <div className={styles.workspace}>
        {/* ───── Configuration (40%) ───── */}
        <motion.aside className={styles.configPanel} initial="hidden" animate="visible" variants={fadeIn}>
          <div className={`${styles.card} ${styles.configCard}`}>
            <div className={styles.cardHeader}>
              <Settings2 size={15} className={styles.cardHeaderIcon} />
              <h2 className={styles.cardTitle}>Configuration</h2>
              <span className={styles.configCount}>{allConfigured ? 'Ready' : `${Math.min(firstOpen + 1, 4)} / 4`}</span>
            </div>

            <div className={`${styles.cardBody} ${styles.steps}`}>
              {STEPS.map((step) => {
                const idx = parseInt(String(step.id === 'dataset' ? 0 : step.id === 'method' ? 1 : step.id === 'params' ? 2 : step.id === 'models' ? 3 : 4), 10);
                return (
                  <section key={step.id} className={`${styles.step} ${stepCls(idx)}`}>
                    <div className={styles.stepHead}>
                      <span className={styles.stepBadge}>{renderBadge(idx)}</span>
                      <span className={styles.stepTitle}>{step.title}</span>
                      {stepState(idx) === 'locked' && <span className={styles.stepLock}><Lock size={11} /> Next</span>}
                    </div>
                    <div className={styles.stepBody}>
                      {step.id === 'dataset' && (
                        <>
                          <div className={styles.field}>
                            <label className={styles.label}>Source data</label>
                            <select
                              value={selectedDataset}
                              onChange={(e) => { setSelectedDataset(e.target.value); setTargetColumn(''); }}
                              disabled={isRunning}
                            >
                              <option value="">{loadingDatasets ? 'Loading datasets…' : 'Select dataset'}</option>
                              {datasets.map((d: any) => (
                                <option key={d.name} value={d.name}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className={styles.field}>
                            <label className={styles.label}>Target column</label>
                            <select
                              value={targetColumn}
                              onChange={(e) => setTargetColumn(e.target.value)}
                              disabled={!selectedDataset || isRunning}
                            >
                              <option value="">{!selectedDataset ? 'Select dataset first' : 'Select target'}</option>
                              {dsColumns.map((c: string) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>

                          {targetAnalyzing && (
                            <div className={styles.analyzingBox}>
                              <Loader2 size={13} className={styles.spinIcon} /> Analyzing target… (task type, class balance, CV validity)
                            </div>
                          )}
                          {targetError && !targetAnalyzing && (
                            <div className={styles.errorBox}><XCircle size={14} /><span>{targetError}</span></div>
                          )}

                          {targetProfile && !targetAnalyzing && (
                            <div className={styles.targetProfile}>
                              <div className={styles.profileTop}>
                                <span className={styles.profileTitle}>Target Profile</span>
                                <span className={`${styles.badgeClf} ${targetProfile.task_type !== 'classification' ? styles.badgeReg : ''}`}>
                                  {targetProfile.task_type === 'classification' ? 'Classification' : 'Regression'}
                                </span>
                              </div>
                              <div className={styles.profileChips}>
                                <div className={styles.profileChip}>
                                  <span className={styles.chipLabel}>{targetProfile.task_type === 'classification' ? 'Classes' : 'Samples'}</span>
                                  <span className={styles.chipValue}>{targetProfile.task_type === 'classification' ? (targetProfile.n_classes ?? '—') : (targetProfile.total_samples ?? '—')}</span>
                                </div>
                                <div className={styles.profileChip}>
                                  <span className={styles.chipLabel}>Min class</span>
                                  <span className={styles.chipValue}>{targetProfile.min_class_count ?? '—'}</span>
                                </div>
                                <div className={styles.profileChip}>
                                  <span className={styles.chipLabel}>CV folds</span>
                                  <span className={styles.chipValue}>{targetProfile.cv_valid ? (targetProfile.cv_adjusted ? `${targetProfile.safe_cv_folds} auto` : `${targetProfile.safe_cv_folds}`) : 'Invalid'}</span>
                                </div>
                              </div>
                              {targetProfile.warning && (
                                <div className={styles.warnBox}><AlertTriangle size={13} /><span>{targetProfile.warning}</span></div>
                              )}
                              {targetProfile.blocked && (
                                <div className={styles.errorBox}><XCircle size={13} /><span>{targetProfile.block_reason}</span></div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {step.id === 'method' && (
                        loadingAvail ? (
                          <div className={styles.analyzingBox}><Loader2 size={13} className={styles.spinIcon} /> Loading availability…</div>
                        ) : (
                          <div className={styles.methodGrid}>
                            {METHODS.map((m) => {
                              const avail = isMethodAvailable(m.id);
                              const active = method === m.id;
                              return (
                                <button
                                  key={m.id}
                                  className={`${styles.methodCard} ${active ? styles.methodActive : ''} ${!avail ? styles.methodDisabled : ''}`}
                                  onClick={() => avail && setMethod(m.id)}
                                  disabled={!avail || isRunning}
                                  style={{ '--mc': m.color } as React.CSSProperties}
                                  title={!avail ? `${m.label} is not installed on the server` : m.desc}
                                >
                                  <div className={styles.methodIcon}>
                                    <m.icon size={16} />
                                  </div>
                                  <div className={styles.methodText}>
                                    <span className={styles.methodName}>{m.label}</span>
                                    <span className={styles.methodDesc}>{m.desc}</span>
                                  </div>
                                  {active && <span className={styles.methodCheck}><CheckCircle2 size={12} /></span>}
                                  {!avail && <AlertTriangle size={12} className={styles.methodWarn} />}
                                </button>
                              );
                            })}
                          </div>
                        )
                      )}

                      {step.id === 'params' && (
                        <>
                          <div className={styles.paramRow}>
                            <div className={styles.field}>
                              <label className={styles.label}>CV folds</label>
                              <select value={cvFolds} onChange={(e) => setCvFolds(Number(e.target.value))} disabled={isRunning}>
                                {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n} folds</option>)}
                                {![3, 5, 7, 10].includes(cvFolds) && <option value={cvFolds}>{cvFolds} folds</option>}
                              </select>
                            </div>
                            <div className={styles.field}>
                              <label className={styles.label}>Max iterations</label>
                              <input
                                type="number"
                                value={nIter}
                                onChange={(e) => setNIter(Math.max(1, Number(e.target.value)))}
                                min={1}
                                max={500}
                                disabled={isRunning}
                              />
                            </div>
                          </div>
                          {targetProfile?.cv_adjusted && targetProfile.safe_cv_folds > 0 && (
                            <div className={styles.hintLine}>
                              <Sparkles size={12} /> CV auto-adjusted to {targetProfile.safe_cv_folds} folds for this target
                            </div>
                          )}
                        </>
                      )}

                      {step.id === 'models' && (
                        <>
                          <div className={styles.modelToolbar}>
                            <div className={styles.modelSearchWrap}>
                              <Search size={13} />
                              <input
                                className={styles.modelSearch}
                                type="text"
                                placeholder="Filter models…"
                                value={modelQuery}
                                onChange={(e) => setModelQuery(e.target.value)}
                                disabled={isRunning}
                              />
                            </div>
                            <div className={styles.modelActions}>
                              <button className={styles.textBtn} onClick={selectAllModels} disabled={isRunning}>All</button>
                              <span className={styles.textDivider}>/</span>
                              <button className={styles.textBtn} onClick={deselectAllModels} disabled={isRunning}>None</button>
                            </div>
                          </div>
                          <div className={styles.modelList}>
                            {allModels.length === 0 && (
                              <div className={styles.modelEmpty}>
                                {targetProfile ? 'No compatible models for this target type' : 'Select a dataset and target to see models'}
                              </div>
                            )}
                            {filteredModels.length === 0 && allModels.length > 0 && (
                              <div className={styles.modelEmpty}>No models match “{modelQuery}”</div>
                            )}
                            {filteredModels.map((name) => (
                              <label key={name} className={`${styles.modelRow} ${selectedModels.has(name) ? styles.modelRowActive : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={selectedModels.has(name)}
                                  onChange={() => toggleModel(name)}
                                  disabled={isRunning}
                                />
                                <span className={styles.modelRowText}>
                                  <span className={styles.modelRowName}>{name}</span>
                                  {rangeHint(name) && <span className={styles.modelRowHint}>tunes {rangeHint(name)}</span>}
                                </span>
                              </label>
                            ))}
                          </div>
                        </>
                      )}

                      {step.id === 'advanced' && (
                        <>
                          <div className={styles.field}>
                            <label className={styles.label}>Attach to project</label>
                            <div className={styles.advRow}>
                              <FolderKanban size={14} className={styles.advIcon} />
                              <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} disabled={isRunning}>
                                <option value="">No project (standalone)</option>
                                {(projects as any[]).map((p: any) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className={styles.advNote}>
                            Experiments are saved to the registry and linked to the selected project. The best tuned model is persisted automatically when the run completes.
                          </div>
                        </>
                      )}
                    </div>
                  </section>
                );
              })}

              {runError && (
                <div className={styles.errorBox}><AlertTriangle size={14} /><span>{runError}</span></div>
              )}

              {/* Run */}
              <div className={styles.runZone}>
                {!isRunning && (
                  <div className={styles.runSummary}>
                    {canRun ? (
                      <>
                        <span className={styles.runChip}>{selectedModels.size} model{selectedModels.size !== 1 ? 's' : ''}</span>
                        <span className={styles.runChip}>{methodLabel}</span>
                        <span className={styles.runChip}>{cvFolds}-fold CV</span>
                        <span className={styles.runChip}>{nIter} iter{nIter !== 1 ? 's' : ''}</span>
                        {selectedProject && <span className={styles.runChip}>project attached</span>}
                      </>
                    ) : (
                      <span className={styles.runHint}>
                        {!selectedDataset || !targetColumn ? 'Select a dataset and target column'
                          : !targetProfile || targetBlocked ? (targetBlocked ? 'Target blocked — review the target profile' : 'Waiting for target analysis')
                            : selectedModels.size === 0 ? 'Select at least one model'
                              : !isMethodAvailable(method) ? 'Selected method is unavailable'
                                : 'Ready to run'}
                      </span>
                    )}
                  </div>
                )}
                {isRunning ? (
                  <button className={`${styles.runBtn} ${styles.runBtnStop}`} onClick={handleStop} disabled={stopping}>
                    {stopping ? <><Loader2 size={16} className={styles.spinIcon} /> Cancelling…</> : <><Square size={16} /> Stop Optimization</>}
                  </button>
                ) : (
                  <button className={styles.runBtn} onClick={handleRun} disabled={!canRun}>
                    <Rocket size={16} /> Run Optimization
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.aside>

        {/* ───── Results (60%) ───── */}
        <motion.div className={styles.resultsPanel} initial="hidden" animate="visible" variants={fadeIn}>
          {!progress ? (
            <div className={`${styles.card} ${styles.emptyCard}`}>
              <div className={styles.emptyInner}>
                <div className={styles.emptyIcon}><BarChart3 size={34} /></div>
                <h3 className={styles.emptyTitle}>Ready to Optimize</h3>
                <p className={styles.emptyDesc}>Configure your search on the left, then click <strong>Run Optimization</strong>. Live status, the best model, and the score progression will appear here.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Status bar */}
              <div className={styles.statusBar}>
                <div className={styles.statusTop}>
                  <div className={styles.statusIcon}>
                    {isRunning
                      ? <Loader2 size={18} className={styles.spinIcon} style={{ color: '#a78bfa' }} />
                      : progress.status === 'completed'
                        ? <CheckCircle2 size={18} style={{ color: '#34d399' }} />
                        : progress.status === 'cancelled'
                          ? <Square size={18} style={{ color: '#f59e0b' }} />
                          : <XCircle size={18} style={{ color: '#ef4444' }} />
                    }
                  </div>
                  <div className={styles.statusText}>
                    <div className={styles.statusTitle}>
                      {progress.status === 'queued' && 'Queued — starting optimization…'}
                      {progress.status === 'starting' && 'Starting optimization…'}
                      {progress.status === 'running' && 'Optimization Running'}
                      {progress.status === 'completed' && 'Optimization Complete'}
                      {progress.status === 'cancelled' && 'Optimization Cancelled'}
                      {progress.status === 'failed' && 'Optimization Failed'}
                    </div>
                    <div className={styles.statusSub}>
                      {progress.status === 'running'
                        ? (progress.current_model ? `Tuning ${progress.current_model} — ${progress.current || 0}/${progress.total || 0} models complete` : 'Preparing data…')
                        : progress.status === 'queued'
                          ? 'Preparing job'
                          : (isCancelled && progress.message) ? progress.message : (isFailed && progress.error) || ''}
                    </div>
                  </div>
                  <div className={styles.statusMeta}>
                    <span className={styles.chip}><Clock size={12} /> {formatDuration(elapsedMs)}</span>
                    <span className={styles.chip}><BarChart3 size={12} /> {completedModels}/{progress.total || 0}</span>
                  </div>
                </div>
                {isRunning && (
                  <div className={styles.progressRow}>
                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${Math.min(100, ((progress.current || 0) / Math.max(progress.total || 1, 1)) * 100)}%` }}
                      />
                    </div>
                    <span className={styles.progressPct}>{Math.round(((progress.current || 0) / Math.max(progress.total || 1, 1)) * 100)}%</span>
                  </div>
                )}
              </div>

              {/* Best model */}
              <div className={styles.bestCard}>
                <div className={styles.bestHead}>
                  <Trophy size={15} className={styles.trophyIcon} />
                  <span className={styles.bestHeadTitle}>Best Model</span>
                  {progress.status === 'completed' && progress.best_model && <span className={styles.bestBadge}>BEST</span>}
                </div>
                <div className={styles.bestBody}>
                  <div className={styles.bestIdentity}>
                    <div className={styles.bestScoreVal}>{formatScore(bestScore, taskType)}</div>
                    <div className={styles.bestScoreLabel}>{metricLabel}</div>
                    <div className={styles.bestModelLine}>{progress.best_model || 'Waiting for first result…'}</div>
                    {primaryMetric != null && progress.status === 'completed' && (
                      <div className={styles.bestMetricRow}><span>{metricLabel}</span> <strong>{formatScore(Number(primaryMetric), taskType)}</strong></div>
                    )}
                  </div>
                  <div className={styles.bestParams}>
                    {progress.best_params && Object.keys(progress.best_params).length > 0 ? (
                      <>
                        <div className={styles.bestParamsGrid}>
                          {Object.entries(progress.best_params).map(([k, v]) => (
                            <div key={k} className={styles.paramChip}>
                              <span className={styles.paramKey}>{k}</span>
                              <span className={styles.paramVal}>{formatValue(v)}</span>
                            </div>
                          ))}
                        </div>
                        <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(JSON.stringify(progress.best_params, null, 2))}>
                          <Copy size={11} /> Copy params
                        </button>
                      </>
                    ) : (
                      <div className={styles.bestEmpty}>Best hyperparameters will stream in as trials complete</div>
                    )}
                  </div>
                </div>
              </div>

              {(progress.status === 'completed' && (progress.saved_model_name || (progress.experiments?.length ?? 0) > 0)) && (
                <div className={styles.footerNote}>
                  {progress.saved_model_name && <span className={styles.footerItem}><CheckCircle2 size={13} /> saved <strong>{progress.saved_model_name}</strong></span>}
                  {(progress.experiments?.length ?? 0) > 0 && (
                    <span className={styles.footerItem}><CheckCircle2 size={13} /> {progress.experiments!.length} experiment{progress.experiments!.length !== 1 ? 's' : ''} created</span>
                  )}
                </div>
              )}
              {isCancelled && (
                <div className={styles.errorBox}><AlertTriangle size={14} /><span>Optimization was cancelled. Partial results shown below.</span></div>
              )}

              {/* Score progression */}
              {chartData.length > 1 && (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <BarChart3 size={15} className={styles.cardHeaderIcon} />
                    <h2 className={styles.cardTitle}>Score Progression</h2>
                    {progress.best_score != null && <span className={styles.metaChip}>best {formatScore(progress.best_score, taskType)}</span>}
                  </div>
                  <div className={styles.chartBody}>
                    <ResponsiveContainer width="100%" height={250}>
                      <ReLineChart data={chartData} margin={{ top: 16, right: 20, bottom: 4, left: -6 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                        <XAxis dataKey="trial" stroke="#5b6b85" fontSize={12} tickLine={false} axisLine={{ stroke: 'rgba(148,163,184,0.12)' }} tickFormatter={(v) => `#${v}`} />
                        <YAxis stroke="#5b6b85" fontSize={12} tickLine={false} axisLine={{ stroke: 'rgba(148,163,184,0.12)' }} tickFormatter={(v) => (taskType === 'regression' ? v.toFixed(2) : `${v}%`)} domain={['auto', 'auto']} />
                        {progress.best_score != null && (
                          <ReferenceLine y={+(progress.best_score * 100).toFixed(2)} stroke="#a78bfa" strokeDasharray="4 4" strokeOpacity={0.6} />
                        )}
                        <ReTooltip
                          contentStyle={{ background: '#131c2e', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                          labelStyle={{ color: '#93a3bd', fontWeight: 600 }}
                          formatter={(value: number, name: string, props: any) => [taskType === 'regression' ? value.toFixed(2) : `${value}%`, props?.payload?.name || 'Score']}
                          labelFormatter={(label) => `Iteration #${label}`}
                          cursor={{ stroke: 'rgba(148,163,184,0.3)', strokeDasharray: '3 3' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#7C3AED"
                          strokeWidth={2.5}
                          dot={(props: any) => props?.payload?.best === true
                            ? <circle cx={props.cx} cy={props.cy} r={5} fill="#fbbf24" stroke="#131c2e" strokeWidth={2} />
                            : <circle cx={props.cx} cy={props.cy} r={2.5} fill="#7C3AED" stroke="none" />}
                          activeDot={{ r: 6, fill: '#a78bfa', stroke: '#131c2e', strokeWidth: 2 }}
                        />
                        {chartData.some((d) => d.isBest) && (() => {
                          const bestIdx = chartData.findIndex((d) => d.isBest);
                          return bestIdx !== -1 && chartData[bestIdx]
                            ? <ReferenceDot x={chartData[bestIdx].trial} y={chartData[bestIdx].score} r={5} fill="#fbbf24" stroke="#ffedd5" strokeWidth={1.5} />
                            : null;
                        })()}
                      </ReLineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Trial log */}
              {progress.model_results && progress.model_results.length > 0 && (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <ListChecks size={15} className={styles.cardHeaderIcon} />
                    <h2 className={styles.cardTitle}>Trial Log</h2>
                    <span className={styles.metaChip}>{progress.model_results.length} trial{progress.model_results.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Model</th>
                          <th>Parameters</th>
                          <th>Score</th>
                          <th>Status</th>
                          <th>Time</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {progress.model_results.map((r, i) => {
                          const isExpanded = expandedResults.has(r.name);
                          const isBest = progress.best_model === r.name;
                          const dur = modelDurRef.current[r.name];
                          const params = r.params || {};
                          return (
                            <Fragment key={`${r.name}-${i}`}>
                              <tr className={`${styles.tableRow} ${isBest ? styles.rowBest : ''}`}>
                                <td className={styles.tdMono}>{i + 1}</td>
                                <td className={styles.cellModel}>
                                  <span className={styles.modelName}>{r.name}</span>
                                  {isBest && <span className={styles.bestBadge}>BEST</span>}
                                </td>
                                <td className={styles.cellParams}>
                                  {r.error ? '—' : (
                                    <span className={styles.paramMini}>
                                      {Object.entries(params).slice(0, 3).map(([k, v]) => (
                                        <span key={k} className={styles.paramMiniItem}>{k}={formatValue(v)}</span>
                                      ))}
                                      {Object.keys(params).length > 3 && <span className={styles.paramMiniMore}>+{Object.keys(params).length - 3}</span>}
                                    </span>
                                  )}
                                </td>
                                <td className={styles.tdScore}>{r.error ? '—' : formatScore(r.score, taskType)}</td>
                                <td>
                                  {r.error ? (
                                    <span className={styles.statusError}><XCircle size={12} /> Error</span>
                                  ) : (
                                    <span className={styles.statusOk}><CheckCircle2 size={12} /> OK</span>
                                  )}
                                </td>
                                <td className={styles.durTd}>{r.error ? '—' : formatDuration(dur)}</td>
                                <td>
                                  <button className={styles.expandBtn} onClick={() => toggleExpandResult(r.name)}>
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr className={styles.detailRow}>
                                  <td colSpan={7} className={styles.detailCell}>
                                    {r.error ? (
                                      <div className={styles.errorText}>{r.error}</div>
                                    ) : r.params ? (
                                      <div className={styles.detailGrid}>
                                        {Object.entries(r.params).map(([k, v]) => (
                                          <div key={k} className={styles.paramChip}>
                                            <span className={styles.paramKey}>{k}</span>
                                            <span className={styles.paramVal}>{formatValue(v)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className={styles.errorText}>No parameters recorded</div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}