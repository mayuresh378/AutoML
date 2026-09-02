import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';

interface ParallaxSectionProps {
  children: React.ReactNode;
  className?: string;
  speed?: number;
  offset?: string[];
  direction?: 'vertical' | 'horizontal';
}

function useParallax(speed: number, offset?: string[]) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: offset as any,
  });
  const value = useTransform(scrollYProgress, [0, 1], [speed, -speed]);
  return { ref, value };
}

export default function ParallaxSection({
  children,
  className = '',
  speed = 50,
  offset = ['start end', 'end start'],
}: ParallaxSectionProps) {
  const { ref, value } = useParallax(speed, offset);

  return (
    <div ref={ref} className={className} style={{ overflow: 'hidden', position: 'relative' }}>
      <motion.div style={{ y: value }}>
        {children}
      </motion.div>
    </div>
  );
}

interface ParallaxChildProps {
  children: React.ReactNode;
  className?: string;
  value: MotionValue<number>;
}

export function ParallaxChild({ children, className, value }: ParallaxChildProps) {
  return (
    <motion.div className={className} style={{ y: value }}>
      {children}
    </motion.div>
  );
}
