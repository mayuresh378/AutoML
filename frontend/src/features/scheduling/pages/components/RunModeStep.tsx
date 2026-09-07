import { Zap, FlaskConical, Sparkles } from 'lucide-react';
import { SectionCard } from './SectionCard';
import styles from './RunModeStep.module.css';

interface Props {
  mode: string;
  hpoBudget: number;
  onModeChange: (m: string) => void;
  onHpoBudgetChange: (n: number) => void;
}

export function RunModeStep({ mode, hpoBudget, onModeChange, onHpoBudgetChange }: Props) {
  return (
    <SectionCard number={4} title="Run Mode" subtitle="Choose how deep AutoML goes on your dataset">
      <div className={styles.modes}>
        <button
          className={`${styles.mode} ${mode === 'auto' ? styles.on : ''}`}
          onClick={() => onModeChange('auto')}
          type="button"
        >
          <span className={styles.modeIcon}><Zap size={17} /></span>
          <div className={styles.modeBody}>
            <span className={styles.modeName}>Auto Mode</span>
            <span className={styles.modeDesc}>
              Dataset intelligence picks the target & task, recommends strong default models, trains
              baselines with leakage-safe preprocessing and selects a champion. Fast and transparent.
            </span>
          </div>
          <span className={styles.radio}>{mode === 'auto' && <span className={styles.radioDot} />}</span>
        </button>

        <button
          className={`${styles.mode} ${mode === 'advanced' ? styles.on : ''}`}
          onClick={() => onModeChange('advanced')}
          type="button"
        >
          <span className={styles.modeIcon}><FlaskConical size={17} /></span>
          <div className={styles.modeBody}>
            <span className={styles.modeName}>Advanced Mode</span>
            <span className={styles.modeDesc}>
              Everything Auto does, plus budgeted hyperparameter search per model (baseline first, then
              grid/random HPO), baseline vs optimized comparison and a full 27-section reproducibility report.
            </span>
          </div>
          <span className={styles.radio}>{mode === 'advanced' && <span className={styles.radioDot} />}</span>
        </button>
      </div>

      {mode === 'advanced' && (
        <div className={styles.budget}>
          <div className={styles.budgetHead}>
            <span className={styles.budgetLabel}><Sparkles size={13} /> HPO Budget</span>
            <span className={styles.budgetVal}>{hpoBudget} evaluations / model</span>
          </div>
          <input
            type="range"
            min={2}
            max={30}
            value={hpoBudget}
            onChange={(e) => onHpoBudgetChange(Number(e.target.value))}
            className={styles.slider}
          />
          <p className={styles.budgetHint}>
            Higher budgets explore more hyperparameter combinations per model — better results, slower runs.
          </p>
        </div>
      )}
    </SectionCard>
  );
}