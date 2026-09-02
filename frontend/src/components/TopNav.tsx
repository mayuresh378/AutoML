import { Link, useLocation } from 'react-router-dom';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import styles from './TopNav.module.css';

const PAGE_TITLES: Record<string, string> = {
  '/app/dashboard': 'Dashboard',
  '/app/datasets': 'Datasets',
  '/app/sql': 'SQL Editor',
  '/app/training': 'Training',
  '/app/ai': 'AI Assistant',
  '/app/explain': 'Explainable AI',
  '/app/evaluation': 'Model Evaluation',
  '/app/experiments': 'Experiments',
  '/app/models': 'Model Registry',
  '/app/deployments': 'Deployments',
  '/app/monitoring': 'Monitoring',
  '/app/settings': 'Settings',
};

export default function TopNav() {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const title = PAGE_TITLES[location.pathname] || 'AutoML';

  const userName = user?.name || 'Guest';
  const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [prevScrollY, setPrevScrollY] = useState(0);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const diff = latest - prevScrollY;
    if (Math.abs(diff) > 10) {
      setHidden(diff > 0 && latest > 60);
      setPrevScrollY(latest);
    }
  });

  return (
    <motion.header
      className={styles.topnav}
      animate={hidden ? { y: '-100%' } : { y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
    >
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.right}>
        <motion.button
          className={styles.iconBtn}
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          whileHover={{ scale: 1.1, rotate: 15 }}
          whileTap={{ scale: 0.9 }}
        >
          {isDark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          )}
        </motion.button>
        <Link to="/app/settings" className={styles.iconBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </Link>
        <motion.div
          className={styles.avatarSmall}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {initials}
        </motion.div>
      </div>
    </motion.header>
  );
}
