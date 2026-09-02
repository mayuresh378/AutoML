import { memo } from 'react';
import type { ShapValue } from '../services/explain.service';
import styles from './ShapWaterfall.module.css';

interface Props {
  data: ShapValue[];
  baseValue?: number;
}

export const ShapWaterfall = memo(function ShapWaterfall({ data, baseValue = 0.5 }: Props) {
  if (!data || data.length === 0) return null;

  const top = data.slice(0, 12);
  const maxAbs = Math.max(...top.map((d) => d.abs_value), 0.001);
  let cumulative = baseValue;

  const rows = top.map((d) => {
    const start = cumulative;
    cumulative += d.value;
    return {
      ...d,
      start,
      end: cumulative,
      barLeft: Math.min(start, cumulative),
      barWidth: Math.abs(d.value),
      displayLeft: (Math.min(start, cumulative) / (maxAbs * 2 + baseValue)) * 100,
      displayWidth: (Math.abs(d.value) / (maxAbs * 2 + baseValue)) * 100 * 3,
    };
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>SHAP Waterfall</h3>
        <span className={styles.baseValue}>Base: {baseValue.toFixed(3)}</span>
      </div>
      <div className={styles.waterfallList}>
        {rows.map((row, i) => (
          <div key={row.feature} className={styles.row}>
            <div className={styles.featureLabel}>{row.feature}</div>
            <div className={styles.barTrack}>
              <div
                className={`${styles.bar} ${row.direction === 'positive' ? styles.positive : styles.negative}`}
                style={{
                  marginLeft: `${Math.min(row.start, row.end) / (maxAbs * 3 + 0.5) * 100}%`,
                  width: `${Math.max(Math.abs(row.value) / (maxAbs * 3 + 0.5) * 100, 2)}%`,
                }}
              />
            </div>
            <div className={`${styles.value} ${row.direction === 'positive' ? styles.posText : styles.negText}`}>
              {row.value >= 0 ? '+' : ''}{row.value.toFixed(4)}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.positive}`} /> Positive (pushes prediction up)
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.negative}`} /> Negative (pushes prediction down)
        </div>
      </div>
    </div>
  );
});
