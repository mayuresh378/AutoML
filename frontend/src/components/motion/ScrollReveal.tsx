import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale' | 'fade';
  delay?: number;
  duration?: number;
  distance?: number;
  once?: boolean;
  margin?: string;
}

const directionMap = {
  up: (d: number) => ({ y: d }),
  down: (d: number) => ({ y: -d }),
  left: (d: number) => ({ x: -d }),
  right: (d: number) => ({ x: d }),
  scale: () => ({ scale: 0.92 }),
  fade: () => ({}),
};

export default function ScrollReveal({
  children,
  className = '',
  direction = 'up',
  delay = 0,
  duration = 0.6,
  distance = 40,
  once = true,
  margin = '-80px',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: margin as `${number}${"px" | "%"}` });
  const hiddenState = directionMap[direction](distance);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, ...hiddenState }}
      animate={isInView ? { opacity: 1, x: 0, y: 0, scale: 1 } : {}}
      transition={{
        delay,
        duration,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
