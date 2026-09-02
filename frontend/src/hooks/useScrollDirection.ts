import { useState, useEffect, useRef } from 'react';

interface ScrollDirectionOptions {
  threshold?: number;
  initialDirection?: 'up' | 'down';
}

export function useScrollDirection({ threshold = 10, initialDirection = 'up' }: ScrollDirectionOptions = {}) {
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>(initialDirection);
  const [scrollY, setScrollY] = useState(0);
  const [isAtTop, setIsAtTop] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const update = () => {
      const currentY = window.scrollY;
      const diff = currentY - lastScrollY.current;

      setScrollY(currentY);
      setIsAtTop(currentY < threshold);

      if (Math.abs(diff) > threshold) {
        setScrollDirection(diff > 0 ? 'down' : 'up');
        lastScrollY.current = currentY;
      }

      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return { scrollDirection, scrollY, isAtTop };
}
