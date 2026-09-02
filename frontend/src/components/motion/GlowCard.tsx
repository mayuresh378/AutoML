import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { useRef } from 'react';

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  borderWidth?: number;
}

export default function GlowCard({
  children,
  className = '',
  glowColor = 'rgba(79,70,229,0.4)',
  borderWidth = 1,
}: GlowCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { stiffness: 200, damping: 25 };
  const glowX = useSpring(mouseX, springConfig);
  const glowY = useSpring(mouseY, springConfig);
  const opacity = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
    opacity.set(1);
  };

  const handleMouseLeave = () => {
    opacity.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', overflow: 'hidden' }}
      whileHover={{ scale: 1.01 }}
    >
      <motion.div
        style={{
          position: 'absolute',
          left: glowX,
          top: glowY,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: glowColor,
          filter: 'blur(60px)',
          opacity,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </motion.div>
  );
}
