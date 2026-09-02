import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sliders, Play, Square, CheckCircle2, XCircle, Loader2,
  Settings2, BarChart3, Trophy, AlertTriangle,
  ChevronDown, ChevronRight, Copy,
  Search, Grid3X3, Brain, Zap, Cpu, Hash,
} from 'lucide-react';
import {
  LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import { datasetsService } from '../../../services/datasets.service';
import { tuningService } from '../../../services/tuning.service';
import type { HPOProgress } from '../../../types/api';
import styles from './HyperparameterPage.module.css';

const METHODS = [
  { id: 'random', label: 'Random Search', desc: 'Samples random combinations from parameter space', icon: Search, requires: null, color: '#a78bfa', glow: 'rgba(167,139,250,0.3)' },
  { id: 'grid', label: 'Grid Search', desc: 'Exhaustive search over all parameter combinations', icon: Grid3X3, requires: null, color: '#34d399', glow: 'rgba(52,211,153,0.3)' },
  { id: 'bayesian', label: 'Bayesian Opt', desc: 'Probabilistic optimization using Gaussian processes', icon: Brain, requires: 'bayesian', color: '#60a5fa', glow: 'rgba(96,165,250,0.3)' },
  { id: 'optuna', label: 'Optuna', desc: 'Tree-structured Parzen Estimator (TPE)', icon: Zap, requires: 'optuna', color: '#fbbf24', glow: 'rgba(251,191,36,0.3)' },
] as const;

function formatScore(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  return `${(val * 100).toFixed(2)}%`;
}

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
};

const containerAnim = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const itemAnim = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 350, damping: 25 } },
};

export default function HyperparameterPage() {
  const { data: datasets = [], isLoading: loadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => datasetsService.list(),
    select: (d) => d.datasets,
  });

  const { data: availability, isLoading: loadingAvail } = useQuery({
    queryKey: ['hpo-availability'],
    queryFn: () => tuningService.availability(),
  });

  const [selectedDataset, setSelectedDataset] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState('random');
  const [cvFolds, setCvFolds] = useState(5);
  const [nIter, setNIter] = useState(50);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<HPOProgress | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [runError, setRunError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const selectedDs = useMemo(
    () => datasets.find((d: any) => d.name === selectedDataset),
    [datasets, selectedDataset],
  );

  const dsColumns = useMemo(() => (selectedDs as any)?.columns || [], [selectedDs]);

  const allModels = useMemo(() => {
    if (!availability) return [];
    const keys = new Set<string>();
    Object.keys(availability.param_ranges || {}).forEach((k) => keys.add(k));
    return Array.from(keys).sort();
  }, [availability]);

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
  const isDone = progress?.status === 'completed' || progress?.status === 'failed';
  const canRun = selectedDataset && targetColumn && selectedModels.size > 0 && isMethodAvailable(method) && !isRunning;

  const completedModels = progress?.model_results?.length || 0;
  const bestScore = progress?.best_score ?? null;

  const chartData = useMemo(() => {
    if (!progress?.model_results) return [];
    return progress.model_results
      .filter((r) => r.score != null)
      .map((r, i) => ({
        trial: i + 1,
        score: r.score != null ? +(r.score * 100).toFixed(2) : 0,
        name: r.name,
      }));
  }, [progress?.model_results]);

  function resetState() {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    setJobId(null);
    setProgress(null);
    setRunError(null);
    setExpandedResults(new Set());
  }

  async function handleRun() {
    if (!canRun) return;
    setRunError(null);
    setProgress(null);
    setExpandedResults(new Set());
    try {
      const res = await tuningService.run({
        file_name: selectedDataset,
        target_column: targetColumn,
        models: Array.from(selectedModels),
        method,
        cv_folds: cvFolds,
        n_iter: nIter,
      });
      setJobId(res.job_id);
      setProgress({ status: 'queued', model_results: [] });
    } catch (err: any) {
      const msg = err?.message || 'Failed to start HPO';
      setRunError(msg);
    }
  }

  function handleStop() {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    setJobId(null);
    setProgress(null);
  }

  useEffect(() => {
    if (!jobId) return;
    const unsub = tuningService.subscribeProgress(jobId, (data) => {
      setProgress(data);
      if (data.status === 'completed' || data.status === 'failed') {
        unsubRef.current?.();
        unsubRef.current = null;
      }
    });
    unsubRef.current = unsub;
    return () => { unsub(); unsubRef.current = null; };
  }, [jobId]);

  function toggleExpandResult(name: string) {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div className={styles.page}>
      <motion.div className={styles.header} initial="hidden" animate="visible" variants={fadeIn}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Sliders size={22} />
          </div>
          <div>
            <h1 className={styles.title}>Hyperparameter Optimization</h1>
            <p className={styles.subtitle}>Tune model hyperparameters with Grid Search, Random Search, Bayesian Optimization, or Optuna</p>
          </div>
        </div>
        {isDone && (
          <button className={styles.resetBtn} onClick={resetState}>
            <Sliders size={14} /> New Optimization
          </button>
        )}
      </motion.div>

      <div className={styles.layout}>
        {/* ─── Left Panel – Configuration ─── */}
        <motion.div className={styles.configPanel} initial="hidden" animate="visible" variants={fadeIn}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Settings2 size={16} className={styles.cardHeaderIcon} />
              <h2 className={styles.cardTitle}>Configuration</h2>
            </div>
            <div className={styles.cardBody}>
              {/* Dataset */}
              <div className={styles.field}>
                <label className={styles.label}>Dataset</label>
                <select
                  value={selectedDataset}
                  onChange={(e) => { setSelectedDataset(e.target.value); setTargetColumn(''); }}
                  disabled={isRunning}
                >
                  <option value="">{loadingDatasets ? 'Loading datasets...' : 'Select dataset'}</option>
                  {datasets.map((d: any) => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Target Column */}
              <div className={styles.field}>
                <label className={styles.label}>Target Column</label>
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

              {/* Search Method */}
              <div className={styles.field}>
                <label className={styles.label}>Search Method</label>
                {loadingAvail ? (
                  <div className={styles.loadingText}>Loading availability...</div>
                ) : (
                  <motion.div className={styles.methodGrid} variants={containerAnim} initial="hidden" animate="show">
                    {METHODS.map((m) => {
                      const avail = isMethodAvailable(m.id);
                      const active = method === m.id;
                      return (
                        <motion.button
                          key={m.id}
                          className={`${styles.methodCard} ${active ? styles.methodActive : ''} ${!avail ? styles.methodDisabled : ''}`}
                          onClick={() => avail && setMethod(m.id)}
                          disabled={!avail || isRunning}
                          variants={itemAnim}
                          whileHover={avail ? { y: -2 } : undefined}
                          whileTap={avail ? { scale: 0.97 } : undefined}
                          style={{ '--mc': m.color } as React.CSSProperties}
                        >
                          <div className={styles.methodIconWrap}>
                            <m.icon size={18} />
                          </div>
                          <span className={styles.methodName}>{m.label}</span>
                          <span className={styles.methodDesc}>{m.desc}</span>
                          {!avail && <AlertTriangle size={12} className={styles.methodWarn} />}
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}
              </div>

              {/* CV Folds + Iterations */}
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>CV Folds</label>
                  <select value={cvFolds} onChange={(e) => setCvFolds(Number(e.target.value))} disabled={isRunning}>
                    {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Max Iterations</label>
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

              {/* Models */}
              <div className={styles.field}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className={styles.label}>Models ({selectedModels.size}/{allModels.length})</label>
                  <div className={styles.modelActions}>
                    <button className={styles.textBtn} onClick={selectAllModels} disabled={isRunning}>All</button>
                    <span style={{ color: '#374151' }}>|</span>
                    <button className={styles.textBtn} onClick={deselectAllModels} disabled={isRunning}>None</button>
                  </div>
                </div>
                <div className={styles.modelList}>
                  {allModels.map((name) => (
                    <label key={name} className={`${styles.modelCheck} ${selectedModels.has(name) ? styles.modelCheckActive : ''}`}>
                      <input
                        type="checkbox"
                        checked={selectedModels.has(name)}
                        onChange={() => toggleModel(name)}
                        disabled={isRunning}
                      />
                      <span className={styles.modelCheckName}>{name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Error */}
              {runError && (
                <div className={styles.errorBox}>
                  <AlertTriangle size={14} />
                  <span>{runError}</span>
                </div>
              )}

              {/* Run / Stop Button */}
              <div className={styles.actions}>
                {isRunning ? (
                  <button className={`${styles.runBtn} ${styles.stopBtn}`} onClick={handleStop}>
                    <Square size={16} /> Stop Optimization
                  </button>
                ) : (
                  <button className={styles.runBtn} onClick={handleRun} disabled={!canRun}>
                    <Play size={16} /> Run Optimization
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── Right Panel – Dashboard ─── */}
        <motion.div className={styles.dashboard} initial="hidden" animate="visible" variants={fadeIn}>
          {!progress ? (
            <div className={styles.card}>
              <div className={styles.emptyState}>
                <div className={styles.emptyIconWrap}>
                  <BarChart3 size={44} />
                </div>
                <h3 className={styles.emptyTitle}>Ready to Optimize</h3>
                <p className={styles.emptyDesc}>Configure your search parameters on the left, then click Run to start hyperparameter optimization. Results will appear here in real-time.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Stats */}
              <motion.div className={styles.statsGrid} variants={containerAnim} initial="hidden" animate="show">
                <motion.div className={styles.statCard} variants={itemAnim}>
                  <div className={styles.statInner}>
                    <div className={styles.statIconWrap} style={{ color: '#a78bfa' }}>
                      <Trophy size={20} />
                    </div>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>Best Score</span>
                      <span className={styles.statValue}>{formatScore(bestScore)}</span>
                    </div>
                  </div>
                </motion.div>
                <motion.div className={styles.statCard} variants={itemAnim}>
                  <div className={styles.statInner}>
                    <div className={styles.statIconWrap} style={{ color: '#34d399' }}>
                      <Cpu size={20} />
                    </div>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>Models Tuned</span>
                      <span className={styles.statValue}>{completedModels}</span>
                    </div>
                  </div>
                </motion.div>
                <motion.div className={styles.statCard} variants={itemAnim}>
                  <div className={styles.statInner}>
                    <div className={styles.statIconWrap} style={{ color: '#60a5fa' }}>
                      <Hash size={20} />
                    </div>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>Trials</span>
                      <span className={styles.statValue}>{progress.current || 0} / {progress.total || 0}</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Status */}
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  {isRunning
                    ? <Loader2 size={16} className={styles.spinIcon} style={{ color: '#a78bfa' }} />
                    : progress.status === 'completed'
                      ? <CheckCircle2 size={16} style={{ color: '#22c55e' }} />
                      : <XCircle size={16} style={{ color: '#ef4444' }} />
                  }
                  <h2 className={styles.cardTitle}>
                    {progress.status === 'queued' && 'Queued...'}
                    {progress.status === 'starting' && 'Starting optimization...'}
                    {progress.status === 'running' && `Optimizing ${progress.current_model || ''} (${progress.current || 0}/${progress.total || 0})`}
                    {progress.status === 'completed' && 'Optimization Complete'}
                    {progress.status === 'failed' && `Failed: ${progress.error || 'Unknown'}`}
                  </h2>
                </div>
                <div className={styles.cardBody}>
                  {isRunning && (
                    <div className={styles.progressWrap}>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${((progress.current || 0) / Math.max(progress.total || 1, 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {progress.best_model && (
                    <div className={styles.bestBanner}>
                      <Trophy size={20} className={styles.trophyIcon} />
                      <div>
                        <div className={styles.bestLabel}>Best Model</div>
                        <div className={styles.bestModel}>{progress.best_model}</div>
                      </div>
                    </div>
                  )}

                  {progress.best_params && (
                    <div className={styles.paramsBox}>
                      <div className={styles.paramsLabel}>Best Parameters</div>
                      <div className={styles.paramsGrid}>
                        {Object.entries(progress.best_params).map(([k, v]) => (
                          <div key={k} className={styles.paramItem}>
                            <span className={styles.paramKey}>{k}</span>
                            <span className={styles.paramVal}>{typeof v === 'number' ? v.toFixed(4).replace(/\.?0+$/, '') : String(v)}</span>
                          </div>
                        ))}
                      </div>
                      <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(JSON.stringify(progress.best_params, null, 2))}>
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                  )}

                  {progress.status === 'completed' && progress.experiments && progress.experiments.length > 0 && (
                    <div className={styles.experimentsCreated}>
                      <CheckCircle2 size={14} style={{ color: '#22c55e' }} />
                      <span>{progress.experiments.length} experiment{progress.experiments.length !== 1 ? 's' : ''} created</span>
                    </div>
                  )}

                  {progress.error && progress.status !== 'failed' && (
                    <div className={styles.errorBox}>
                      <AlertTriangle size={14} />
                      <span>{progress.error}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 1 && (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <BarChart3 size={16} className={styles.cardHeaderIcon} />
                    <h2 className={styles.cardTitle}>Score Progression</h2>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.chartWrap}>
                      <ResponsiveContainer width="100%" height={200}>
                        <ReLineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="trial" stroke="#6b7280" fontSize={12} tickLine={false} />
                          <YAxis stroke="#6b7280" fontSize={12} tickLine={false} tickFormatter={(v) => `${v}%`} />
                          <ReTooltip
                            contentStyle={{ background: '#1f2937', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 13 }}
                            labelStyle={{ color: '#9ca3af' }}
                            formatter={(value: number, name: string, props: any) => [`${value}%`, props.payload?.name || 'Score']}
                          />
                          <Line type="monotone" dataKey="score" stroke="#7C3AED" strokeWidth={2} dot={{ fill: '#7C3AED', r: 4 }} activeDot={{ r: 6 }} />
                        </ReLineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Trial Log */}
              {progress.model_results && progress.model_results.length > 0 && (
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <BarChart3 size={16} className={styles.cardHeaderIcon} />
                    <h2 className={styles.cardTitle}>Trial Log</h2>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Model</th>
                            <th>Score</th>
                            <th>Status</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {progress.model_results.map((r, i) => {
                            const isExpanded = expandedResults.has(r.name);
                            const isBest = progress.best_model === r.name;
                            return (
                              <AnimatePresence key={`${r.name}-${i}`}>
                                <tr className={`${styles.tableRow} ${isBest ? styles.tableRowBest : ''}`}>
                                  <td className={styles.tdMono}>{i + 1}</td>
                                  <td className={styles.tdName}>
                                    <span className={styles.modelName}>{r.name}</span>
                                    {isBest && <span className={styles.bestBadge}>BEST</span>}
                                  </td>
                                  <td className={styles.tdScore}>{r.error ? '—' : formatScore(r.score)}</td>
                                  <td>
                                    {r.error ? (
                                      <span className={styles.statusError}><XCircle size={14} /> Error</span>
                                    ) : (
                                      <span className={styles.statusOk}><CheckCircle2 size={14} /> OK</span>
                                    )}
                                  </td>
                                  <td>
                                    <button className={styles.expandBtn} onClick={() => toggleExpandResult(r.name)}>
                                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </button>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={5} className={styles.detailCell}>
                                      {r.error ? (
                                        <div className={styles.errorText}>{r.error}</div>
                                      ) : r.params ? (
                                        <div className={styles.paramsGrid}>
                                          {Object.entries(r.params).map(([k, v]) => (
                                            <div key={k} className={styles.paramItem}>
                                              <span className={styles.paramKey}>{k}</span>
                                              <span className={styles.paramVal}>{typeof v === 'number' ? v.toFixed(4).replace(/\.?0+$/, '') : String(v)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className={styles.errorText}>No params recorded</div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </AnimatePresence>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
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
