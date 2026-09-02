import styles from './EngineStepper.module.css';

interface Step {
  id: string;
  label: string;
}

interface Props {
  steps: readonly Step[];
  active: string;
  onNavigate: (id: string) => void;
}

export function EngineStepper({ steps, active, onNavigate }: Props) {
  const activeIdx = steps.findIndex(s => s.id === active);
  return (
    <nav className={styles.nav}>
      {steps.map((s, i) => {
        const state = i < activeIdx ? 'done' : i === activeIdx ? 'active' : 'todo';
        return (
          <button
            key={s.id}
            className={`${styles.step} ${styles[state]}`}
            onClick={() => onNavigate(s.id)}
          >
            <span className={styles.num}>{state === 'done' ? '✓' : i + 1}</span>
            <span className={styles.label}>{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
