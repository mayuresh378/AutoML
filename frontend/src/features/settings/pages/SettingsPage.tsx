import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../hooks/useAuth';
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '../../../hooks/useApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '../../../services/auth.service';
import {
  User,
  Key,
  Bell,
  CreditCard,
  Users,
  Briefcase,
  Copy,
  Check,
  Trash2,
  Building2,
  Globe,
  Mail,
  MessageSquare,
  Smartphone,
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import type { ApiKey } from '../../../types/api';
import styles from './SettingsPage.module.css';

type Section = 'profile' | 'workspace' | 'api-keys' | 'notifications' | 'billing' | 'members';

const sections: { id: Section; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'profile', label: 'Profile', icon: <User /> },
  { id: 'workspace', label: 'Workspace', icon: <Briefcase /> },
  { id: 'api-keys', label: 'API Keys', icon: <Key /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell /> },
  { id: 'billing', label: 'Billing', icon: <CreditCard /> },
  { id: 'members', label: 'Members', icon: <Users /> },
];

const notificationEvents = [
  { id: 'training', name: 'Training Complete', desc: 'When a training job finishes' },
  { id: 'deployment', name: 'Deployment Status', desc: 'When a deployment changes state' },
  { id: 'experiment', name: 'Experiment Results', desc: 'When an experiment completes' },
  { id: 'alerts', name: 'System Alerts', desc: 'When system resources are critical' },
  { id: 'pipeline', name: 'Pipeline Runs', desc: 'When a pipeline run completes' },
];

const sectionVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        className={styles.toggleInput}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.toggleTrack} />
      <span className={styles.toggleThumb} />
    </label>
  );
}

function ApiKeyRow({ apiKey, onDelete }: { apiKey: ApiKey; onDelete: (id: string) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey.key_prefix).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isActive = true;

  return (
    <div className={styles.apiKeyRow}>
      <div className={styles.apiKeyInfo}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span className={styles.apiKeyName}>{apiKey.name}</span>
          <span className={`${styles.statusBadge} ${isActive ? styles.statusActive : styles.statusInactive}`}>
            <span className={styles.statusDot} />
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div className={styles.apiKeyValue}>
          <span className={styles.apiKeyMasked}>{apiKey.key_prefix}...••••••••</span>
        </div>
      </div>
      <div className={styles.apiKeyActions}>
        <span className={styles.apiKeyDate}>Created {apiKey.created_at}</span>
        <button className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ''}`} onClick={handleCopy} title="Copy key">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        <button className={styles.deleteBtn} title="Delete key" onClick={() => onDelete(apiKey.id)}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function ProfileSection() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authService.updateProfile({ name });
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <Card>
      <div className={styles.profileHeader}>
        <div className={styles.avatar}>{initials}</div>
        <div className={styles.avatarInfo}>
          <span className={styles.avatarName}>{user?.name || 'User'}</span>
          <span className={styles.avatarEmail}>{user?.email || ''}</span>
          <span className={styles.avatarRole}>{user?.role || 'User'}</span>
        </div>
      </div>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Name</label>
          <input
            className={styles.formInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Email</label>
          <input className={styles.formInput} type="email" defaultValue={user?.email || ''} disabled />
        </div>
      </div>
      <div className={styles.formActions}>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </Card>
  );
}

function WorkspaceSection() {
  return (
    <Card>
      <div className={styles.workspaceHeader}>
        <div className={styles.workspaceIcon}>
          <Building2 />
        </div>
        <div className={styles.workspaceInfo}>
          <span className={styles.workspaceName}>Acme AI</span>
          <span className={styles.workspacePlan}>Pro Plan · 5 seats</span>
        </div>
      </div>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Workspace Name</label>
          <input className={styles.formInput} defaultValue="Acme AI" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Workspace URL</label>
          <input className={styles.formInput} defaultValue="acme-ai" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Industry</label>
          <input className={styles.formInput} defaultValue="Artificial Intelligence" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Team Size</label>
          <input className={styles.formInput} defaultValue="12" />
        </div>
        <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
          <label className={styles.formLabel}>Default Region</label>
          <input className={styles.formInput} defaultValue="us-east-1" />
          <span className={styles.formHelper}>Region where new compute resources will be provisioned.</span>
        </div>
      </div>
      <div className={styles.formActions}>
        <button className={`${styles.btn} ${styles.btnSecondary}`}>Cancel</button>
        <button className={`${styles.btn} ${styles.btnPrimary}`}>Save Changes</button>
      </div>
    </Card>
  );
}

function ApiKeysSection() {
  const { data: apiKeys = [] } = useApiKeys();
  const createKey = useCreateApiKey();
  const deleteKey = useDeleteApiKey();
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    const name = prompt('Enter a name for the new API key:');
    if (name) {
      await createKey.mutateAsync(name);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this API key?')) {
      await deleteKey.mutateAsync(id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Keys</CardTitle>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          style={{ fontSize: 'var(--text-caption)' }}
          onClick={handleCreate}
        >
          <Key size={14} /> Create Key
        </button>
      </CardHeader>
      <CardContent style={{ padding: 0 }}>
        {apiKeys && apiKeys.length > 0 ? (
          apiKeys.map((key: ApiKey) => (
            <ApiKeyRow key={key.id} apiKey={key} onDelete={handleDelete} />
          ))
        ) : (
          <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No API keys yet. Create one to get started.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationsSection() {
  const [channels, setChannels] = useState({
    email: true,
    slack: true,
    inApp: false,
  });
  const [events, setEvents] = useState<Record<string, { email: boolean; slack: boolean; inApp: boolean }>>({
    training: { email: true, slack: true, inApp: true },
    deployment: { email: true, slack: false, inApp: true },
    experiment: { email: false, slack: true, inApp: true },
    alerts: { email: true, slack: true, inApp: true },
    pipeline: { email: false, slack: false, inApp: true },
  });

  const toggleEvent = (eventId: string, channel: 'email' | 'slack' | 'inApp') => {
    setEvents((prev) => ({
      ...prev,
      [eventId]: { ...prev[eventId], [channel]: !prev[eventId][channel] },
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
        </CardHeader>
        <CardContent style={{ padding: 0 }}>
          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Mail size={16} /> Email Notifications
                </span>
              </span>
              <span className={styles.toggleDescription}>Receive notifications via email</span>
            </div>
            <Toggle checked={channels.email} onChange={(v) => setChannels((p) => ({ ...p, email: v }))} />
          </div>
          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <MessageSquare size={16} /> Slack Notifications
                </span>
              </span>
              <span className={styles.toggleDescription}>Send notifications to a Slack channel</span>
            </div>
            <Toggle checked={channels.slack} onChange={(v) => setChannels((p) => ({ ...p, slack: v }))} />
          </div>
          <div className={styles.toggleRow}>
            <div className={styles.toggleInfo}>
              <span className={styles.toggleLabel}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Smartphone size={16} /> In-App Notifications
                </span>
              </span>
              <span className={styles.toggleDescription}>Show notifications inside the dashboard</span>
            </div>
            <Toggle checked={channels.inApp} onChange={(v) => setChannels((p) => ({ ...p, inApp: v }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Notifications</CardTitle>
        </CardHeader>
        <CardContent style={{ padding: 0 }}>
          <div className={styles.notificationGrid}>
            <div className={styles.notificationHeader}>
              <div className={styles.notificationHeaderCell}>Event</div>
              <div className={styles.notificationHeaderCell}>
                <Mail size={14} />
              </div>
              <div className={styles.notificationHeaderCell}>
                <MessageSquare size={14} />
              </div>
              <div className={styles.notificationHeaderCell}>
                <Globe size={14} />
              </div>
            </div>
            {notificationEvents.map((evt) => (
              <div key={evt.id} className={styles.notificationRow}>
                <div className={styles.notificationCell}>
                  <div>
                    <div className={styles.notificationEventName}>{evt.name}</div>
                    <div className={styles.notificationEventDesc}>{evt.desc}</div>
                  </div>
                </div>
                <div className={styles.notificationCell}>
                  <Toggle
                    checked={events[evt.id]?.email ?? false}
                    onChange={() => toggleEvent(evt.id, 'email')}
                  />
                </div>
                <div className={styles.notificationCell}>
                  <Toggle
                    checked={events[evt.id]?.slack ?? false}
                    onChange={() => toggleEvent(evt.id, 'slack')}
                  />
                </div>
                <div className={styles.notificationCell}>
                  <Toggle
                    checked={events[evt.id]?.inApp ?? false}
                    onChange={() => toggleEvent(evt.id, 'inApp')}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BillingSection() {
  return (
    <Card>
      <div className={styles.billingPlan}>
        <div className={styles.planInfo}>
          <span className={styles.planName}>Pro Plan</span>
          <span className={styles.planPrice}>
            <strong>$49</strong> /month · billed annually
          </span>
        </div>
        <button className={`${styles.btn} ${styles.btnPrimary}`}>Upgrade Plan</button>
      </div>
      <div className={styles.billingUsage}>
        <div className={styles.usageHeader}>
          <span className={styles.usageLabel}>Compute Hours</span>
          <span className={styles.usageValue}>342 / 500 hours</span>
        </div>
        <div className={styles.usageBar}>
          <div className={styles.usageFill} style={{ width: '68.4%' }} />
        </div>
      </div>
      <div className={styles.billingUsage}>
        <div className={styles.usageHeader}>
          <span className={styles.usageLabel}>Storage</span>
          <span className={styles.usageValue}>12.4 GB / 50 GB</span>
        </div>
        <div className={styles.usageBar}>
          <div className={styles.usageFill} style={{ width: '24.8%' }} />
        </div>
      </div>
      <div className={styles.billingUsage}>
        <div className={styles.usageHeader}>
          <span className={styles.usageLabel}>API Requests</span>
          <span className={styles.usageValue}>84,291 / 100,000</span>
        </div>
        <div className={styles.usageBar}>
          <div className={styles.usageFill} style={{ width: '84.3%', background: 'var(--color-warning)' }} />
        </div>
      </div>
    </Card>
  );
}

function MembersSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <button className={`${styles.btn} ${styles.btnPrimary}`} style={{ fontSize: 'var(--text-caption)' }}>
          <Users size={14} /> Invite
        </button>
      </CardHeader>
      <CardContent style={{ padding: 0 }}>
        <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          Members management coming soon.
        </div>
      </CardContent>
    </Card>
  );
}

const sectionComponents: Record<Section, React.FC> = {
  profile: ProfileSection,
  workspace: WorkspaceSection,
  'api-keys': ApiKeysSection,
  notifications: NotificationsSection,
  billing: BillingSection,
  members: MembersSection,
};

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<Section>('profile');
  const ActiveContent = sectionComponents[activeSection];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Settings</h1>
        <p className={styles.pageDescription}>Manage your account, workspace, and integrations.</p>
      </div>

      <div className={styles.layout}>
        <nav className={styles.sidebar}>
          {sections.map((section) => (
            <button
              key={section.id}
              className={`${styles.navItem} ${activeSection === section.id ? styles.navItemActive : ''}`}
              onClick={() => setActiveSection(section.id)}
            >
              <span className={styles.navIcon}>{section.icon}</span>
              {section.label}
              {section.badge && (
                <span className={styles.navBadge}>{section.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className={styles.sectionContent}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <ActiveContent />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
