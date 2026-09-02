import { motion } from 'framer-motion';
import { Cpu, HardDrive, Activity, AlertTriangle } from 'lucide-react';
import styles from './SystemHealth.module.css';

interface SystemHealthProps {
  cpu: number;
  cpuCores: number;
  loadAvg: number;
  ram: number;
  ramTotalGb: number;
  ramUsedGb: number;
  disk: number;
  diskFreeGb: number;
  alerts: { severity: string; title: string; message: string; time: string }[];
}

function GaugeBar({ value, color }: { value: number; color: string }) {
  return (
    <div className={styles.gaugeTrack}>
      <motion.div
        className={styles.gaugeFill}
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const color = severity === 'critical' ? '#ef4444' : severity === 'warning' ? '#f59e0b' : '#3b82f6';
  return <span className={styles.sevDot} style={{ background: color, boxShadow: `0 0 6px ${color}40` }} />;
}

export function SystemHealth({
  cpu, cpuCores, loadAvg, ram, ramTotalGb, ramUsedGb,
  disk, diskFreeGb, alerts,
}: SystemHealthProps) {
  const getBarColor = (pct: number) => {
    if (pct < 60) return '#10b981';
    if (pct < 85) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>System Health</h3>
      </div>
      <div className={styles.body}>
        <div className={styles.gauges}>
          <div className={styles.gaugeItem}>
            <div className={styles.gaugeTop}>
              <div className={styles.gaugeInfo}>
                <Cpu size={16} className={styles.gaugeIcon} style={{ color: '#10b981' }} />
                <span className={styles.gaugeLabel}>CPU</span>
              </div>
              <span className={styles.gaugeValue}>{cpu.toFixed(1)}%</span>
            </div>
            <GaugeBar value={cpu} color={getBarColor(cpu)} />
            <span className={styles.gaugeSub}>{cpuCores} cores \u00b7 load {loadAvg}</span>
          </div>

          <div className={styles.gaugeItem}>
            <div className={styles.gaugeTop}>
              <div className={styles.gaugeInfo}>
                <HardDrive size={16} className={styles.gaugeIcon} style={{ color: '#8b5cf6' }} />
                <span className={styles.gaugeLabel}>RAM</span>
              </div>
              <span className={styles.gaugeValue}>{ram.toFixed(1)}%</span>
            </div>
            <GaugeBar value={ram} color={getBarColor(ram)} />
            <span className={styles.gaugeSub}>{ramUsedGb}GB / {ramTotalGb}GB</span>
          </div>

          <div className={styles.gaugeItem}>
            <div className={styles.gaugeTop}>
              <div className={styles.gaugeInfo}>
                <Activity size={16} className={styles.gaugeIcon} style={{ color: '#06b6d4' }} />
                <span className={styles.gaugeLabel}>Disk</span>
              </div>
              <span className={styles.gaugeValue}>{disk.toFixed(1)}%</span>
            </div>
            <GaugeBar value={disk} color={getBarColor(disk)} />
            <span className={styles.gaugeSub}>{diskFreeGb}GB free</span>
          </div>
        </div>

        <div className={styles.alertSection}>
          <div className={styles.alertHeader}>
            <AlertTriangle size={14} className={styles.alertIcon} />
            <span className={styles.alertTitle}>Recent Alerts</span>
            <span className={styles.alertCount}>{alerts.length}</span>
          </div>
          <div className={styles.alertList}>
            {alerts.slice(0, 5).map((a, i) => (
              <motion.div
                key={i}
                className={styles.alertItem}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.05 }}
              >
                <SeverityDot severity={a.severity} />
                <div className={styles.alertContent}>
                  <div className={styles.alertName}>{a.title}</div>
                  <div className={styles.alertMsg}>{a.message}</div>
                </div>
                <span className={styles.alertTime}>{a.time}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
