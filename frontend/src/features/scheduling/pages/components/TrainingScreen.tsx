import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { EngineProgress } from '../../../../services/engine.service';
import styles from './TrainingScreen.module.css';

const PIPELINE = [
  { id: 'queued', label: 'Queued' },
  { id: 'preprocessing', label: 'Preprocessing' },
  { id: 'training', label: 'Training' },
  { id: 'completed', label: 'Completed' },
] as const;

interface Props {
  progress: EngineProgress | null;
  isRunning: boolean;
}

export function TrainingScreen({ progress, isRunning }: Props) {
  const status = progress?.status ?? 'queued';
  const done = status === 'completed';
  const failed = status === 'failed' || status === 'cancelled';
  const stepIndex = PIPELINE.findIndex(s => s.id === status);
  const percent = progress?.total ? Math.round(((progress.current || 0) / progress.total) * 100) : 0;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>
          {failed ? 'Training failed' : done ? 'Training complete' : 'Training in progress'}
        </span>
        {!done && !failed && <span className={styles.elapsed}>{formatElapsed(progress?.elapsed)}</span>}
      </div>

      {isRunning || status === 'queued' || status === 'preprocessing' || status === 'training' ? (
        <>
          <div className={styles.steps}>
            {PIPELINE.map((s, i) => {
              const isCurrent = status === s.id;
              const isPast = done || i < stepIndex || (status === 'preprocessing' && s.id === 'queued');
              return (
                <div key={s.id} className={`${styles.step} ${isCurrent ? styles.active : ''} ${isPast ? styles.past : ''}`}>
                  {isCurrent ? <Loader2 size={14} className={styles.spin} /> : isPast ? <CheckCircle2 size={14} /> : <span className={styles.dot} />}
                  <span>{s.label}</span>
                </div>
              );
            })}
          </div>

          <div className={styles.modelLine}>
            {progress?.current_model && (
              <span className={styles.model}>
                <Loader2 size={13} className={styles.spin} />
                Training <b>{progress.current_model}</b>
              </span>
            )}
            {progress?.message && <span className={styles.message}>{progress.message}</span>}
          </div>

          <div className={styles.bar}>
            <div className={styles.barFill} style={{ width: `${percent}%` }} />
          </div>
          <div className={styles.barInfo}>
            <span>{percent}%</span>
            <span>{progress?.current ?? 0} / {progress?.total ?? '—'} models</span>
          </div>
        </>
      ) : null}

      {failed && progress?.error && (
        <div className={styles.errorBox}>
          <XCircle size={15} />
          <span>{progress.error}</span>
        </div>
      )}
    </div>
  );
}

function formatElapsed(sec?: number): string {
  if (sec == null) return '';
  if (sec < 60) return `${Math.floor(sec)}s`;
  return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`;
}
