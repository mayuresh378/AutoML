import { type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  badge?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  variant?: 'underline' | 'pills';
}

export function Tabs({ tabs, activeTab, onChange, className, variant = 'underline' }: TabsProps) {
  return (
    <div className={cn(
      'flex gap-1',
      variant === 'underline' ? 'border-b border-border' : '',
      className,
    )}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-2 whitespace-nowrap transition-all duration-200 font-medium',
            variant === 'underline'
              ? 'px-4 py-3 text-sm border-b-2 -mb-px'
              : 'px-4 py-2 text-sm rounded-lg',
            activeTab === tab.id
              ? variant === 'underline'
                ? 'border-primary text-zinc-100'
                : 'bg-white/10 text-zinc-100'
              : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5',
          )}
        >
          {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
          {tab.label}
          {tab.count != null && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full',
              activeTab === tab.id ? 'bg-primary/20 text-primary' : 'bg-white/10 text-zinc-400',
            )}>
              {tab.count}
            </span>
          )}
          {tab.badge}
        </button>
      ))}
    </div>
  );
}
