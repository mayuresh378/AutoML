import { motion } from 'framer-motion';
import { Brain, Activity, BarChart3 } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import styles from './DriftPanel.module.css';

interface DriftPanelProps {
  modelDrift: { score: number; status: string };
  dataDrift: { score: number; status: string };
  driftTimeline: { time: string; model_drift: number; data_drift: number }[];
  confidenceDistribution: { bucket: string; count: number }[];
  successRate: number;
  errorRate: number;
  latency: { p50: number; p95: number; p99: number };
}

const PIE_COLORS = ['#10b981', '#ef4444'];

function StatusDot({ status }: { status: string }) {
  const color = status === 'healthy' ? '#10b981' : status === 'warning' ? '#fbbf24' : '#ef4444';
  return <span className={styles.statusDot} style={{ background: color, boxShadow: `0 0 8px ${color}40` }} />;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className={styles.tooltipItem}>
          <span className={styles.tooltipDot} style={{ background: p.color }} />
          <span>{p.dataKey === 'model_drift' ? 'Model' : 'Data'}: {p.value.toFixed(2)}%</span>
        </div>
      ))}
    </div>
  );
}

export function DriftPanel({
  modelDrift, dataDrift, driftTimeline, confidenceDistribution,
  successRate, errorRate, latency,
}: DriftPanelProps) {
  return (
    <div className={styles.grid}>
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>Model Drift</h3>
        </div>
        <div className={styles.body}>
          <div className={styles.driftBadges}>
            <div className={styles.driftBadge}>
              <Brain size={14} className={styles.driftIcon} />
              <span>Model Drift</span>
              <StatusDot status={modelDrift.status} />
              <span className={styles.driftScore}>{modelDrift.score}%</span>
            </div>
            <div className={styles.driftBadge}>
              <Activity size={14} className={styles.driftIcon} />
              <span>Data Drift</span>
              <StatusDot status={dataDrift.status} />
              <span className={styles.driftScore}>{dataDrift.score}</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={driftTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="model_drift" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Model Drift" />
              <Line type="monotone" dataKey="data_drift" stroke="#f59e0b" strokeWidth={2} dot={false} name="Data Drift" />
              <Legend wrapperStyle={{ fontSize: 11, color: '#6b7280' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
      >
        <div className={styles.header}>
          <h3 className={styles.title}>Prediction Distribution</h3>
        </div>
        <div className={styles.body}>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={confidenceDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 10, fontSize: 13 }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#8b5cf6" fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
          <div className={styles.bottomRow}>
            <div className={styles.pieSection}>
              <ResponsiveContainer width={80} height={80}>
                <PieChart>
                  <Pie
                    data={[{ name: 'Success', value: successRate }, { name: 'Error', value: errorRate }]}
                    cx="50%" cy="50%" innerRadius={20} outerRadius={34} paddingAngle={3} dataKey="value"
                  >
                    {PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.pieLabels}>
                <span style={{ color: '#10b981' }}>{successRate}% success</span>
                <span style={{ color: '#ef4444' }}>{errorRate}% error</span>
              </div>
            </div>
            <div className={styles.latencyStats}>
              <div className={styles.latStat}>
                <span className={styles.latLabel}>p50</span>
                <span className={styles.latValue}>{latency.p50}ms</span>
              </div>
              <div className={styles.latStat}>
                <span className={styles.latLabel}>p95</span>
                <span className={styles.latValue}>{latency.p95}ms</span>
              </div>
              <div className={styles.latStat}>
                <span className={styles.latLabel}>p99</span>
                <span className={styles.latValue}>{latency.p99}ms</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
