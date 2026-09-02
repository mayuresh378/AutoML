import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../../services/auth.service';
import { useAuthStore } from '../../../store/useAuthStore';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Tabs } from '../../../components/ui/Tabs';
import { motion } from 'framer-motion';
import { User, Shield, Key, Smartphone, Save, AlertCircle } from 'lucide-react';
import { useNotification } from '../../../hooks/useNotification';
import { getErrorMessage } from '../../../services/http';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();
  const { notifySuccess, notifyError } = useNotification();
  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data: sessions, isLoading: sessionsLoading, isError: sessionsError } = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: () => authService.sessions(),
    enabled: activeTab === 'sessions',
  });

  const updateProfile = useMutation({
    mutationFn: (data: { name?: string }) => authService.updateProfile(data),
    onSuccess: (data) => { setUser(data); notifySuccess('Profile updated'); qc.invalidateQueries({ queryKey: ['auth', 'me'] }); },
    onError: (err) => notifyError('Failed to update', getErrorMessage(err)),
  });

  const changePassword = useMutation({
    mutationFn: () => authService.changePassword(currentPassword, newPassword),
    onSuccess: () => { notifySuccess('Password changed'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); },
    onError: (err) => notifyError('Failed to change password', getErrorMessage(err)),
  });

  if (!user) return <PageContainer><LoadingSpinner size="lg" /></PageContainer>;

  return (
    <PageContainer maxWidth="md">
      <PageHeader title="Profile & Settings" description="Manage your account and security" />

      <Tabs
        tabs={[
          { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
          { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
          { id: 'sessions', label: 'Sessions', icon: <Smartphone className="w-4 h-4" /> },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
        {activeTab === 'profile' && (
          <Card>
            <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Email" value={user.email} disabled helperText="Email cannot be changed" />
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="flex gap-2">
                <Input label="Role" value={user.role || 'user'} disabled />
                <Input label="Email Verified" value={user.email_verified ? 'Yes' : 'No'} disabled />
              </div>
              <Button onClick={() => updateProfile.mutate({ name })} loading={updateProfile.isPending} disabled={name === user.name} icon={<Save className="w-4 h-4" />}>
                Save Changes
              </Button>
              {updateProfile.error && <p className="text-sm text-red-400">{getErrorMessage(updateProfile.error)}</p>}
            </CardContent>
          </Card>
        )}

        {activeTab === 'security' && (
          <Card>
            <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} helperText="At least 8 characters with uppercase, lowercase, and number" />
              <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <Button
                onClick={() => changePassword.mutate()}
                loading={changePassword.isPending}
                disabled={!currentPassword || !newPassword || newPassword !== confirmPassword || newPassword.length < 8}
                icon={<Key className="w-4 h-4" />}
              >
                Update Password
              </Button>
            </CardContent>
          </Card>
        )}

        {activeTab === 'sessions' && (
          <Card>
            <CardHeader><CardTitle>Active Sessions</CardTitle></CardHeader>
            <CardContent>
              {sessionsLoading ? <LoadingSpinner /> : sessionsError ? <ErrorState title="Failed to load sessions" onRetry={() => qc.invalidateQueries({ queryKey: ['auth', 'sessions'] })} /> : (
                <div className="space-y-3">
                  {sessions?.sessions?.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                      <div>
                        <p className="text-sm text-zinc-200">{s.device_info || 'Unknown device'}</p>
                        <p className="text-xs text-zinc-500">{s.ip_address || 'Unknown IP'} · {new Date(s.last_active_at).toLocaleDateString()}</p>
                      </div>
                      {s.is_current ? (
                        <span className="text-xs text-emerald-400 font-medium">Current session</span>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => authService.revokeSession(s.id).then(() => qc.invalidateQueries({ queryKey: ['auth', 'sessions'] }))}>Revoke</Button>
                      )}
                    </div>
                  ))}
                  {(!sessions?.sessions || sessions.sessions.length === 0) && <p className="text-sm text-zinc-500 text-center py-4">No active sessions</p>}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>
    </PageContainer>
  );
}
