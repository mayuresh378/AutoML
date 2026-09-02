import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/cn';

interface AnimatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
}

export function AnimatedInput({
  label,
  icon,
  error,
  className,
  onFocus,
  onBlur,
  ...rest
}: AnimatedInputProps) {
  const [focused, setFocused] = useState(false);
  const [shake, setShake] = useState(false);
  const prevError = useRef(error);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    onBlur?.(e);
  };

  useEffect(() => {
    if (error && error !== prevError.current) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 300);
      return () => clearTimeout(t);
    }
    prevError.current = error;
  }, [error]);

  return (
    <div className="relative">
      {label && (
        <motion.label
          animate={{
            y: focused || rest.value ? -8 : 0,
            scale: focused || rest.value ? 0.85 : 1,
            color: focused ? '#6366F1' : 'rgba(148,163,184,0.6)',
          }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute left-3 top-2.5 text-sm text-slate-400 pointer-events-none origin-left"
          htmlFor={rest.id}
        >
          {label}
        </motion.label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          {...rest}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            'w-full rounded-xl border bg-white/5 text-sm text-white placeholder:text-slate-600 outline-none transition-all',
            focused
              ? 'border-primary/50 shadow-[0_0_0_1px_rgba(99,102,241,0.15)]'
              : 'border-white/10 hover:border-white/20',
            error && 'border-danger/50 animate-shake',
            label && 'pt-5 pb-2.5',
            icon ? 'pl-9 pr-3 py-2.5' : 'px-3 py-2.5',
            className,
          )}
        />
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-danger mt-1"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
