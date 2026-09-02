import { type ReactNode, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showClose?: boolean;
}

const sizeStyles = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]',
};

export function Modal({ open, onClose, title, description, children, size = 'md', className, showClose = true }: ModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative w-full bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-modal overflow-hidden',
              sizeStyles[size],
              className,
            )}
          >
            {(title || showClose) && (
              <div className="flex items-start justify-between px-6 pt-6 pb-4">
                <div className="min-w-0 flex-1">
                  {title && <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>}
                  {description && <p className="text-sm text-zinc-400 mt-1">{description}</p>}
                </div>
                {showClose && (
                  <button onClick={onClose} className="flex-shrink-0 p-1 rounded-lg hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
            <div className="px-6 pb-6 overflow-y-auto max-h-[70vh]">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
