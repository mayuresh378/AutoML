import { motion } from 'framer-motion';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/cn';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center justify-center py-16 px-4', className)}
    >
      <div className="w-16 h-16 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h3 className="text-lg font-medium text-zinc-300 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500 text-center max-w-sm mb-6">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} icon={<RefreshCw className="w-4 h-4" />}>
          Try Again
        </Button>
      )}
    </motion.div>
  );
}
