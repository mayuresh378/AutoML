import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, AlertTriangle, CheckCircle2, Rocket, X, Sparkles } from 'lucide-react';

interface NotificationItem {
  id: string;
  type: 'success' | 'warning' | 'info';
  title: string;
  message: string;
  time: string;
  read: boolean;
  targetRoute?: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    type: 'success',
    title: 'Experiment completed',
    message: 'Customer Churn AutoML experiment finished with 94.8% F1 Score.',
    time: '2 minutes ago',
    read: false,
    targetRoute: '/app/experiments',
  },
  {
    id: 'n2',
    type: 'warning',
    title: 'Dataset warning',
    message: 'Missing values detected in customer_data.csv target column.',
    time: '15 minutes ago',
    read: false,
    targetRoute: '/app/cleaning',
  },
  {
    id: 'n3',
    type: 'info',
    title: 'Deployment successful',
    message: 'churn-api-v3 is live and responding to inference endpoints.',
    time: '1 hour ago',
    read: true,
    targetRoute: '/app/deployments',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsDrawer({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  if (!isOpen) return null;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-sm bg-zinc-900 border-l border-zinc-800 h-full flex flex-col shadow-2xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markAllRead}
              className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Mark all as read
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (n.targetRoute) navigate(n.targetRoute);
                onClose();
              }}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                n.read
                  ? 'bg-zinc-950/40 border-zinc-800/60 opacity-70'
                  : 'bg-zinc-900/80 border-indigo-500/30 hover:border-indigo-500/50'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />}
                {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />}
                {n.type === 'info' && <Rocket className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200">{n.title}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{n.time}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{n.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 bg-zinc-950/60 border-t border-zinc-800 text-center text-xs font-mono text-zinc-500">
          AutoML Workspace Alert System
        </div>
      </div>
    </div>
  );
}
