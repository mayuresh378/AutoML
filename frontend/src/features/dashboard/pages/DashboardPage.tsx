import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Plus, Upload, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useDashboardData } from '../../../hooks/useApi';
import { useAuthStore } from '../../../store/useAuthStore';

import WorkspaceStatusBanner from '../components/WorkspaceStatusBanner';
import RecommendedActions from '../components/RecommendedActions';
import KpiCardsV2 from '../components/KpiCardsV2';
import RunningJobs from '../components/RunningJobs';
import RecentExperimentsTable from '../components/RecentExperimentsTable';
import BestModelSpotlight from '../components/BestModelSpotlight';
import DatasetHealthWidget from '../components/DatasetHealthWidget';
import AiInsights from '../components/AiInsights';
import ExperimentPerformanceChart from '../components/ExperimentPerformanceChart';
import SystemTelemetryCard from '../components/SystemTelemetryCard';

import GlobalSearchModal from '../components/GlobalSearchModal';
import NotificationsDrawer from '../components/NotificationsDrawer';
import NewExperimentWizardModal from '../components/NewExperimentWizardModal';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const {
    experiments,
    models,
    datasets,
    deployments,
    monitoringStats,
    monitoringDashboard,
    trainingQueue,
    unreadCount,
    aiSuggestions,
    healthCheck,
    isLoading,
    isError,
    isFetching,
  } = useDashboardData();

  const firstName = user?.name?.split(' ')[0] || 'there';
  const isOnline = !isError && healthCheck !== null;
  const lastUpdated = new Date();

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-16 rounded-xl bg-zinc-900/60 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-zinc-900/60 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 h-80 rounded-xl bg-zinc-900/60 animate-pulse" />
          <div className="h-80 rounded-xl bg-zinc-900/60 animate-pulse" />
        </div>
      </div>
    );
  }

  const kpiData = {
    experimentsCount: (experiments || []).length,
    datasetsCount: (datasets || []).length,
    modelsCount: (models || []).length,
    deploymentsCount: (deployments || []).length,
    completedCount: (experiments || []).filter((e: any) => e.status === 'completed' || e.status === 'success').length,
    runningCount: (experiments || []).filter((e: any) => e.status === 'running' || e.status === 'queued').length,
    failedCount: (experiments || []).filter((e: any) => e.status === 'failed').length,
    healthyDatasets: (datasets || []).filter((d: any) => d.status === 'ready' || d.status === 'uploaded').length,
    needsAttentionDatasets: (datasets || []).filter((d: any) => d.status === 'error' || d.status === 'processing').length,
    bestAccuracy: metricsValue(models, 'cv_score', null),
    healthyDeployments: (deployments || []).filter((d: any) => d.status === 'running' || d.status === 'active').length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Welcome Bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4 pb-2"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            Good evening, {firstName} <span className="text-xl">👋</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Here's what's happening with your ML workspace today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Live/Connected Indicator + Last Updated */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </>
            )}
            <span className="text-zinc-500 hidden sm:inline">
              · {lastUpdated.toLocaleTimeString()}
            </span>
            {isFetching && <RefreshCw className="w-3 h-3 animate-spin" />}
          </div>

          {/* Search Trigger */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search...</span>
            <span className="ml-2 px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-500">
              Ctrl+K
            </span>
          </button>

          {/* Notifications Trigger */}
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="relative p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-indigo-500 text-[9px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Quick CTAs */}
          <button
            onClick={() => navigate('/app/datasets')}
            className="px-3.5 py-2 rounded-lg text-xs font-medium bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-200 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Dataset</span>
          </button>

          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Experiment</span>
          </button>
        </div>
      </motion.div>

      {/* Workspace Status Banner */}
      <WorkspaceStatusBanner
        completedTodayCount={stats_completed_today(experiments)}
        readyModelCount={(models || []).filter((m: any) => m.status === 'ready' || m.status === 'production').length}
        attentionDatasetCount={(datasets || []).filter((d: any) => d.status === 'error').length}
        online={isOnline}
      />

      {/* Recommended Actions */}
      <RecommendedActions experiments={experiments} datasets={datasets} models={models} aiSuggestions={aiSuggestions} />

      {/* Rich KPI Metric Cards */}
      <KpiCardsV2 data={kpiData} stats={monitoringStats} />

      {/* Active Running Training Jobs */}
      <RunningJobs jobs={trainingQueue} />

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          <ExperimentPerformanceChart experiments={experiments} />
          <RecentExperimentsTable experiments={experiments} />
        </div>

        {/* Right Column (1 Col wide) */}
        <div className="space-y-6">
          <BestModelSpotlight models={models} />
          <DatasetHealthWidget datasets={datasets} />
          <AiInsights suggestions={aiSuggestions} />
          <SystemTelemetryCard metrics={monitoringDashboard} healthCheck={healthCheck} />
        </div>
      </div>

      {/* Modals & Drawers */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <NotificationsDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
      <NewExperimentWizardModal isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </div>
  );
}

function stats_completed_today(experiments: any[]) {
  if (!experiments?.length) return 0;
  const now = new Date();
  return experiments.filter((e: any) => {
    const created = e.created_at || e.run_at;
    if (!created) return false;
    const d = new Date(created);
    return (e.status === 'completed' || e.status === 'success') &&
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  }).length;
}

function metricsValue(items: any[], key: string, fallback: any) {
  if (!items?.length) return fallback;
  for (const item of items) {
    if (item[key] !== null && item[key] !== undefined) return item[key];
  }
  return fallback;
}
