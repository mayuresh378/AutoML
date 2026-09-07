import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import type { EngineReport } from '../../../../services/engine.service';
import styles from './ReportPanel.module.css';

interface Props {
  report: EngineReport | null;
}

function fmtVal(v: any): string {
  if (v == null) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4);
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (Array.isArray(v)) return Array.isArray(v[0]) ? `[${v.length} rows]` : v.join(', ');
  if (typeof v === 'object') return '[object]';
  return String(v);
}

function SectionBody({ value, depth = 0 }: { value: any; depth?: number }) {
  if (value == null) return <p className={styles.muted}>No data.</p>;
  if (typeof value === 'string') return <p className={styles.para}>{value}</p>;
  if (Array.isArray(value)) {
    const isRowsOfObjects = value.length > 0 && typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0]);
    if (isRowsOfObjects) {
      const keys = Object.keys(value[0]);
      return (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>{keys.map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>)}</tr>
            </thead>
            <tbody>
              {value.map((row, i) => (
                <tr key={i}>
                  {keys.map(k => <td key={k}>{fmtVal(row[k])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return (
      <ul className={styles.list}>
        {value.map((item, i) => (
          <li key={i}>
            {typeof item === 'object' && item !== null ? <SectionBody value={item} depth={depth + 1} /> : fmtVal(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0));
    if (entries.length === 0) return <p className={styles.muted}>No data.</p>;
    return (
      <div className={styles.kvGrid}>
        {entries.map(([k, v]) => (
          <div key={k} className={styles.kv}>
            <span className={styles.kvKey}>{k.replace(/_/g, ' ')}</span>
            <span className={styles.kvVal}>
              {typeof v === 'object' ? <SectionBody value={v} depth={depth + 1} /> : fmtVal(v)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return <p className={styles.para}>{fmtVal(value)}</p>;
}

export function ReportPanel({ report }: Props) {
  const [open, setOpen] = useState(false);
  if (!report) return null;

  const sections = report.order.map(title => ({ title, data: report.sections[title] }));

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
    >
      <button className={styles.head} onClick={() => setOpen(o => !o)}>
        <div className={styles.headLeft}>
          <span className={styles.iconWrap}><FileText size={15} /></span>
          <div>
            <span className={styles.title}>AutoML Report</span>
            <span className={styles.sub}>
              {sections.length} sections · {report.meta?.mode === 'advanced' ? 'Advanced mode' : 'Auto mode'} · generated for reproducibility
            </span>
          </div>
        </div>
        {open ? <ChevronUp size={16} className={styles.chev} /> : <ChevronDown size={16} className={styles.chev} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.body}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {sections.map((s, i) => (
              <section key={s.title} className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionNum}>{String(i + 1).padStart(2, '0')}</span>
                  <h4 className={styles.sectionTitle}>{s.title}</h4>
                </div>
                <div className={styles.sectionBody}>
                  <SectionBody value={s.data} />
                </div>
              </section>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}