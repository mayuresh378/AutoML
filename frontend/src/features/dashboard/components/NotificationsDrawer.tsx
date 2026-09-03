import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, CheckCircle2, X, Sparkles } from 'lucide-react';
import { useNotifications, useMarkAllNotificationsRead, useMarkNotificationRead } from '../../../hooks/useApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsDrawer({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();

  if (!isOpen) return null;

  const handleMarkAllRead = () => {
    markAllRead.mutate();
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
              onClick={handleMarkAllRead}
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
          {notifications.length === 0 && (
            <div className="p-6 text-center">
              <Bell className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-xs text-zinc-500 font-mono">No notifications</p>
            </div>
          )}
          {notifications.map((n) => {
            const type = n.type === 'success' ? 'success' : n.type === 'warning' ? 'warning' : 'info';
            return (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.read) markRead.mutate(n.id);
                  onClose();
                }}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  n.read
                    ? 'bg-zinc-950/40 border-zinc-800/60 opacity-70'
                    : 'bg-zinc-900/80 border-indigo-500/30 hover:border-indigo-500/50'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />}
                  {type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />}
                  {type === 'info' && <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200">{n.title}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{timeAgo(n.created_at)}</span>
                    </div>
                    {n.message && (
                      <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{n.message}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-zinc-950/60 border-t border-zinc-800 text-center text-xs font-mono text-zinc-500">
          AutoML Workspace Alert System
        </div>
      </div>
    </div>
  );
}
