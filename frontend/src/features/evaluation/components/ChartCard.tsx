import { type ReactNode } from 'react';
import styles from './ChartCard.module.css';

interface Props {
  title: string;
  subtitle?: string;
  /** Optional stat pills shown on the right of the header. */
  stats?: { label: string; value: string }[];
  actions?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, stats, actions, children }: Props) {
  return (
    <section className={styles.card}>
      <header className={styles.header}>
        <div className={styles.headings}>
          <h3 className={styles.title}>{title}</h3>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <div className={styles.headerRight}>
          {stats?.map((s) => (
            <span key={s.label} className={styles.stat}>
              <span className={styles.statLabel}>{s.label}</span>
              <span className={styles.statValue}>{s.value}</span>
            </span>
          ))}
          {actions}
        </div>
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
