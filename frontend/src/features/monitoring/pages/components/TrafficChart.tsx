import { motion } from 'framer-motion';
import { Download, Maximize2, RefreshCw } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import styles from './TrafficChart.module.css';

interface TrafficChartProps {
  data: { hour: string; count: number }[];
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipLabel}>{label}</div>
      <div className={styles.tooltipValue}>{payload[0].value.toLocaleString()} requests</div>
    </div>
  );
}

export function TrafficChart({ data }: TrafficChartProps) {
  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>Traffic Over Time</h3>
        </div>
        <div className={styles.toolbar}>
          <button className={styles.toolBtn} title="Download"><Download size={14} /></button>
          <button className={styles.toolBtn} title="Fullscreen"><Maximize2 size={14} /></button>
          <button className={styles.toolBtn} title="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>
      <div className={styles.body}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="hour"
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
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              fill="url(#trafficGrad)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, fill: '#3b82f6', stroke: '#111827', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
