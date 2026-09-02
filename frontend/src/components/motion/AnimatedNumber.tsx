import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useInView } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}

export default function AnimatedNumber({
  value,
  className = '',
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.2,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, { stiffness: 80, damping: 20 });
  const displayed = useTransform(springVal, (v) => {
    const num = Number(v.toFixed(decimals));
    return `${prefix}${num.toLocaleString()}${suffix}`;
  });

  useEffect(() => {
    if (isInView) {
      motionVal.set(value);
    }
  }, [isInView, value, motionVal]);

  return (
    <motion.span ref={ref} className={className}>
      {displayed}
    </motion.span>
  );
}
