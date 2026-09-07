import { Play, Loader2, Cpu, Zap } from 'lucide-react';
import styles from './EngineHero.module.css';

interface Props {
  isRunning: boolean;
  canRun: boolean;
  onRun: () => void;
  algorithmCount: number;
  mode?: string;
}

export function EngineHero({ isRunning, canRun, onRun, algorithmCount, mode = 'auto' }: Props) {
  return (
    <div className={styles.hero}>
      <div className={styles.left}>
        <div className={styles.badge}>
          <Zap size={12} />
          AutoML Engine
        </div>
        <h1 className={styles.title}>Build, train &amp; compare ML models</h1>
        <p className={styles.subtitle}>
          Automatically preprocess your data, train multiple models, compare results and deploy the best one.
        </p>
      </div>
      <div className={styles.right}>
        <button className={styles.runBtn} onClick={onRun} disabled={isRunning || !canRun}>
          {isRunning ? <Loader2 size={16} className={styles.spin} /> : <Play size={16} />}
          {isRunning ? 'Training...' : 'Run AutoML'}
        </button>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <Zap size={13} />
            <div>
              <span className={styles.statVal}>{mode === 'advanced' ? 'Advanced' : 'Auto'}</span>
              <span className={styles.statLabel}>Mode</span>
            </div>
          </div>
          <div className={styles.stat}>
            <Cpu size={13} />
            <div>
              <span className={styles.statVal}>{algorithmCount}</span>
              <span className={styles.statLabel}>Models</span>
            </div>
          </div>
          <div className={styles.stat}>
            <Zap size={13} />
            <div>
              <span className={styles.statVal}>Ready</span>
              <span className={styles.statLabel}>CPU</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
