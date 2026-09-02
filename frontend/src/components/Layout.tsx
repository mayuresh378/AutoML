import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PanelLeft,
  LayoutGrid,
  FolderOpen,
  Upload,
  Database,
  Sparkles,
  Wand2,
  BrainCircuit,
  GitCompare,
  Send,
  Package,
  Cloud,
  Zap,
  Users,
  Puzzle,
  Activity,
  Code,
  Shield,
  GitBranch,
  BarChart3,
  History,
  Settings,
  Search,
  Bell,
  ChevronRight,
  Rocket,
  Command,
  CircleUserRound,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutGrid },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { section: 'ML Workflow' },
  { name: 'Upload Dataset', href: '/upload', icon: Upload },
  { name: 'Dataset Explorer', href: '/explorer', icon: Database },
  { name: 'Data Cleaning', href: '/cleaning', icon: Sparkles },
  { name: 'Feature Engineering', href: '/engineering', icon: Wand2 },
  { name: 'Training', href: '/training', icon: BrainCircuit },
  { name: 'Comparison', href: '/comparison', icon: GitCompare },
  { name: 'Predictions', href: '/prediction', icon: Send },
  { section: 'Model Mgmt' },
  { name: 'Model Registry', href: '/models', icon: Package },
  { name: 'Deployments', href: '/deployments', icon: Cloud },
  { name: 'Batch Predictions', href: '/batch', icon: Zap },
  { name: 'Pipelines', href: '/pipelines', icon: GitBranch },
  { section: 'Operations' },
  { name: 'Team', href: '/team', icon: Users },
  { name: 'Integrations', href: '/integrations', icon: Puzzle },
  { name: 'Monitoring', href: '/monitoring', icon: Activity },
  { name: 'API Docs', href: '/api', icon: Code },
  { name: 'Audit Logs', href: '/audit', icon: Shield },
  { name: 'Data Versioning', href: '/versioning', icon: GitBranch },
  { section: 'Analytics' },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'History', href: '/history', icon: History },
  { name: 'Settings', href: '/settings', icon: Settings },
];

function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const dashboardNav = navigation.find((item) => 'href' in item && item.href === '/dashboard') as any;
  const currentPage = (navigation.find((item) => 'href' in item && item.href === location.pathname) as any) ?? dashboardNav ?? { name: 'Dashboard' };

  return (
    <div className="min-h-screen bg-canvas text-slate-100">
      <div className="flex min-h-screen">
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 88 : 280 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="hidden border-r border-border/80 bg-[#0b0f19]/90 px-4 py-5 backdrop-blur-xl lg:flex lg:flex-col"
        >
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-glow">
                <Rocket className="h-5 w-5" />
              </div>
              {!collapsed && <div><p className="text-sm font-semibold">AutoML Cloud</p><p className="text-xs text-slate-400">Enterprise AI</p></div>}
            </div>
            <button
              onClick={() => setCollapsed((prev) => !prev)}
              className="rounded-xl border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-300">
            <Search className="h-4 w-4" />
            {!collapsed && <span>Search workspace</span>}
          </div>

          <nav className="space-y-1">
            {navigation.map((item) => {
              if ('section' in item && item.section) {
                return (
                  <div key={item.section} className="px-3 py-4">
                    {!collapsed && <p className="text-xs font-semibold uppercase text-slate-500">{item.section}</p>}
                  </div>
                );
              }
              const item2 = item as any;
              if (!item2.icon || !item2.href) return null;
              const Icon = item2.icon;
              return (
                <NavLink
                  key={item2.href}
                  to={item2.href}
                  className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition ${isActive ? 'bg-white/10 text-white shadow-glow' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon className="h-4 w-4" />
                  {!collapsed && <span>{item2.name}</span>}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
              <Command className="h-4 w-4 text-accent" />
              {!collapsed && <span>AI Copilot</span>}
            </div>
            {!collapsed && <p className="text-sm text-slate-400">Use natural language to guide your next experiment.</p>}
          </div>
        </motion.aside>

        <div className="flex-1">
          <header className="sticky top-0 z-20 border-b border-border/80 bg-canvas/80 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
                  <span className="text-slate-200">Workspace</span>
                  <ChevronRight className="h-4 w-4" />
                  <span>{currentPage.name}</span>
                </div>
                <h1 className="text-xl font-semibold text-white">{currentPage.name}</h1>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <button className="rounded-2xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white">
                  <Bell className="h-4 w-4" />
                </button>
                <button className="rounded-2xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white">
                  <Command className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent">
                    <CircleUserRound className="h-5 w-5" />
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium">Alicia Chen</p>
                    <p className="text-xs text-slate-400">Principal ML Lead</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default Layout;
