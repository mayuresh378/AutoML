import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Sparkles, Plus, Upload, Command } from 'lucide-react';
import { useDashboardData, useMonitoringMetrics } from '../../../hooks/useApi';

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

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const { experiments, models, datasets, deployments, isLoading, isError } = useDashboardData();
  const { data: metrics } = useMonitoringMetrics();

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
            Good evening, Mayuresh <span className="text-xl">👋</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Here's what's happening with your ML workspace today.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
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
      <WorkspaceStatusBanner />

      {/* Recommended Actions */}
      <RecommendedActions />

      {/* Rich KPI Metric Cards */}
      <KpiCardsV2 data={kpiData} />

      {/* Active Running Training Jobs */}
      <RunningJobs />

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          <ExperimentPerformanceChart />
          <RecentExperimentsTable experiments={experiments} />
        </div>

        {/* Right Column (1 Col wide) */}
        <div className="space-y-6">
          <BestModelSpotlight />
          <DatasetHealthWidget />
          <AiInsights />
          <SystemTelemetryCard metrics={metrics} />
        </div>
      </div>

      {/* Modals & Drawers */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <NotificationsDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
      <NewExperimentWizardModal isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </div>
  );
}
