import { Dices, Shuffle } from 'lucide-react';
import { SectionCard } from './SectionCard';
import styles from './ValidationStep.module.css';

const METHODS = [
  { id: 'train_test_split', label: 'Train / Test Split', desc: 'Single split' },
  { id: 'cross_validation', label: 'Cross Validation', desc: 'K-Fold CV' },
  { id: 'stratified', label: 'Stratified K-Fold', desc: 'Balanced folds' },
  { id: 'leave_one_out', label: 'Leave One Out', desc: 'Max folds' },
] as const;

interface Props {
  method: string;
  onMethodChange: (m: string) => void;
  cvFolds: number;
  onCvFoldsChange: (n: number) => void;
  testSize: number;
  onTestSizeChange: (n: number) => void;
  shuffle: boolean;
  onShuffleChange: (b: boolean) => void;
  randomSeed: number;
  onRandomSeedChange: (n: number) => void;
}

export function ValidationStep({
  method, onMethodChange, cvFolds, onCvFoldsChange, testSize, onTestSizeChange,
  shuffle, onShuffleChange, randomSeed, onRandomSeedChange,
}: Props) {
  return (
    <SectionCard number={5} title="Validation" subtitle="Choose how the model performance is validated">
      <div className={styles.methods}>
        {METHODS.map(m => (
          <button
            key={m.id}
            className={`${styles.method} ${method === m.id ? styles.on : ''}`}
            onClick={() => onMethodChange(m.id)}
          >
            <span className={styles.radio}>{method === m.id && <span className={styles.radioDot} />}</span>
            <div>
              <span className={styles.methodLabel}>{m.label}</span>
              <span className={styles.methodDesc}>{m.desc}</span>
            </div>
          </button>
        ))}
      </div>

      <div className={styles.row}>
        {method === 'cross_validation' || method === 'stratified' ? (
          <div className={styles.field}>
            <span className={styles.label}><Dices size={13} /> CV Folds</span>
            <input
              className={styles.input}
              type="number"
              value={cvFolds}
              min={2}
              max={10}
              onChange={(e) => onCvFoldsChange(Math.max(2, Math.min(10, Number(e.target.value))))}
            />
          </div>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Test Size</span>
            <div className={styles.inputWrap}>
              <input
                className={styles.input}
                type="number"
                value={testSize}
                min={5}
                max={50}
                onChange={(e) => onTestSizeChange(Math.max(5, Math.min(50, Number(e.target.value))))}
              />
              <span className={styles.suffix}>%</span>
            </div>
          </div>
        )}

        <div className={styles.field}>
          <span className={styles.label}><Shuffle size={13} /> Shuffle</span>
          <button
            className={`${styles.toggle} ${shuffle ? styles.toggleOn : ''}`}
            onClick={() => onShuffleChange(!shuffle)}
            aria-pressed={shuffle}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Random State</span>
          <input
            className={styles.input}
            type="number"
            value={randomSeed}
            onChange={(e) => onRandomSeedChange(Number(e.target.value))}
          />
        </div>
      </div>
    </SectionCard>
  );
}
