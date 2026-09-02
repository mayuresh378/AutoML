import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface StaggeredListProps {
  children: React.ReactNode[];
  className?: string;
  itemClassName?: string;
  staggerDelay?: number;
  itemDelay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export default function StaggeredList({
  children,
  className = '',
  itemClassName = '',
  staggerDelay = 0.06,
  itemDelay = 0,
  direction = 'up',
}: StaggeredListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  const axis = direction === 'up' || direction === 'down' ? 'y' : 'x';
  const sign = direction === 'up' || direction === 'left' ? 1 : -1;
  const offset = 20 * sign;

  return (
    <div ref={ref} className={className}>
      {children.map((child, i) => (
        <motion.div
          key={i}
          className={itemClassName}
          initial={{ opacity: 0, [axis]: offset }}
          animate={isInView ? { opacity: 1, [axis]: 0 } : {}}
          transition={{
            delay: itemDelay + i * staggerDelay,
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
}
