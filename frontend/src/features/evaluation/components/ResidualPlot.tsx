import { memo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { ResidualPlotData } from '../services/evaluation.service';
import styles from './ResidualPlot.module.css';

interface Props {
  data: ResidualPlotData;
}

export const ResidualPlot = memo(function ResidualPlot({ data }: Props) {
  if (!data) return null;

  const chartData = data.predicted.map((pred, i) => ({
    predicted: pred,
    residual: data.residuals[i],
    actual: data.actual[i],
  }));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Residual Plot</h3>
        <div className={styles.stats}>
          <span className={styles.statBadge}>Mean: {data.mean_residual.toFixed(4)}</span>
          <span className={styles.statBadge}>Std: {data.std_residual.toFixed(4)}</span>
        </div>
      </div>
      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height={350}>
          <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              type="number"
              dataKey="predicted"
              name="Predicted"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              label={{ value: 'Predicted Values', position: 'bottom', offset: 0, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
            />
            <YAxis
              type="number"
              dataKey="residual"
              name="Residual"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              label={{ value: 'Residuals', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: 'var(--color-text-tertiary)' } }}
            />
            <Tooltip
              contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
              formatter={(value: number, name: string) => [typeof value === 'number' ? value.toFixed(4) : value, name]}
            />
            <ReferenceLine y={0} stroke="var(--color-text-tertiary)" strokeDasharray="6 4" strokeWidth={1} />
            <Scatter
              data={chartData}
              fill="#6366f1"
              fillOpacity={0.5}
              r={3}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.insight}>
        {Math.abs(data.mean_residual) < data.std_residual * 0.1
          ? 'Residuals are centered around zero — good model calibration.'
          : data.mean_residual > 0
          ? 'Model tends to underpredict (positive mean residual).'
          : 'Model tends to overpredict (negative mean residual).'}
      </div>
    </div>
  );
});
