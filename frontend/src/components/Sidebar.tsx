import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import styles from './Sidebar.module.css';

type NavItem = { label: string; path: string; icon: string; prefix?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Home',
    items: [{ label: 'Dashboard', path: '/app/dashboard', icon: 'LayoutDashboard' }],
  },
  {
    label: 'Workspace',
    items: [{ label: 'Projects', path: '/app/projects', icon: 'Folder', prefix: true }],
  },
  {
    label: 'Data',
    items: [
      { label: 'Datasets', path: '/app/datasets', icon: 'Database' },
      { label: 'Data Explorer', path: '/app/explorer', icon: 'Table' },
      { label: 'SQL Studio', path: '/app/sql', icon: 'FileCode' },
      { label: 'Data Profiling', path: '/app/profiling', icon: 'PieChart' },
      { label: 'Data Cleaning', path: '/app/cleaning', icon: 'Eraser' },
    ],
  },
  {
    label: 'Feature Engineering',
    items: [{ label: 'Feature Engineering', path: '/app/feature-engineering', icon: 'Wrench' }],
  },
  {
    label: 'Machine Learning',
    items: [
      { label: 'AutoML', path: '/app/engine', icon: 'Zap' },
      { label: 'Training', path: '/app/training', icon: 'Brain' },
      { label: 'Hyperparameter Tuning', path: '/app/hpo', icon: 'Sliders' },
      { label: 'Experiments', path: '/app/experiments', icon: 'FlaskConical' },
      { label: 'Pipeline Builder', path: '/app/pipelines', icon: 'GitBranch' },
    ],
  },
  {
    label: 'Models',
    items: [
      { label: 'Evaluation', path: '/app/evaluation', icon: 'BarChart3' },
      { label: 'Explain AI', path: '/app/explain', icon: 'Sparkles' },
      { label: 'Model Registry', path: '/app/models', icon: 'Layers' },
      { label: 'Model Comparison', path: '/app/model-comparison', icon: 'GridCompare' },
    ],
  },
  {
    label: 'Production',
    items: [
      { label: 'Deployment', path: '/app/deployments', icon: 'Rocket' },
      { label: 'Batch Prediction', path: '/app/prediction', icon: 'Send' },
      { label: 'Monitoring', path: '/app/monitoring', icon: 'Activity' },
    ],
  },
  {
    label: 'AI',
    items: [{ label: 'AI Copilot', path: '/app/ai', icon: 'Bot' }],
  },
  {
    label: 'Admin',
    items: [{ label: 'Settings', path: '/app/settings', icon: 'Settings' }],
  },
];

function buildWorkspaceNav(projectId: string): NavGroup[] {
  const base = `/app/projects/${projectId}`;
  return [
    {
      label: 'Home',
      items: [{ label: 'Dashboard', path: '/app/dashboard', icon: 'LayoutDashboard' }],
    },
    {
      label: 'Workspace',
      items: [{ label: 'Projects', path: '/app/projects', icon: 'Folder', prefix: true }],
    },
    {
      label: 'Project',
      items: [{ label: 'Overview', path: `${base}/overview`, icon: 'LayoutDashboard' }],
    },
    {
      label: 'Data',
      items: [
        { label: 'Datasets', path: `${base}/data/datasets`, icon: 'Database' },
        { label: 'Data Explorer', path: `${base}/data/explorer`, icon: 'Table' },
        { label: 'SQL Studio', path: `${base}/data/sql`, icon: 'FileCode' },
        { label: 'Data Profiling', path: `${base}/data/profiling`, icon: 'PieChart' },
        { label: 'Data Cleaning', path: `${base}/data/cleaning`, icon: 'Eraser' },
        { label: 'Feature Engineering', path: `${base}/data/features`, icon: 'Wrench' },
      ],
    },
    {
      label: 'ML',
      items: [
        { label: 'AutoML', path: `${base}/ml/automl`, icon: 'Zap' },
        { label: 'Training', path: `${base}/ml/training`, icon: 'Brain' },
        { label: 'Hyperparameter Tuning', path: `${base}/ml/hpo`, icon: 'Sliders' },
        { label: 'Experiments', path: `${base}/ml/experiments`, icon: 'FlaskConical' },
        { label: 'Leaderboard', path: `${base}/ml/leaderboard`, icon: 'Trophy' },
      ],
    },
    {
      label: 'Models',
      items: [
        { label: 'Model Registry', path: `${base}/models/registry`, icon: 'Layers' },
        { label: 'Evaluation', path: `${base}/models/evaluation`, icon: 'BarChart3' },
        { label: 'Explain AI', path: `${base}/models/explain`, icon: 'Sparkles' },
        { label: 'Model Comparison', path: `${base}/models/comparison`, icon: 'GridCompare' },
      ],
    },
    {
      label: 'Production',
      items: [
        { label: 'Deployment', path: `${base}/production/deployment`, icon: 'Rocket' },
        { label: 'Monitoring', path: `${base}/production/monitoring`, icon: 'Activity' },
        { label: 'Batch Prediction', path: `${base}/production/batch`, icon: 'Send' },
      ],
    },
    {
      label: 'General',
      items: [{ label: 'AI Copilot', path: '/app/ai', icon: 'Bot' }, { label: 'Settings', path: '/app/settings', icon: 'Settings' }],
    },
  ];
}

const iconComponents: Record<string, string> = {
  LayoutDashboard: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  Folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  Database: 'M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3M4 7v6c0 1.657 3.582 3 8 3s8-1.343 8-3V7M4 13v4c0 1.657 3.582 3 8 3s8-1.343 8-3v-4',
  Table: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  FileCode: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6M10 13l-2 2 2 2M14 17l2-2-2-2',
  PieChart: 'M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z',
  Eraser: 'M7 21h14M21 21H7m0 0l-3.3-3.3a1 1 0 010-1.4L12 7.6l8.3 8.3a1 1 0 010 1.4L17 21M12 7.6l4.6-4.6a1 1 0 011.4 0l3 3a1 1 0 010 1.4L16.6 12',
  Wrench: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  Zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  Brain: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707M2 12h1m15.657 5.657l.707.707M12 20v1M12 3a9 9 0 00-9 9c0 2.1.72 4.03 1.93 5.56L6 20l2.07-1.44A8.97 8.97 0 0012 21a9 9 0 009-9 9 9 0 00-9-9z',
  Sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  FlaskConical: 'M6 2h12v2l-4 6v8h-4v-8L6 4V2zM6 2v2l4 6',
  GitBranch: 'M6 3v12M6 3a3 3 0 11-6 0 3 3 0 016 0zM18 9a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9M6 21a3 3 0 100-6 3 3 0 000 6z',
  BarChart3: 'M18 20V10M12 20V4M6 20v-6',
  Sparkles: 'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17zM17 17l.5 1.5L19 19l-1.5.5L17 21l-.5-1.5L15 19l1.5-.5L17 17z',
  Layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  GridCompare: 'M3 3h7v7H3zM14 14h7v7h-7zM14 3v7M3 14v7',
  Rocket: 'M15.59 14.37a6 6 0 01-5.84 4.63 6 6 0 01-5.84-4.63M15.59 14.37a22 22 0 014.78-5.65A8.01 8.01 0 0014 2a22 22 0 00-5.65 4.78M15.59 14.37a6 6 0 01-.82 2.52 6 6 0 01-2 2 6 6 0 01-2.52.82m0 0a6 6 0 01-2.52-.82 6 6 0 01-2-2 6 6 0 01-.82-2.52M9 12a3 3 0 113 3 3 3 0 01-3-3z',
  Send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  Activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  Bot: 'M12 8V4M8 4h8M4 8h16a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6a2 2 0 012-2zM8 14h.01M16 14h.01',
  Trophy: 'M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z',
  Settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={iconComponents[name] || ''} />
    </svg>
  );
}

export default function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  const projectMatch = location.pathname.match(/^\/app\/projects\/([^/]+)/);
  const groups = projectMatch ? buildWorkspaceNav(projectMatch[1]) : NAV_GROUPS;

  const userName = user?.name || 'Guest';
  const initials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <LogoIcon />
          <span className={styles.brand}>AutoML</span>
        </div>
      </div>

      <nav className={styles.nav}>
        {groups.map((group) => (
          <div key={group.label} className={styles.group}>
            <span className={styles.groupLabel}>{group.label}</span>
            {group.items.map((item) => {
              const isActive = item.prefix
                ? location.pathname.startsWith(item.path)
                : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className={styles.indicator}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.user}>
          <div className={styles.avatar}>{initials}</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{userName}</span>
            <span className={styles.userRole}>{user?.email || 'Guest'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function LogoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <path d="M7 12h10M12 7v10" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
