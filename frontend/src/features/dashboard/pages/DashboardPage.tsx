import { useState } from 'react';
import DashboardHeader from '../components/DashboardHeader';
import MetricCards from '../components/MetricCards';
import QuickActions from '../components/QuickActions';
import TrainingActivity from '../components/TrainingActivity';
import ActivityFeed from '../components/ActivityFeed';
import BestModelSpotlight from '../components/BestModelSpotlight';
import DatasetEcosystem from '../components/DatasetEcosystem';
import AiInsights from '../components/AiInsights';

import GlobalSearchModal from '../components/GlobalSearchModal';
import NotificationsDrawer from '../components/NotificationsDrawer';

export default function DashboardPage() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  return (
    <div className="space-y-6">
      <DashboardHeader
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      />

      <MetricCards />

      <QuickActions />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <TrainingActivity />
          <ActivityFeed />
        </div>

        {/* Side column */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6 min-w-0">
          <BestModelSpotlight />
          <DatasetEcosystem />
          <AiInsights />
        </div>
      </div>

      {/* Modals & Drawers */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <NotificationsDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
    </div>
  );
}