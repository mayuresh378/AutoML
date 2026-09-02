import { motion } from 'framer-motion';
import { gradeColor } from '../utils';

interface QualityGaugeProps {
  score: number;
  grade?: string;
  label?: string;
  size?: number;
  stroke?: number;
  centerNode?: React.ReactNode;
}

export function QualityGauge({ score, grade, label = 'Data Quality Score', size = 176, stroke = 14, centerNode }: QualityGaugeProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const color = gradeColor(grade || (clamped >= 90 ? 'A' : clamped >= 80 ? 'B' : clamped >= 65 ? 'C' : clamped >= 50 ? 'D' : 'F'));

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * clamped) / 100 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
        />
      </svg>
      {centerNode ?? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold tracking-tight" style={{ color }}>{Math.round(clamped)}</span>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">{label}</span>
          {grade && (
            <span className="text-xs font-bold mt-0.5" style={{ color }}>Grade {grade}</span>
          )}
        </div>
      )}
    </div>
  );
}
