import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  History, Search, RefreshCw, Trash2, CheckCircle, Clock,
  AlertTriangle, Eye, ArrowUpDown, ChevronRight, X, Play,
  Cpu, FileText, Database, ShieldAlert, Check
} from 'lucide-react';
import {
  trainingService,
  TrainingRunSummary,
  TrainingRunDetail,
  TaskType,
} from '../../../services/training.service';
import { ErrorDiagnosticsPanel } from './ErrorDiagnosticsPanel';
import styles from './TrainingHistoryDashboard.module.css';

interface TrainingHistoryDashboardProps {
  onSelectRunForRetry?: (run: TrainingRunDetail) => void;
}

export function TrainingHistoryDashboard({ onSelectRunForRetry }: TrainingHistoryDashboardProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Fetch History Runs
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['trainingHistory', statusFilter, taskFilter, searchTerm],
    queryFn: () =>
      trainingService.history({
        status: statusFilter === 'all' ? undefined : statusFilter,
        task_type: taskFilter === 'all' ? undefined : taskFilter,
        search: searchTerm.trim() || undefined,
        limit: 50,
      }),
    refetchInterval: (query) => {
      // Auto-poll every 5s if any run is currently running or queued
      const runs = query.state.data?.runs || [];
      const hasActive = runs.some((r) => r.status === 'running' || r.status === 'queued');
      return hasActive ? 5000 : false;
    },
  });

  const runs: TrainingRunSummary[] = data?.runs || [];
  const totalRuns = data?.total || 0;

  // Fetch Selected Run Detail
  const { data: selectedRun, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['trainingRunDetail', selectedRunId],
    queryFn: () => (selectedRunId ? trainingService.getRun(selectedRunId) : null),
    enabled: !!selectedRunId,
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => trainingService.deleteRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingHistory'] });
      if (selectedRunId) setSelectedRunId(null);
    },
  });

  // Retry Mutation
  const retryMutation = useMutation({
    mutationFn: (id: string) => trainingService.retryRun(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['trainingHistory'] });
      // If parent handler provided, call it
      if (selectedRun && onSelectRunForRetry) {
        onSelectRunForRetry(selectedRun);
      }
    },
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const completed = runs.filter((r) => r.status === 'completed').length;
    const failed = runs.filter((r) => r.status === 'failed').length;
    const active = runs.filter((r) => r.status === 'running' || r.status === 'queued').length;
    const rate = totalRuns > 0 ? Math.round((completed / totalRuns) * 100) : 0;
    return { completed, failed, active, rate };
  }, [runs, totalRuns]);

  const formatScore = (val: number | undefined, rankMetric: string = 'accuracy') => {
    if (val == null) return '—';
    return rankMetric === 'r2' ? val.toFixed(4) : `${(val * 100).toFixed(1)}%`;
  };

  const formatDuration = (sec: number | undefined) => {
    if (sec == null) return '—';
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className={`${styles.badge} ${styles.badgeCompleted}`}><Check className={styles.badgeIcon} /> Completed</span>;
      case 'running':
        return <span className={`${styles.badge} ${styles.badgeRunning}`}><RefreshCw className={`${styles.badgeIcon} ${styles.spin}`} /> Running</span>;
      case 'queued':
        return <span className={`${styles.badge} ${styles.badgeQueued}`}><Clock className={styles.badgeIcon} /> Queued</span>;
      case 'failed':
        return <span className={`${styles.badge} ${styles.badgeFailed}`}><AlertTriangle className={styles.badgeIcon} /> Failed</span>;
      case 'cancelled':
        return <span className={`${styles.badge} ${styles.badgeCancelled}`}><X className={styles.badgeIcon} /> Cancelled</span>;
      default:
        return <span className={styles.badge}>{status}</span>;
    }
  };

  return (
    <div className={styles.dashboard}>
      {/* Header & Stats Bar */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Training Runs</span>
          <strong className={styles.statValue}>{totalRuns}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Completed Models</span>
          <strong className={styles.statValue}>{stats.completed}</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Success Rate</span>
          <strong className={styles.statValue}>{stats.rate}%</strong>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Active Runs</span>
          <strong className={`${styles.statValue} ${stats.active > 0 ? styles.activeText : ''}`}>
            {stats.active}
          </strong>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className={styles.controlsBar}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by dataset or model name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.filtersWrapper}>
          {/* Status Filter */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Status:</span>
            <select
              className={styles.filterSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="running">Running</option>
              <option value="queued">Queued</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Task Filter */}
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Task:</span>
            <select
              className={styles.filterSelect}
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
            >
              <option value="all">All Tasks</option>
              <option value="classification">Classification</option>
              <option value="regression">Regression</option>
            </select>
          </div>

          <button
            className={styles.refreshBtn}
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh history"
          >
            <RefreshCw className={`${styles.refreshIcon} ${isFetching ? styles.spin : ''}`} />
          </button>
        </div>
      </div>

      {/* Table of Training Runs */}
      <div className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <RefreshCw className={`${styles.spin} ${styles.loadIcon}`} />
            <span>Loading training history...</span>
          </div>
        ) : runs.length === 0 ? (
          <div className={styles.emptyState}>
            <History className={styles.emptyIcon} />
            <div className={styles.emptyTitle}>No Training Runs Found</div>
            <p className={styles.emptyDesc}>
              {searchTerm || statusFilter !== 'all' || taskFilter !== 'all'
                ? 'Try adjusting your filters or search keywords.'
                : 'Run an experiment using the Training Workflow to record persistent training runs.'}
            </p>
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Experiment Name</th>
                  <th>Dataset / Target</th>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Best Model & Score</th>
                  <th>Duration</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className={selectedRunId === run.id ? styles.selectedRow : ''}>
                    <td className={styles.nameCell}>
                      <span className={styles.runName}>{run.name}</span>
                      <span className={styles.runId}>ID: {run.id.slice(0, 8)}...</span>
                    </td>
                    <td>
                      <div className={styles.datasetInfo}>
                        <strong>{run.dataset_name}</strong>
                        <span className={styles.targetCol}>→ {run.target_column}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.taskBadge} ${run.task_type === 'classification' ? styles.clfBadge : styles.regBadge}`}>
                        {run.task_type}
                      </span>
                    </td>
                    <td>{getStatusBadge(run.status)}</td>
                    <td>
                      {run.best_model_name ? (
                        <div className={styles.bestModelCell}>
                          <span className={styles.modelName}>{run.best_model_name}</span>
                          <span className={styles.scoreVal}>
                            {formatScore(run.best_score, run.rank_metric)} ({run.rank_metric || 'score'})
                          </span>
                        </div>
                      ) : (
                        <span className={styles.mutedText}>—</span>
                      )}
                    </td>
                    <td className={styles.durationCell}>{formatDuration(run.duration_seconds)}</td>
                    <td className={styles.dateCell}>
                      {run.created_at ? new Date(run.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className={styles.actionsCell}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => setSelectedRunId(run.id)}
                        title="View Run Details"
                      >
                        <Eye className={styles.actionIcon} />
                      </button>
                      {run.status === 'failed' && (
                        <button
                          className={`${styles.actionBtn} ${styles.retryAction}`}
                          onClick={() => retryMutation.mutate(run.id)}
                          disabled={retryMutation.isPending}
                          title="Retry Run"
                        >
                          <RefreshCw className={`${styles.actionIcon} ${retryMutation.isPending ? styles.spin : ''}`} />
                        </button>
                      )}
                      <button
                        className={`${styles.actionBtn} ${styles.deleteAction}`}
                        onClick={() => {
                          if (confirm(`Delete training run record for "${run.name}"?`)) {
                            deleteMutation.mutate(run.id);
                          }
                        }}
                        title="Delete Run Record"
                      >
                        <Trash2 className={styles.actionIcon} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Run Detail Modal / Drawer */}
      {selectedRunId && (
        <div className={styles.modalOverlay} onClick={() => setSelectedRunId(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>
                  {selectedRun?.name || 'Training Run Details'}
                </h3>
                <span className={styles.modalSubtitle}>Run ID: {selectedRunId}</span>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedRunId(null)}
              >
                <X className={styles.closeIcon} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {isLoadingDetail ? (
                <div className={styles.loadingDetail}>
                  <RefreshCw className={`${styles.spin} ${styles.loadIcon}`} />
                  <span>Loading run diagnostics...</span>
                </div>
              ) : selectedRun ? (
                <div className={styles.detailContainer}>
                  {/* Status Banner */}
                  <div className={styles.detailStatusRow}>
                    <div className={styles.statusLabelRow}>
                      <span className={styles.detailLabel}>Status:</span>
                      {getStatusBadge(selectedRun.status)}
                    </div>
                    {selectedRun.duration_seconds && (
                      <span className={styles.detailDuration}>
                        Duration: {formatDuration(selectedRun.duration_seconds)}
                      </span>
                    )}
                  </div>

                  {/* Error Diagnostic Panel for Failed Runs */}
                  {selectedRun.status === 'failed' && (
                    <ErrorDiagnosticsPanel
                      errorTitle={`Run Failed: ${selectedRun.error_type || 'Execution Error'}`}
                      errorMessage={selectedRun.message}
                      errorDetails={selectedRun.error_details}
                      onRetry={() => retryMutation.mutate(selectedRun.id)}
                      isRetrying={retryMutation.isPending}
                    />
                  )}

                  {/* Metadata Config Grid */}
                  <div className={styles.metaGrid}>
                    <div className={styles.metaCard}>
                      <span className={styles.metaLabel}>Dataset</span>
                      <strong className={styles.metaVal}>{selectedRun.dataset_name}</strong>
                    </div>
                    <div className={styles.metaCard}>
                      <span className={styles.metaLabel}>Target Column</span>
                      <strong className={styles.metaVal}>{selectedRun.target_column}</strong>
                    </div>
                    <div className={styles.metaCard}>
                      <span className={styles.metaLabel}>Task Type</span>
                      <strong className={styles.metaVal}>{selectedRun.task_type}</strong>
                    </div>
                    <div className={styles.metaCard}>
                      <span className={styles.metaLabel}>CV Folds</span>
                      <strong className={styles.metaVal}>
                        {selectedRun.hyperparameters_config?.cv_folds ?? 5}-Fold
                      </strong>
                    </div>
                  </div>

                  {/* Best Model & Evaluation Metrics */}
                  {selectedRun.evaluation_metrics && Object.keys(selectedRun.evaluation_metrics).length > 0 && (
                    <div className={styles.metricsSection}>
                      <h4 className={styles.sectionHeader}>Evaluation Metrics</h4>
                      <div className={styles.metricsGrid}>
                        {Object.entries(selectedRun.evaluation_metrics).map(([key, val]) => (
                          <div key={key} className={styles.metricCard}>
                            <span className={styles.metricKey}>{key.toUpperCase()}</span>
                            <span className={styles.metricVal}>
                              {typeof val === 'number'
                                ? key === 'accuracy' || key === 'f1' || key === 'precision' || key === 'recall'
                                  ? `${(val * 100).toFixed(1)}%`
                                  : val.toFixed(4)
                                : String(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comparative Model Leaderboard */}
                  {selectedRun.all_results && selectedRun.all_results.length > 0 && (
                    <div className={styles.leaderboardSection}>
                      <h4 className={styles.sectionHeader}>Model Comparison Leaderboard</h4>
                      <div className={styles.tableResponsive}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Algorithm</th>
                              <th>Score</th>
                              <th>CV Score</th>
                              <th>Time</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedRun.all_results.map((r, i) => (
                              <tr key={i}>
                                <td>
                                  <strong>{r.name}</strong>
                                  {r.name === selectedRun.best_model_name && (
                                    <span className={styles.bestBadge}>Best</span>
                                  )}
                                </td>
                                <td>
                                  {r.metrics
                                    ? formatScore(
                                        r.metrics[selectedRun.rank_metric || 'accuracy'],
                                        selectedRun.rank_metric
                                      )
                                    : '—'}
                                </td>
                                <td>{r.cv_score != null ? `${(r.cv_score * 100).toFixed(1)}%` : '—'}</td>
                                <td>{r.training_time != null ? `${r.training_time.toFixed(2)}s` : '—'}</td>
                                <td>
                                  {r.status === 'success' ? (
                                    <span className={styles.successText}>Success</span>
                                  ) : (
                                    <span className={styles.errorText}>{r.error || 'Failed'}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Diagnostics Logs Viewer */}
                  {selectedRun.logs && selectedRun.logs.length > 0 && (
                    <div className={styles.logsSection}>
                      <h4 className={styles.sectionHeader}>Execution Logs</h4>
                      <div className={styles.logsBox}>
                        {selectedRun.logs.map((l, idx) => (
                          <div key={idx} className={styles.logLine}>
                            <span className={styles.logTime}>[{new Date(l.time * 1000).toLocaleTimeString()}]</span>
                            <span className={styles.logMsg}>{l.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.emptyDesc}>Run not found.</div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.secondaryBtn}
                onClick={() => setSelectedRunId(null)}
              >
                Close
              </button>
              {selectedRun && (
                <button
                  className={styles.primaryBtn}
                  onClick={() => retryMutation.mutate(selectedRun.id)}
                  disabled={retryMutation.isPending}
                >
                  <RefreshCw className={`${styles.actionIcon} ${retryMutation.isPending ? styles.spin : ''}`} />
                  {retryMutation.isPending ? 'Retrying Run...' : 'Retry Run'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
