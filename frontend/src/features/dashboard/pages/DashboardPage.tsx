import { useState } from 'react';
import DashboardHeader from '../components/DashboardHeader';
import MetricCards from '../components/MetricCards';
import QuickActions from '../components/QuickActions';
import TrainingActivity from '../components/TrainingActivity';
import ExperimentPerformanceChart from '../components/ExperimentPerformanceChart';
import RecentExperimentsTable from '../components/RecentExperimentsTable';
import ActivityFeed from '../components/ActivityFeed';
import BestModelSpotlight from '../components/BestModelSpotlight';
import DatasetEcosystem from '../components/DatasetEcosystem';
import ProductionDeployments from '../components/ProductionDeployments';
import AiInsights from '../components/AiInsights';
import SystemMonitoring from '../components/SystemMonitoring';

import GlobalSearchModal from '../components/GlobalSearchModal';
import NotificationsDrawer from '../components/NotificationsDrawer';
import NewExperimentWizardModal from '../components/NewExperimentWizardModal';

export default function DashboardPage() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  return (
    <div className="space-y-6">
      <DashboardHeader
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenWizard={() => setIsWizardOpen(true)}
      />

      <MetricCards />

      <QuickActions onNewExperiment={() => setIsWizardOpen(true)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <TrainingActivity />
          <ExperimentPerformanceChart />
          <RecentExperimentsTable />
          <ActivityFeed />
        </div>

        {/* Side column */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6 min-w-0">
          <BestModelSpotlight />
          <DatasetEcosystem />
          <ProductionDeployments />
          <AiInsights />
          <SystemMonitoring />
        </div>
      </div>

      {/* Modals & Drawers */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <NotificationsDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
      <NewExperimentWizardModal isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </div>
  );
}