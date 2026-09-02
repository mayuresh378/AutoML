import { motion } from 'framer-motion';

interface GlowOrbProps {
  size?: number;
  color?: string;
  className?: string;
  delay?: number;
  x?: number;
  y?: number;
  blur?: number;
}

export default function GlowOrb({
  size = 200,
  color = 'rgba(79,70,229,0.3)',
  className = '',
  delay = 0,
  x = 0,
  y = 0,
  blur = 80,
}: GlowOrbProps) {
  return (
    <motion.div
      className={className}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        filter: `blur(${blur}px)`,
        left: x,
        top: y,
        pointerEvents: 'none',
      }}
      animate={{
        x: [0, 30, -20, 0],
        y: [0, -25, 15, 0],
        scale: [1, 1.1, 0.9, 1],
        opacity: [0.6, 0.8, 0.5, 0.6],
      }}
      transition={{
        duration: 20,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}
