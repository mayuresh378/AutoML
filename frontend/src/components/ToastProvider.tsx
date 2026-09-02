import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../lib/cn';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toast: (type: ToastType, title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  error: 'border-red-500/30 bg-red-500/10 text-red-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
};

function SwipeableToast({
  t,
  onDismiss,
}: {
  t: Toast;
  onDismiss: (id: number) => void;
}) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, -80, 0, 80, 150], [0, 0.8, 1, 0.8, 0]);
  const scale = useTransform(x, [-150, 0, 150], [0.9, 1, 0.9]);
  const Icon = ICONS[t.type];

  return (
    <motion.div
      key={t.id}
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      drag="x"
      dragConstraints={{ left: -150, right: 150 }}
      dragElastic={0.3}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 100) {
          onDismiss(t.id);
        }
      }}
      style={{ x, opacity, scale, cursor: 'grab' }}
      className={cn(
        'relative rounded-2xl border px-4 py-3 shadow-glow overflow-hidden backdrop-blur-md',
        STYLES[t.type],
      )}
    >
      <div className="flex items-start gap-3">
        <motion.div
          initial={{ rotate: -20, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 15 }}
        >
          <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{t.title}</p>
          {t.message && (
            <motion.p
              className="text-xs opacity-80 mt-0.5"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 0.8, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {t.message}
            </motion.p>
          )}
        </div>
        <motion.button
          onClick={() => onDismiss(t.id)}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          whileHover={{ scale: 1.2, rotate: 90 }}
          whileTap={{ scale: 0.8 }}
        >
          <X className="h-3.5 w-3.5" />
        </motion.button>
      </div>
      <motion.div
        className="absolute bottom-0 left-0 h-0.5 bg-white/20 rounded-full"
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: 3.5, ease: 'linear' }}
      />
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <SwipeableToast key={t.id} t={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
