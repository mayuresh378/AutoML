import { type Variants, type Transition } from 'framer-motion';

export const spring: Transition = { type: 'spring', stiffness: 400, damping: 20 };
export const springSnap: Transition = { type: 'spring', stiffness: 500, damping: 25 };
export const springGentle: Transition = { type: 'spring', stiffness: 300, damping: 25 };
export const easeOut: Transition = { duration: 0.25, ease: 'easeOut' };
export const easeInOut: Transition = { duration: 0.35, ease: 'easeInOut' };

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: easeOut },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, transition: easeOut },
};

export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: easeOut },
};

export const slideRight: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: easeOut },
};

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: 'easeIn' } },
};

export const cardHover = {
  whileHover: {
    y: -3,
    boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 12px 40px rgba(99, 102, 241, 0.15)',
    transition: { duration: 0.25, ease: 'easeOut' },
  },
  whileTap: { scale: 0.99 },
};

export const statCard = {
  initial: { opacity: 0, y: 16 },
  animate: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' },
  }),
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: easeOut },
};

export const iconHover = {
  whileHover: { scale: 1.15, transition: spring },
  whileTap: { scale: 0.9 },
};

export const buttonTap = { scale: 0.96, transition: spring };

export function getRippleAnimation(
  x: number, y: number, size: number, color = 'rgba(255,255,255,0.25)',
) {
  return {
    initial: { width: 0, height: 0, x, y, opacity: 0.6 },
    animate: {
      width: size,
      height: size,
      x: x - size / 2,
      y: y - size / 2,
      opacity: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  };
}

type Direction = 'up' | 'down' | 'left' | 'right' | 'scale';
type AnimationConfig = { opacity?: number; y?: number; x?: number; scale?: number; duration?: number; delay?: number };

export function fadeProps(dir: Direction = 'up', config?: AnimationConfig) {
  const d = config?.duration ?? 0.35;
  const dl = config?.delay ?? 0;
  const hidden: Record<string, number> = { opacity: config?.opacity ?? 0 };
  if (dir === 'up') hidden.y = config?.y ?? 12;
  if (dir === 'down') hidden.y = config?.y ?? -12;
  if (dir === 'left') hidden.x = config?.x ?? -12;
  if (dir === 'right') hidden.x = config?.x ?? 12;
  if (dir === 'scale') hidden.scale = config?.scale ?? 0.96;
  return {
    initial: hidden,
    animate: { opacity: 1, y: 0, x: 0, scale: 1, transition: { duration: d, delay: dl, ease: 'easeOut' } },
  };
}
