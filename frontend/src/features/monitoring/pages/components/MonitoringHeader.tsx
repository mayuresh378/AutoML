import { motion } from 'framer-motion';
import { Activity, RefreshCw, Download, Bell, Search } from 'lucide-react';
import styles from './MonitoringHeader.module.css';

interface MonitoringHeaderProps {
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  onRefresh: () => void;
}

const TIME_RANGES = ['1h', '6h', '24h', '7d'] as const;

export function MonitoringHeader({ timeRange, onTimeRangeChange, onRefresh }: MonitoringHeaderProps) {
  return (
    <motion.div
      className={styles.header}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.headerLeft}>
        <div className={styles.titleRow}>
          <div className={styles.iconWrap}>
            <Activity size={24} />
          </div>
          <div>
            <h1 className={styles.title}>Monitoring</h1>
            <p className={styles.subtitle}>Production Health & Model Performance</p>
          </div>
        </div>
      </div>

      <div className={styles.headerRight}>
        <div className={styles.timeRange}>
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              className={`${styles.timeBtn} ${timeRange === r ? styles.timeBtnActive : ''}`}
              onClick={() => onTimeRangeChange(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <button className={styles.actionBtn} onClick={onRefresh} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button className={styles.actionBtn} title="Export Report">
            <Download size={16} />
          </button>
          <button className={styles.actionBtn} title="Notifications">
            <Bell size={16} />
          </button>
          <button className={styles.actionBtn} title="Search">
            <Search size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
