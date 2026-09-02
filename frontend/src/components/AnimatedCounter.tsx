import { useRef, useEffect } from 'react';
import { useMotionValue, useSpring, useTransform, motion } from 'framer-motion';

interface AnimatedCounterProps {
  from?: number;
  to: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  enabled?: boolean;
}

export function AnimatedCounter({
  from = 0,
  to,
  duration = 1.2,
  decimals = 0,
  suffix = '',
  prefix = '',
  className,
  enabled = true,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(enabled ? from : to);
  const spring = useSpring(motionValue, { stiffness: 80, damping: 20 });
  const rounded = useTransform(spring, (v) => `${prefix}${(v ?? 0).toFixed(decimals)}${suffix}`);

  useEffect(() => {
    motionValue.set(enabled ? to : from);
  }, [to, enabled, from, motionValue]);

  return <motion.span ref={ref} className={className}>{rounded}</motion.span>;
}
