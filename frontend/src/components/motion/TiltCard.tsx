import { useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  glareColor?: string;
  maxTilt?: number;
  scale?: number;
  glareOpacity?: number;
}

export default function TiltCard({
  children,
  className = '',
  glareColor = 'rgba(255,255,255,0.12)',
  maxTilt = 8,
  scale = 1.02,
  glareOpacity = 0,
}: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [maxTilt, -maxTilt]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-maxTilt, maxTilt]), { stiffness: 300, damping: 30 });
  const glareX = useSpring(useTransform(x, [-0.5, 0.5], [0, 100]), { stiffness: 300, damping: 30 });
  const glareY = useSpring(useTransform(y, [-0.5, 0.5], [0, 100]), { stiffness: 300, damping: 30 });
  const glareOpacityVal = useSpring(0, { stiffness: 300, damping: 30 });

  useEffect(() => {
    const unsub = glareOpacityVal.set(glareOpacity);
    return unsub;
  }, [glareOpacity, glareOpacityVal]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
    glareOpacityVal.set(1);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    glareOpacityVal.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      whileHover={{ scale }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background: `radial-gradient(circle at ${glareX.get()}% ${glareY.get()}%, ${glareColor}, transparent 60%)`,
          opacity: glareOpacityVal,
          pointerEvents: 'none',
        }}
      />
    </motion.div>
  );
}
