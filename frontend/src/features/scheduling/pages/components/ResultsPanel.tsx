import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Timer, ChevronDown, ChevronUp, XCircle, Medal, BarChart3, Sparkles } from 'lucide-react';
import { EngineProgress, EngineResult } from '../../../../services/engine.service';
import styles from './ResultsPanel.module.css';

interface ResultsPanelProps {
  progress: EngineProgress | null;
  taskType: string;
  expandedModels: Set<string>;
  onToggleExpand: (name: string) => void;
}

function getMetricDisplay(metrics: Record<string, any> | undefined, taskType: string): { label: string; value: string }[] {
  if (!metrics) return [];
  if (taskType === 'classification') return [
    { label: 'Accuracy', value: metrics.accuracy != null ? `${(metrics.accuracy * 100).toFixed(1)}%` : '-' },
    { label: 'F1', value: metrics.f1 != null ? metrics.f1.toFixed(4) : '-' },
    { label: 'Precision', value: metrics.precision != null ? metrics.precision.toFixed(4) : '-' },
    { label: 'Recall', value: metrics.recall != null ? metrics.recall.toFixed(4) : '-' },
  ];
  if (taskType === 'regression') return [
    { label: 'R\u00B2', value: metrics.r2 != null ? metrics.r2.toFixed(4) : '-' },
    { label: 'RMSE', value: metrics.rmse != null ? metrics.rmse.toFixed(4) : '-' },
    { label: 'MAE', value: metrics.mae != null ? metrics.mae.toFixed(4) : '-' },
  ];
  if (taskType === 'clustering') return [
    { label: 'Silhouette', value: metrics.silhouette != null ? metrics.silhouette.toFixed(4) : '-' },
    { label: 'Calinski', value: metrics.calinski_harabasz != null ? metrics.calinski_harabasz.toFixed(1) : '-' },
    { label: 'Davies-Bouldin', value: metrics.davies_bouldin != null ? metrics.davies_bouldin.toFixed(4) : '-' },
    { label: 'Clusters', value: metrics.n_clusters != null ? String(metrics.n_clusters) : '-' },
  ];
  if (taskType === 'time_series') return [
    { label: 'R\u00B2', value: metrics.r2 != null ? metrics.r2.toFixed(4) : '-' },
    { label: 'RMSE', value: metrics.rmse != null ? metrics.rmse.toFixed(4) : '-' },
    { label: 'MAPE', value: metrics.mape != null ? `${metrics.mape.toFixed(2)}%` : '-' },
    { label: 'SMAPE', value: metrics.smape != null ? `${metrics.smape.toFixed(2)}%` : '-' },
  ];
  return [];
}

function getPrimaryMetric(r: EngineResult, taskType: string): number | null {
  if (taskType === 'clustering') return r.metrics?.silhouette ?? null;
  if (taskType === 'classification') return r.metrics?.accuracy ?? null;
  return r.metrics?.r2 ?? null;
}

function getRankIcon(i: number) {
  if (i === 0) return <Medal className={styles.rankGold} />;
  if (i === 1) return <Medal className={styles.rankSilver} />;
  if (i === 2) return <Medal className={styles.rankBronze} />;
  return <span className={styles.rankNum}>{i + 1}</span>;
}

export function ResultsPanel({ progress, taskType, expandedModels, onToggleExpand }: ResultsPanelProps) {
  if (!progress) return null;

  const results = progress.results || [];
  const successful = results.filter((r: EngineResult) => r.status === 'success');
  const failed = results.filter((r: EngineResult) => r.status === 'error');
  const avgTime = successful.length > 0
    ? (successful.reduce((s, r) => s + (r.training_time || 0), 0) / successful.length).toFixed(2)
    : '0';

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.5 }}
    >
      {/* Champion Banner */}
      {progress.status === 'completed' && progress.best_model && (
        <motion.div
          className={styles.champion}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className={styles.championGlow} />
          <div className={styles.championContent}>
            <div className={styles.championLeft}>
              <div className={styles.trophyWrap}>
                <Trophy className={styles.trophyIcon} />
              </div>
              <div>
                <span className={styles.championLabel}>Champion Model</span>
                <span className={styles.championName}>{progress.best_model}</span>
              </div>
            </div>
            <div className={styles.championMetrics}>
              {getMetricDisplay(progress.best_metrics, taskType).slice(0, 4).map(m => (
                <div key={m.label} className={styles.championMetric}>
                  <span className={styles.championMetricVal}>{m.value}</span>
                  <span className={styles.championMetricLbl}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary Stats */}
      {progress.status === 'completed' && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statVal}>{successful.length}</span>
            <span className={styles.statLabel}>Trained</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statVal}>{progress.elapsed?.toFixed(1)}s</span>
            <span className={styles.statLabel}>Total Time</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statVal}>{avgTime}s</span>
            <span className={styles.statLabel}>Avg/Model</span>
          </div>
          {failed.length > 0 && (
            <div className={`${styles.statCard} ${styles.statCardErr}`}>
              <span className={styles.statVal}>{failed.length}</span>
              <span className={styles.statLabel}>Failed</span>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {successful.length > 0 && (
        <div className={styles.leaderboard}>
          <div className={styles.lbHeader}>
            <BarChart3 className={styles.lbHeaderIcon} />
            <span className={styles.lbHeaderTitle}>Leaderboard</span>
            <span className={styles.lbHeaderCount}>{successful.length}</span>
          </div>
          <div className={styles.lbList}>
            {successful.map((r, i) => {
              const isBest = progress.best_model === r.name;
              const isExpanded = expandedModels.has(r.name);
              const allMetrics = getMetricDisplay(r.metrics, taskType);
              return (
                <motion.div
                  key={r.name}
                  className={`${styles.lbRow} ${isBest ? styles.lbRowBest : ''}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className={styles.lbMain} onClick={() => onToggleExpand(r.name)}>
                    <div className={styles.lbRank}>{getRankIcon(i)}</div>
                    <div className={styles.lbInfo}>
                      <span className={styles.lbName}>
                        {r.name}
                        {isBest && <span className={styles.bestBadge}>BEST</span>}
                      </span>
                      <span className={styles.lbTime}>
                        <Timer className={styles.lbTimeIcon} /> {r.training_time?.toFixed(2)}s
                      </span>
                    </div>
                    <div className={styles.lbMetrics}>
                      {allMetrics.slice(0, 3).map(m => (
                        <div key={m.label} className={styles.lbMetricPill}>
                          <span className={styles.lbPillLabel}>{m.label}</span>
                          <span className={styles.lbPillVal}>{m.value}</span>
                        </div>
                      ))}
                    </div>
                    <button className={styles.lbExpand} aria-label="Toggle details">
                      {isExpanded ? <ChevronUp className={styles.lbExpandIcon} /> : <ChevronDown className={styles.lbExpandIcon} />}
                    </button>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        className={styles.lbDetails}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <div className={styles.metricsGrid}>
                          {allMetrics.map(m => (
                            <div key={m.label} className={styles.detailMetric}>
                              <span className={styles.detailMetricVal}>{m.value}</span>
                              <span className={styles.detailMetricLbl}>{m.label}</span>
                            </div>
                          ))}
                        </div>

                        {r.feature_importance && r.feature_importance.length > 0 && (
                          <div className={styles.fiSection}>
                            <h4 className={styles.sectionTitle}>Feature Importance</h4>
                            <div className={styles.fiList}>
                              {r.feature_importance.slice(0, 8).map((fi, fiIdx) => (
                                <div key={fi.feature} className={styles.fiRow}>
                                  <span className={styles.fiRank}>{fiIdx + 1}</span>
                                  <span className={styles.fiName}>{fi.feature}</span>
                                  <div className={styles.fiBarWrap}>
                                    <motion.div
                                      className={styles.fiBar}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${fi.importance * 100}%` }}
                                      transition={{ delay: fiIdx * 0.05, duration: 0.5 }}
                                    />
                                  </div>
                                  <span className={styles.fiVal}>{(fi.importance * 100).toFixed(1)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {r.best_params && Object.keys(r.best_params).length > 0 && (
                          <div className={styles.paramsSection}>
                            <h4 className={styles.sectionTitle}>Hyperparameters</h4>
                            <div className={styles.paramsGrid}>
                              {Object.entries(r.best_params).map(([k, v]) => (
                                <div key={k} className={styles.paramItem}>
                                  <span className={styles.paramKey}>{k}</span>
                                  <span className={styles.paramVal}>{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Failed */}
      {failed.length > 0 && (
        <div className={styles.failedSection}>
          <div className={styles.failedHeader}>
            <XCircle className={styles.failedIcon} />
            <span>Failed ({failed.length})</span>
          </div>
          <div className={styles.failedList}>
            {failed.map(r => (
              <div key={r.name} className={styles.failedItem}>
                <span className={styles.failedName}>{r.name}</span>
                <span className={styles.failedError}>{r.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {progress.status === 'running' || progress.status === 'queued' || progress.status === 'preprocessing' || progress.status === 'training' ? null : (
        successful.length === 0 && failed.length === 0 && (
          <div className={styles.emptyState}>
            <Sparkles className={styles.emptyIcon} />
            <p className={styles.emptyText}>
              {progress.status === 'completed'
                ? 'No models completed successfully'
                : 'Configure your pipeline and start training'
              }
            </p>
          </div>
        )
      )}
    </motion.div>
  );
}
