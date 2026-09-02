import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';

export function ActivityTimeline() {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    api.activity.list().then((r: any) => setActivities(r.activities.slice(0, 10))).catch(() => {});
    const id = setInterval(() => api.activity.list().then((r: any) => setActivities(r.activities.slice(0, 10))).catch(() => {}), 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card/60">
      <div className="px-4 py-3.5 border-b border-border">
        <span className="text-sm font-medium text-zinc-100">Activity</span>
      </div>
      <div className="px-4 py-3.5">
        <ol className="relative border-l border-border ml-1.5 space-y-4">
          {activities.length === 0 && (
            <li className="pl-4 text-sm text-zinc-500">No activity yet.</li>
          )}
          <AnimatePresence mode="popLayout">
            {activities.map((item: any, idx: number) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                className="pl-4 relative"
              >
                <span className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full bg-primary ring-4 ring-card" />
                <p className="text-[13px] text-zinc-300 leading-snug">
                  <span className="font-medium text-zinc-100">{item.actor}</span>{' '}
                  {item.action}{' '}
                  <span className="text-zinc-200">{item.target}</span>
                </p>
                <span className="text-[11px] text-zinc-600">{item.time}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </div>
    </div>
  );
}
