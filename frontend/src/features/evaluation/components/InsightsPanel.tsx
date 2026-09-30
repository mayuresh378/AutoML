import { memo } from 'react';
import { CheckCircle2, Info, AlertTriangle, XCircle, Lightbulb } from 'lucide-react';
import type { EvaluationInsight, InsightSeverity } from '../services/evaluation.service';
import { SEVERITY_LABELS } from '../utils/metrics';
import styles from './InsightsPanel.module.css';

const ICONS: Record<InsightSeverity, typeof Info> = {
  positive: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  critical: XCircle,
};

const ORDER: InsightSeverity[] = ['critical', 'warning', 'positive', 'info'];

interface Props {
  insights: EvaluationInsight[];
  /** Train/test basis line, shown so metrics are never read without context. */
  basis?: string;
}

export const InsightsPanel = memo(function InsightsPanel({ insights, basis }: Props) {
  if (!insights.length) return null;

  const sorted = [...insights].sort(
    (a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity),
  );

  return (
    <section className={styles.card} aria-labelledby="evaluation-insights">
      <header className={styles.header}>
        <span className={styles.iconWrap}>
          <Lightbulb className={styles.headerIcon} />
        </span>
        <div>
          <h2 className={styles.title} id="evaluation-insights">
            Insights
          </h2>
          <p className={styles.subtitle}>
            Every insight below is derived from this run&rsquo;s metrics and test data.
          </p>
        </div>
        {basis && <span className={styles.basis}>{basis}</span>}
      </header>

      <ul className={styles.list}>
        {sorted.map((item) => {
          const Icon = ICONS[item.severity] ?? Info;
          return (
            <li key={item.key} className={styles.item} data-severity={item.severity}>
              <Icon className={styles.itemIcon} />
              <div className={styles.itemBody}>
                <div className={styles.itemHead}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.severity}>{SEVERITY_LABELS[item.severity]}</span>
                </div>
                <p className={styles.detail}>{item.detail}</p>
                {item.evidence && Object.keys(item.evidence).length > 0 && (
                  <div className={styles.evidence}>
                    {Object.entries(item.evidence)
                      .slice(0, 5)
                      .map(([k, v]) => (
                        <span key={k} className={styles.evidenceChip}>
                          {k.replace(/_/g, ' ')}: {formatEvidence(v)}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
});

function formatEvidence(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(4);
  if (Array.isArray(value)) return value.map((v) => String(v)).join(' / ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
