import { motion } from 'framer-motion';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import styles from './AlertsTable.module.css';

interface AlertsTableProps {
  alerts: { severity: string; title: string; message: string; time: string }[];
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls = severity === 'critical' ? styles.sevCrit : severity === 'warning' ? styles.sevWarn : styles.sevInfo;
  return <span className={`${styles.sevBadge} ${cls}`}>{severity}</span>;
}

function StatusBadge() {
  return <span className={styles.statusBadge}>Active</span>;
}

export function AlertsTable({ alerts }: AlertsTableProps) {
  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.6 }}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>Recent Alerts</h3>
        <span className={styles.count}>{alerts.length} alerts</span>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Status</th>
              <th>Alert</th>
              <th>Message</th>
              <th>Timestamp</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a, i) => (
              <motion.tr
                key={i}
                className={styles.row}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 + i * 0.04 }}
              >
                <td><SeverityBadge severity={a.severity} /></td>
                <td><StatusBadge /></td>
                <td className={styles.cellTitle}>{a.title}</td>
                <td className={styles.cellMsg}>{a.message}</td>
                <td className={styles.cellTime}>{a.time}</td>
                <td>
                  <button className={styles.actionBtn}>
                    <ExternalLink size={14} />
                  </button>
                </td>
              </motion.tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  <AlertTriangle size={20} className={styles.emptyIcon} />
                  No alerts recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
