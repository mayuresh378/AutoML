import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Inbox } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-col items-center justify-center py-16 px-4', className)}
    >
      <div className="w-16 h-16 rounded-lg bg-card border border-border flex items-center justify-center mb-4">
        {icon || <Inbox className="w-8 h-8 text-zinc-500" />}
      </div>
      <h3 className="text-lg font-medium text-zinc-300 mb-1">{title}</h3>
      {description && <p className="text-sm text-zinc-500 text-center max-w-sm mb-6">{description}</p>}
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </motion.div>
  );
}
