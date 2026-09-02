import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

export interface Notification {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'info' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
}

let _counter = 0;
function uid() { return `n_${++_counter}_${Date.now()}`; }

interface NotificationState {
  notifications: Notification[];
  add: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  unreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  add: (n) => set((s) => ({
    notifications: [{ id: uid(), timestamp: Date.now(), read: false, ...n }, ...s.notifications].slice(0, 50),
  })),
  markRead: (id) => set((s) => ({
    notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
  })),
  markAllRead: () => set((s) => ({
    notifications: s.notifications.map((n) => ({ ...n, read: true })),
  })),
  dismiss: (id) => set((s) => ({
    notifications: s.notifications.filter((n) => n.id !== id),
  })),
  clearAll: () => set({ notifications: [] }),
  unreadCount: () => get().notifications.filter((n) => !n.read).length,
}));

export function useUnreadCount() {
  return useNotificationStore(useShallow((s) => s.notifications.filter((n) => !n.read).length));
}

export function useNotificationActions() {
  return useNotificationStore(useShallow((s) => ({
    add: s.add,
    markRead: s.markRead,
    markAllRead: s.markAllRead,
    dismiss: s.dismiss,
    clearAll: s.clearAll,
  })));
}
