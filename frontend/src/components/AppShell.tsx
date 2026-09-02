import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import LoadingSpinner from './LoadingSpinner';
import styles from './AppShell.module.css';

export default function AppShell() {
  const location = useLocation();

  return (
    <div className={styles.shell}>
      <Sidebar />
      <div className={styles.main}>
        <TopNav />
        <main className={styles.content}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={styles.page}
            >
              <Suspense fallback={<LoadingSpinner />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
