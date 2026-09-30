import { memo } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { EvaluationMetrics, TaskType } from '../services/evaluation.service';
import { formatMetric, metricBand, metricsForTask, type MetricMeta } from '../utils/metrics';
import styles from './MetricGrid.module.css';

interface Props {
  metrics: EvaluationMetrics;
  taskType: TaskType;
  /** Metrics the server could not compute, so tiles can say why they are blank. */
  unavailable: string[];
}

export const MetricGrid = memo(function MetricGrid({ metrics, taskType, unavailable }: Props) {
  const defs = metricsForTask(taskType);
  const available = defs.filter((d) => metrics[d.key] != null && Number.isFinite(metrics[d.key] as number));
  const missing = defs.filter((d) => !(d.key in metrics) || metrics[d.key] == null);

  return (
    <div className={styles.grid}>
      {available.map((def) => {
        const value = metrics[def.key] as number;
        const band = metricBand(def, value);
        return (
          <div key={def.key} className={styles.tile} data-severity={band.severity}>
            <div className={styles.tileHead}>
              <span className={styles.label}>{def.label}</span>
              <span className={styles.direction} title={def.direction === 'higher' ? 'Higher is better' : 'Lower is better'}>
                {def.direction === 'higher' ? <ArrowUp /> : <ArrowDown />}
              </span>
            </div>
            <div className={styles.value}>{formatMetric(value, def.digits)}</div>
            <div className={styles.tileFoot}>
              <span className={styles.band}>{band.label}</span>
              <span className={styles.hint}>{def.hint}</span>
            </div>
          </div>
        );
      })}

      {missing.map((def) => (
        <div key={def.key} className={styles.tile} data-empty="true">
          <div className={styles.tileHead}>
            <span className={styles.label}>{def.label}</span>
            <span className={styles.direction} data-off="true">
              <Minus />
            </span>
          </div>
          <div className={styles.value}>N/A</div>
          <div className={styles.tileFoot}>
            <span className={styles.band}>unavailable</span>
            <span className={styles.hint}>{reasonFor(unavailable, def) ?? `Not reported for this ${taskType} model.`}</span>
          </div>
        </div>
      ))}
    </div>
  );
});

/** Find the server's own explanation for a metric it could not compute. */
function reasonFor(unavailable: string[], def: MetricMeta): string | undefined {
  return unavailable.find((u: string) => {
    const text = u.toLowerCase();
    return def.reasonKeys.some((k: string) => text.includes(k));
  });
}
