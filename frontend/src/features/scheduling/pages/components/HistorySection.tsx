import { History, RefreshCw, Trash2, Trophy, Clock, Database, Play } from 'lucide-react';
import type { EngineRunSummary } from '../../../../services/engine.service';
import { SectionCard } from './SectionCard';
import styles from './HistorySection.module.css';

interface Props {
  runs: EngineRunSummary[];
  total: number;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (run: EngineRunSummary) => void;
  onRefresh: () => void;
  onDelete: (run: EngineRunSummary) => void;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function fmtScore(run: EngineRunSummary): string {
  const v = run.best_score;
  if (v == null || !Number.isFinite(v)) return '—';
  const metric = (run.rank_metric || '').toLowerCase();
  if (metric === 'accuracy') return `${(v * 100).toFixed(1)}%`;
  if (metric === 'rmse' || metric === 'mae' || metric === 'mape') return v.toFixed(4);
  return v.toFixed(4);
}

function metricLabel(metric: string | null | undefined): string {
  if (!metric) return 'score';
  if (metric === 'r2' || metric === 'r2_score') return 'R²';
  if (metric === 'accuracy') return 'Acc';
  if (metric === 'f1' || metric === 'f1_score') return 'F1';
  if (metric === 'silhouette' || metric === 'silhouette_score') return 'Sil';
  return metric.toUpperCase();
}

function statusClass(status: string): string {
  if (status === 'completed') return styles.statusDone;
  if (status === 'failed') return styles.statusFailed;
  if (status === 'running' || status === 'queued') return styles.statusRunning;
  return '';
}

export function HistorySection({
  runs, total, loading, error, selectedId, onSelect, onRefresh, onDelete,
}: Props) {
  const action = (
    <button type="button" className={styles.refreshBtn} onClick={onRefresh} disabled={loading}>
      <RefreshCw size={13} className={loading ? styles.spin : undefined} />
      Refresh
    </button>
  );

  return (
    <SectionCard
      number={9}
      title="Run History"
      subtitle="Every AutoML run is saved — click a run to reload its full results and report below"
      action={action}
    >
      {loading && runs.length === 0 && (
        <div className={styles.loading}>
          <span className={styles.spinner} />
          <span>Loading past runs...</span>
        </div>
      )}

      {error && !loading && <p className={styles.error}>{error}</p>}

      {!loading && !error && runs.length === 0 && (
        <div className={styles.empty}>
          <History size={22} />
          <p>No runs yet. Launch an AutoML job and it will appear here.</p>
        </div>
      )}

      {runs.length > 0 && (
        <>
          <div className={styles.list}>
            {runs.map((run) => (
              <div
                key={run.id}
                className={`${styles.row} ${selectedId === run.id ? styles.rowActive : ''}`}
              >
                <button type="button" className={styles.rowMain} onClick={() => onSelect(run)}>
                  <div className={styles.rowTop}>
                    <span className={styles.dataset}>
                      <Database size={13} />
                      {run.dataset_name}
                    </span>
                    <span className={`${styles.status} ${statusClass(run.status)}`}>
                      {run.status}
                    </span>
                  </div>

                  <div className={styles.metas}>
                    <span className={styles.meta}>
                      <b>{run.target_column || '—'}</b> target
                    </span>
                    <span className={styles.meta}>{run.task_type}</span>
                    <span className={styles.meta}>
                      {run.best_model_name ? (
                        <><Trophy size={12} /> {run.best_model_name}</>
                      ) : (
                        '—'
                      )}
                    </span>
                    <span className={styles.meta}>
                      {metricLabel(run.rank_metric)}: <b>{fmtScore(run)}</b>
                    </span>
                    <span className={styles.meta}>
                      <Clock size={12} /> {fmtDuration(run.duration_seconds)}
                    </span>
                  </div>

                  <div className={styles.rowBottom}>
                    <span className={styles.date}>{fmtDate(run.created_at)}</span>
                    <span className={styles.viewHint}>
                      <Play size={11} /> View results
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className={styles.deleteBtn}
                  title="Delete this run"
                  onClick={(e) => { e.stopPropagation(); onDelete(run); }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {total > runs.length && (
            <p className={styles.more}>Showing {runs.length} of {total} runs</p>
          )}
        </>
      )}
    </SectionCard>
  );
}
