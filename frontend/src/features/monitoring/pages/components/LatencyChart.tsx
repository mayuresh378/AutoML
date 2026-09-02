import { motion } from 'framer-motion';
import { Download, Maximize2, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import styles from './LatencyChart.module.css';

interface LatencyChartProps {
  histogram: { bucket: string; count: number }[];
}

const COLORS = ['#10b981', '#34d399', '#fbbf24', '#f97316', '#ef4444'];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      <div className={styles.tooltipValue}>{payload[0].value} requests</div>
    </div>
  );
}

export function LatencyChart({ histogram }: LatencyChartProps) {
  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>Latency Distribution</h3>
        </div>
        <div className={styles.toolbar}>
          <button className={styles.toolBtn} title="Download"><Download size={14} /></button>
          <button className={styles.toolBtn} title="Fullscreen"><Maximize2 size={14} /></button>
          <button className={styles.toolBtn} title="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>
      <div className={styles.body}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={histogram}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {histogram.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
