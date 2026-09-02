import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { fadeUp } from '../../lib/animations';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const maxWidths = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[1400px]',
  full: 'max-w-full',
};

export function PageContainer({ children, className, maxWidth = 'xl' }: PageContainerProps) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className={cn('w-full px-6 py-6 mx-auto', maxWidths[maxWidth], className)}
    >
      {children}
    </motion.div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-8', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">{title}</h1>
        {description && <p className="text-sm text-zinc-400 mt-1">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-3 flex-shrink-0 ml-4">{children}</div>}
    </div>
  );
}

interface PageSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function PageSection({ title, description, children, className }: PageSectionProps) {
  return (
    <section className={cn('mb-8', className)}>
      {title && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
          {description && <p className="text-sm text-zinc-500 mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
