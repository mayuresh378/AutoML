import { useEffect, useRef, useState, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Cpu, Clock, CheckCircle, AlertTriangle, Loader2,
  ChevronDown, ChevronRight, Terminal, Zap,
} from 'lucide-react';
import type { TrainingProgress } from '../../../services/training.service';
import styles from './LiveTrainingProgress.module.css';

interface LiveTrainingProgressProps {
  progress: TrainingProgress;
  onCancel?: () => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export const LiveTrainingProgress = memo(function LiveTrainingProgress({ progress, onCancel }: LiveTrainingProgressProps) {
  const [logsExpanded, setLogsExpanded] = useState(true);
  const logsRef = useRef<HTMLDivElement>(null);
  const elapsed = progress.start_time ? Date.now() / 1000 - progress.start_time : 0;
  const eta = progress.progress > 0 ? (elapsed / progress.progress) * (100 - progress.progress) : 0;

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [progress.logs?.length]);

  const isComplete = progress.status === 'completed';
  const isFailed = progress.status === 'failed';
  const isRunning = progress.status === 'running';

  return (
    <div className={styles.container}>
      {/* Progress Bar */}
      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <div className={styles.progressTitle}>
            {isComplete ? (
              <CheckCircle className={`${styles.progressIcon} ${styles.iconSuccess}`} />
            ) : isFailed ? (
              <AlertTriangle className={`${styles.progressIcon} ${styles.iconError}`} />
            ) : (
              <Loader2 className={`${styles.progressIcon} ${styles.iconSpin}`} />
            )}
            <span className={styles.progressMessage}>{progress.message}</span>
          </div>
          <span className={styles.progressPct}>{progress.progress}%</span>
        </div>
        <div className={styles.progressBarBg}>
          <motion.div
            className={`${styles.progressBarFill} ${isComplete ? styles.barSuccess : isFailed ? styles.barError : ''}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress.progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        {progress.current_model && isRunning && (
          <div className={styles.modelProgress}>
            Training: <strong>{progress.current_model}</strong>
            {progress.model_index != null && progress.total_models != null && (
              <span className={styles.modelCount}> ({progress.model_index}/{progress.total_models})</span>
            )}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statChip}>
          <Cpu className={styles.statIcon} />
          <span>CPU: {progress.cpu_percent?.toFixed(0) || 0}%</span>
        </div>
        <div className={styles.statChip}>
          <Clock className={styles.statIcon} />
          <span>Elapsed: {formatDuration(elapsed)}</span>
        </div>
        {eta > 0 && !isComplete && (
          <div className={styles.statChip}>
            <Zap className={styles.statIcon} />
            <span>ETA: ~{formatDuration(eta)}</span>
          </div>
        )}
        {progress.completed_models != null && progress.total_models != null && (
          <div className={styles.statChip}>
            <Activity className={styles.statIcon} />
            <span>Models: {progress.completed_models}/{progress.total_models}</span>
          </div>
        )}
        {isComplete && progress.elapsed != null && (
          <div className={styles.statChip}>
            <Clock className={styles.statIcon} />
            <span>Total: {formatDuration(progress.elapsed)}</span>
          </div>
        )}
      </div>

      {/* Best Model Badge */}
      {isComplete && progress.best_model && (
        <motion.div
          className={styles.bestModel}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <CheckCircle className={styles.bestIcon} />
          <div>
            <div className={styles.bestLabel}>Best Model</div>
            <div className={styles.bestName}>{progress.best_model.name}</div>
            <div className={styles.bestMetrics}>
              Accuracy: {progress.best_model.metrics?.accuracy != null ? (progress.best_model.metrics.accuracy * 100).toFixed(1) + '%' : '—'} · CV: {progress.best_model.cv_score != null ? (progress.best_model.cv_score * 100).toFixed(1) + '%' : '—'}
            </div>
          </div>
        </motion.div>
      )}

      {/* Cancel Button */}
      {isRunning && onCancel && (
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel Training</button>
      )}

      {/* Logs */}
      <div className={styles.logsSection}>
        <button className={styles.logsToggle} onClick={() => setLogsExpanded(!logsExpanded)}>
          {logsExpanded ? <ChevronDown className={styles.logsToggleIcon} /> : <ChevronRight className={styles.logsToggleIcon} />}
          <Terminal className={styles.logsIcon} />
          Training Logs ({progress.logs?.length || 0})
        </button>
        {logsExpanded && (
          <div className={styles.logsContainer} ref={logsRef}>
            {(progress.logs || []).map((log, i) => (
              <div key={i} className={styles.logLine}>
                <span className={styles.logTime}>[{log.time.toFixed(1)}s]</span>
                <span className={styles.logMsg}>{log.message}</span>
              </div>
            ))}
            {(!progress.logs || progress.logs.length === 0) && (
              <div className={styles.logEmpty}>Waiting for logs...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
