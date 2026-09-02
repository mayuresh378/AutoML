import { useCallback } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';

export function useNotification() {
  const add = useNotificationStore((s) => s.add);
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);

  const notify = useCallback(
    (title: string, message?: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
      add({ title, message, type });
    },
    [add],
  );

  const notifySuccess = useCallback((title: string, message?: string) => notify(title, message, 'success'), [notify]);
  const notifyError = useCallback((title: string, message?: string) => notify(title, message, 'error'), [notify]);
  const notifyWarning = useCallback((title: string, message?: string) => notify(title, message, 'warning'), [notify]);
  const notifyInfo = useCallback((title: string, message?: string) => notify(title, message, 'info'), [notify]);

  return {
    notifications,
    notify,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
    dismiss,
  };
}
