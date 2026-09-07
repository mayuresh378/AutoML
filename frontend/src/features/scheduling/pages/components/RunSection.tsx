import { ArrowRight, Play, Rocket } from 'lucide-react';
import { SectionCard } from './SectionCard';
import styles from './RunSection.module.css';

interface Props {
  dataset: string;
  algorithmCount: number;
  taskType: string;
  validationLabel: string;
  canRun: boolean;
  isRunning: boolean;
  onRun: () => void;
  mode?: string;
  hpoBudget?: number;
}

export function RunSection({ dataset, algorithmCount, taskType, validationLabel, canRun, isRunning, onRun, mode = 'auto', hpoBudget = 8 }: Props) {
  return (
    <SectionCard number={8} title="Launch Training" subtitle="Review your configuration and start the AutoML run">
      <div className={styles.summary}>
        <div className={styles.item}>
          <span className={styles.itemLabel}>Dataset</span>
          <span className={styles.itemValue}>{dataset || '—'}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.itemLabel}>Task</span>
          <span className={styles.itemValue}>{taskType.replace(/_/g, ' ')}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.itemLabel}>Algorithms</span>
          <span className={styles.itemValue}>{algorithmCount}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.itemLabel}>Validation</span>
          <span className={styles.itemValue}>{validationLabel}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.itemLabel}>Mode</span>
          <span className={styles.itemValue}>
            {mode === 'advanced' ? `Advanced · ${hpoBudget} HPO` : 'Auto'}
          </span>
        </div>
      </div>

      <div className={styles.cta}>
        <button className={styles.runBtn} disabled={!canRun || isRunning} onClick={onRun}>
          {isRunning ? <span className={styles.spinner} /> : <Play size={15} fill="currentColor" />}
          {isRunning ? 'Training in progress…' : 'Run AutoML'}
          {!isRunning && <ArrowRight size={15} />}
        </button>
        {!canRun && (
          <span className={styles.hint}>Select a dataset{taskType === 'clustering' || taskType === 'time_series' ? '' : ' and target column'} and at least one algorithm.</span>
        )}
      </div>

      <div className={styles.note}>
        <Rocket size={14} />
        <span>
          Models are trained in parallel. You'll get live progress, champion selection and full metric comparisons on completion.
        </span>
      </div>
    </SectionCard>
  );
}
