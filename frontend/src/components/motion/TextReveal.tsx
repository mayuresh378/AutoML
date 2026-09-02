import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface TextRevealProps {
  children: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  delay?: number;
  speed?: number;
  charMode?: 'words' | 'chars';
}

export default function TextReveal({
  children,
  className = '',
  as: Tag = 'p',
  delay = 0,
  speed = 0.04,
  charMode = 'words',
}: TextRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const MotionTag = motion(Tag);

  const units = charMode === 'chars' ? children.split('') : children.split(' ');

  return (
    <MotionTag ref={ref as any} className={className} aria-label={children}>
      {units.map((unit, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            overflow: 'hidden',
          }}
        >
          <motion.span
            style={{ display: 'inline-block' }}
            initial={{ y: '110%', rotateX: -80 }}
            animate={isInView ? { y: 0, rotateX: 0 } : {}}
            transition={{
              delay: delay + i * speed,
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {unit}
          </motion.span>
          {charMode === 'words' && i < units.length - 1 && '\u00A0'}
        </span>
      ))}
    </MotionTag>
  );
}
