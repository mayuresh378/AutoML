import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Bell, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import {
  useHealthCheck,
  useMonitoringDashboard,
  useUnreadNotificationCount,
} from '../../../hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';

interface DashboardHeaderProps {
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onOpenWizard: () => void;
}

export default function DashboardHeader({
  onOpenSearch,
  onOpenNotifications,
  onOpenWizard,
}: DashboardHeaderProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const healthCheck = useHealthCheck();
  const monitoringDashboard = useMonitoringDashboard();
  const unreadCountQuery = useUnreadNotificationCount();

  const [now, setNow] = useState(() => new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setNow(new Date());
    }, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const healthOnline =
    healthCheck.isSuccess && (healthCheck.data?.status === 'ok' || healthCheck.data?.status === 'healthy');
  const redisHealthy = healthCheck.data?.data?.redis_status === 'connected';
  const dbConnected = healthCheck.data?.data?.database === 'connected';
  const serviceCount = [dbConnected, redisHealthy, true].filter(Boolean).length;
  const allOperational = healthOnline && dbConnected;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['experiments'] });
    queryClient.invalidateQueries({ queryKey: ['datasets'] });
    queryClient.invalidateQueries({ queryKey: ['models'] });
    queryClient.invalidateQueries({ queryKey: ['deployments'] });
    queryClient.invalidateQueries({ queryKey: ['activity'] });
    queryClient.invalidateQueries({ queryKey: ['training'] });
    queryClient.invalidateQueries({ queryKey: ['monitoring'] });
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
    queryClient.invalidateQueries({ queryKey: ['health'] });
  };

  const firstName = user?.name?.split(' ')[0] || '';
  const initials = (user?.name || 'Guest').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4 pb-1"
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Dashboard
            {firstName ? <span className="text-zinc-500 font-normal"> · {firstName}</span> : null}
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">Your machine learning workspace at a glance.</p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Trigger */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
            <span className="ml-1 px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-500">
              Ctrl K
            </span>
          </button>

          {/* Notifications Trigger */}
          <button
            onClick={onOpenNotifications}
            className="relative p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCountQuery.data && unreadCountQuery.data > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-indigo-500 text-[9px] font-bold text-white">
                {unreadCountQuery.data > 99 ? '99+' : unreadCountQuery.data}
              </span>
            )}
          </button>

          {/* Refresh */}
          <motion.button
            whileHover={{ rotate: 90 }}
            whileTap={{ scale: 0.9 }}
            onClick={refreshAll}
            title="Refresh all dashboard data"
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </motion.button>

          {/* Live/connected status with API latency */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono ${
              allOperational
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : healthOnline
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
            title={
              allOperational
                ? `All systems operational · ${serviceCount}/3 services online`
                : healthOnline
                  ? 'Workspace operational, some services degraded'
                  : 'Workspace connection issues'
            }
          >
            {healthOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{healthOnline ? 'Live' : 'Offline'}</span>
            {monitoringDashboard.data && (
              <span className="text-zinc-500 hidden md:inline">
                · {monitoringDashboard.data.latency?.avg != null ? `${Math.round(monitoringDashboard.data.latency.avg)}ms` : ''}
              </span>
            )}
          </div>

          {/* Time */}
          <span className="text-xs font-mono text-zinc-500 hidden lg:inline">
            {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>

          {/* Avatar */}
          <motion.div
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/app/settings')}
            title={user?.name || 'Guest'}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-black bg-white cursor-pointer"
          >
            {initials}
          </motion.div>
        </div>
      </motion.div>

      {/* Status strip */}
      {healthCheck.isSuccess && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2 rounded-lg bg-zinc-900/40 border border-zinc-800/70 text-xs font-mono"
        >
          <span className={`flex items-center gap-1.5 font-medium ${allOperational ? 'text-emerald-400' : 'text-amber-400'}`}>
            <span className="relative flex h-2 w-2">
              {allOperational && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${allOperational ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            {allOperational ? 'Workspace operational' : 'Workspace degraded'}
          </span>

          {dbConnected && (
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>Database connected</span>
            </span>
          )}
          {!dbConnected && (
            <span className="flex items-center gap-1.5 text-zinc-400">
              <WifiOff className="w-3 h-3 text-rose-400" />
              <span>Database disconnected</span>
            </span>
          )}

          {redisHealthy && (
            <span className="flex items-center gap-1.5 text-zinc-400">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>Redis connected</span>
            </span>
          )}

          {monitoringDashboard.data?.latency?.avg != null && (
            <span className="text-zinc-400">
              API latency <span className="text-zinc-200 font-semibold">{Math.round(monitoringDashboard.data.latency.avg)}ms</span>
            </span>
          )}

          {allOperational ? (
            <span className="flex items-center gap-1 text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              All systems operational
            </span>
          ) : (
            <span className="text-zinc-400">Some systems degraded</span>
          )}

          <span className="text-zinc-500 ml-auto">
            Updated {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </motion.div>
      )}
    </>
  );
}