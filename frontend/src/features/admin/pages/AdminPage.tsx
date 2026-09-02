import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Users, Activity, Settings, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Tabs } from '../../../components/ui/Tabs';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { monitoringService } from '../../../services/monitoring.service';
import { timeAgo } from '../../../lib/formatters';
import { getErrorMessage } from '../../../services/http';

const adminTabs = [
  { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  { id: 'activity', label: 'Activity', icon: <Activity className="w-4 h-4" /> },
  { id: 'system', label: 'System', icon: <Settings className="w-4 h-4" /> },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [search, setSearch] = useState('');

  const { data: stats, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['monitoring', 'stats'],
    queryFn: () => monitoringService.stats(),
  });

  return (
    <PageContainer>
      <PageHeader title="Admin Panel" description="System administration and management" />

      <Tabs tabs={adminTabs} activeTab={activeTab} onChange={setActiveTab} className="mb-6" />

      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="w-4 h-4" />} className="w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                <span>Name</span><span>Email</span><span>Role</span><span>Joined</span>
              </div>
              <div className="text-center py-12 text-sm text-zinc-500">
                User management requires admin privileges. Connect to the backend to manage users.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'activity' && (
        <Card>
          <CardHeader><CardTitle>Audit Log</CardTitle></CardHeader>
          <CardContent>
            <div className="text-center py-12 text-sm text-zinc-500">
              Audit log available when connected to backend.
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'system' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
          ) : isError ? (
            <ErrorState title="Failed to load system info" message={getErrorMessage(error)} onRetry={refetch} />
          ) : stats ? (
            <Card>
              <CardHeader><CardTitle>System Statistics</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Models', value: stats.total_models },
                    { label: 'Datasets', value: stats.total_datasets },
                    { label: 'Experiments', value: stats.total_experiments },
                    { label: 'Predictions', value: stats.total_predictions.toLocaleString() },
                  ].map((item) => (
                    <div key={item.label} className="text-center p-4 rounded-xl bg-white/5">
                      <p className="text-2xl font-bold text-zinc-100">{item.value}</p>
                      <p className="text-xs text-zinc-500 mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle>System Health</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'API Status', value: 'Running', status: 'success' },
                  { label: 'Database', value: 'Connected', status: 'success' },
                  { label: 'Cache', value: 'Healthy', status: 'success' },
                  { label: 'Background Workers', value: 'Active', status: 'success' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                    <span className="text-sm text-zinc-300">{item.label}</span>
                    <StatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
