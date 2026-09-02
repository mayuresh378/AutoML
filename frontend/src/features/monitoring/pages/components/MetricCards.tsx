import { motion } from 'framer-motion';
import {
  Activity, Zap, Cpu, HardDrive, Wifi, BarChart3,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer,
} from 'recharts';
import styles from './MetricCards.module.css';

interface MetricCardsProps {
  predictions: { total: number; today: number; last_hour: number; requests_per_minute: number };
  latency: { avg: number; p50: number; p95: number; p99: number; sparkline: { i: number; latency: number }[] };
  cpu: number;
  cpuCores: number;
  loadAvg: number;
  ram: number;
  ramTotalGb: number;
  ramUsedGb: number;
  traffic: { requests_per_minute: number };
  errorRate: number;
  successRate: number;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

function TrendBadge({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value > 0) return (
    <span className={`${styles.trend} ${styles.trendUp}`}>
      <TrendingUp size={12} /> +{value.toFixed(1)}{suffix}
    </span>
  );
  if (value < 0) return (
    <span className={`${styles.trend} ${styles.trendDown}`}>
      <TrendingDown size={12} /> {value.toFixed(1)}{suffix}
    </span>
  );
  return (
    <span className={`${styles.trend} ${styles.trendFlat}`}>
      <Minus size={12} /> 0{suffix}
    </span>
  );
}

function StatusBadge({ pct }: { pct: number }) {
  if (pct < 60) return <span className={`${styles.statusBadge} ${styles.statusOk}`}>Healthy</span>;
  if (pct < 85) return <span className={`${styles.statusBadge} ${styles.statusWarn}`}>Elevated</span>;
  return <span className={`${styles.statusBadge} ${styles.statusCrit}`}>Critical</span>;
}

export function MetricCards({
  predictions, latency, cpu, cpuCores, loadAvg,
  ram, ramTotalGb, ramUsedGb, traffic, errorRate, successRate,
}: MetricCardsProps) {
  const sparkData = (latency.sparkline || []).map((s) => ({ v: s.latency }));

  const cards = [
    {
      icon: Activity,
      label: 'Total Predictions',
      value: predictions.total.toLocaleString(),
      sub: `${predictions.today} today \u00b7 ${predictions.last_hour} last hour`,
      gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.05))',
      iconColor: '#60a5fa',
      sparkColor: '#3b82f6',
      trend: +2.4,
      statusPct: 0,
      sparkData: [],
    },
    {
      icon: Zap,
      label: 'Avg Latency',
      value: `${latency.avg}ms`,
      sub: `p50: ${latency.p50}ms \u00b7 p95: ${latency.p95}ms`,
      gradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(109, 40, 217, 0.05))',
      iconColor: '#a78bfa',
      sparkColor: '#8b5cf6',
      trend: -1.2,
      statusPct: Math.min(latency.avg / 5, 100),
      sparkData,
    },
    {
      icon: Cpu,
      label: 'CPU Usage',
      value: `${cpu.toFixed(1)}%`,
      sub: `${cpuCores} cores \u00b7 load ${loadAvg}`,
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.05))',
      iconColor: '#34d399',
      sparkColor: '#10b981',
      trend: +0.8,
      statusPct: cpu,
      sparkData: [],
    },
    {
      icon: HardDrive,
      label: 'RAM Usage',
      value: `${ram.toFixed(1)}%`,
      sub: `${ramUsedGb}GB / ${ramTotalGb}GB`,
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.05))',
      iconColor: '#fbbf24',
      sparkColor: '#f59e0b',
      trend: +0.3,
      statusPct: ram,
      sparkData: [],
    },
    {
      icon: Wifi,
      label: 'Traffic',
      value: `${traffic.requests_per_minute}`,
      sub: 'requests/min',
      gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(8, 145, 178, 0.05))',
      iconColor: '#22d3ee',
      sparkColor: '#06b6d4',
      trend: +5.1,
      statusPct: Math.min(traffic.requests_per_minute * 10, 100),
      sparkData: [],
    },
    {
      icon: BarChart3,
      label: 'Error Rate',
      value: `${errorRate}%`,
      sub: `${successRate}% success rate`,
      gradient: errorRate > 10
        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.05))'
        : 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.05))',
      iconColor: errorRate > 10 ? '#f87171' : '#4ade80',
      sparkColor: errorRate > 10 ? '#ef4444' : '#22c55e',
      trend: errorRate > 10 ? +3.2 : -0.5,
      statusPct: errorRate,
      sparkData: [],
    },
  ];

  return (
    <motion.div className={styles.grid} variants={container} initial="hidden" animate="show">
      {cards.map((card) => (
        <motion.div
          key={card.label}
          className={styles.card}
          variants={item}
          whileHover={{ y: -4, scale: 1.01, transition: { duration: 0.2 } }}
        >
          <div className={styles.cardInner} style={{ background: card.gradient }}>
            <div className={styles.cardTop}>
              <div className={styles.iconWrap} style={{ color: card.iconColor }}>
                <card.icon size={22} />
              </div>
              <StatusBadge pct={card.statusPct} />
            </div>
            <div className={styles.cardValue}>{card.value}</div>
            <div className={styles.cardLabel}>{card.label}</div>
            <div className={styles.cardBottom}>
              <TrendBadge value={card.trend} suffix="%" />
              <span className={styles.cardSub}>{card.sub}</span>
            </div>
            {card.sparkData.length > 1 && (
              <div className={styles.sparkline}>
                <ResponsiveContainer width="100%" height={32}>
                  <AreaChart data={card.sparkData}>
                    <defs>
                      <linearGradient id={`spark-${card.label}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={card.sparkColor} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={card.sparkColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={card.sparkColor}
                      fill={`url(#spark-${card.label})`}
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
