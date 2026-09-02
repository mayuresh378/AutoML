import { motion } from 'framer-motion';
import { Target, Crosshair, Gauge, Fingerprint, ShieldCheck } from 'lucide-react';
import styles from './ModelHealth.module.css';

interface ModelHealthProps {
  logs: { model: string; prediction: string; confidence: number; latency_ms: number; time: string }[];
}

const METRICS = [
  { label: 'Accuracy', value: 0.9647, color: '#3b82f6', icon: Target },
  { label: 'Precision', value: 0.9523, color: '#8b5cf6', icon: Crosshair },
  { label: 'Recall', value: 0.9412, color: '#10b981', icon: Gauge },
  { label: 'F1 Score', value: 0.9467, color: '#f59e0b', icon: Fingerprint },
  { label: 'ROC AUC', value: 0.9891, color: '#06b6d4', icon: ShieldCheck },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

export function ModelHealth({ logs }: ModelHealthProps) {
  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.7 }}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>Model Health Summary</h3>
      </div>
      <div className={styles.body}>
        <motion.div className={styles.metricsGrid} variants={container} initial="hidden" animate="show">
          {METRICS.map((m) => (
            <motion.div key={m.label} className={styles.metricItem} variants={item}>
              <div className={styles.metricTop}>
                <div className={styles.metricInfo}>
                  <m.icon size={16} style={{ color: m.color }} />
                  <span className={styles.metricLabel}>{m.label}</span>
                </div>
                <span className={styles.metricValue} style={{ color: m.color }}>
                  {(m.value * 100).toFixed(1)}%
                </span>
              </div>
              <div className={styles.progressTrack}>
                <motion.div
                  className={styles.progressFill}
                  style={{ background: m.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${m.value * 100}%` }}
                  transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
