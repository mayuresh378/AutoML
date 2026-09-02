import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Copy, Pencil, Archive, Trash2, Target, TrendingUp, LineChart, Boxes,
  LayoutDashboard, Database, BarChart3, Sparkles, Terminal, BrainCircuit, GraduationCap,
  SlidersHorizontal, FlaskConical, Gauge, Lightbulb, Package, Rocket, Activity, Settings,
  Clock, User, Globe, UserRound, Users, Table, Trophy, GitCompare, Send, Zap,
} from 'lucide-react';
import { projectsService } from '../../../services/projects.service';
import { useUIStore } from '../../../store/useUIStore';
import { PageContainer } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Dialog } from '../../../components/ui/Dialog';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useNotification } from '../../../hooks/useNotification';
import { timeAgo } from '../../../lib/formatters';
import { getErrorMessage } from '../../../services/http';
import type { Project } from '../../../types/api';
import styles from './ProjectDetailPage.module.css';
import ws from './ProjectWorkspace.module.css';

const PROBLEM_ICONS: Record<string, React.ReactNode> = {
  classification: <Target className="w-6 h-6" />,
  regression: <TrendingUp className="w-6 h-6" />,
  time_series: <LineChart className="w-6 h-6" />,
  clustering: <Boxes className="w-6 h-6" />,
};

type SubItem = { label: string; path: string; icon: React.ElementType };
type NavGroup = { key: string; label: string; path: string; icon: React.ElementType; items?: SubItem[] };

const NAV_GROUPS: NavGroup[] = [
  { key: 'overview', label: 'Overview', path: 'overview', icon: LayoutDashboard },
  {
    key: 'data',
    label: 'Data',
    path: 'data',
    icon: Database,
    items: [
      { label: 'Datasets', path: 'data/datasets', icon: Database },
      { label: 'Data Explorer', path: 'data/explorer', icon: Table },
      { label: 'SQL Studio', path: 'data/sql', icon: Terminal },
      { label: 'Data Profiling', path: 'data/profiling', icon: BarChart3 },
      { label: 'Data Cleaning', path: 'data/cleaning', icon: Sparkles },
      { label: 'Feature Engineering', path: 'data/features', icon: GitCompare },
    ],
  },
  {
    key: 'ml',
    label: 'ML',
    path: 'ml',
    icon: BrainCircuit,
    items: [
      { label: 'AutoML', path: 'ml/automl', icon: Zap },
      { label: 'Training', path: 'ml/training', icon: GraduationCap },
      { label: 'Hyperparameter Tuning', path: 'ml/hpo', icon: SlidersHorizontal },
      { label: 'Experiments', path: 'ml/experiments', icon: FlaskConical },
      { label: 'Leaderboard', path: 'ml/leaderboard', icon: Trophy },
    ],
  },
  {
    key: 'models',
    label: 'Models',
    path: 'models',
    icon: Package,
    items: [
      { label: 'Model Registry', path: 'models/registry', icon: Package },
      { label: 'Evaluation', path: 'models/evaluation', icon: Gauge },
      { label: 'Explain AI', path: 'models/explain', icon: Lightbulb },
      { label: 'Model Comparison', path: 'models/comparison', icon: GitCompare },
    ],
  },
  {
    key: 'production',
    label: 'Production',
    path: 'production',
    icon: Rocket,
    items: [
      { label: 'Deployment', path: 'production/deployment', icon: Rocket },
      { label: 'Monitoring', path: 'production/monitoring', icon: Activity },
      { label: 'Batch Prediction', path: 'production/batch', icon: Send },
    ],
  },
  { key: 'settings', label: 'Settings', path: 'settings', icon: Settings },
];

export default function ProjectWorkspace() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { notifySuccess, notifyError } = useNotification();
  const setCurrentProjectId = useUIStore((s) => s.setCurrentProjectId);
  const projectId = routeId || useUIStore.getState().currentProjectId;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const { data: project, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsService.get(projectId!),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!projectId) return;
    setCurrentProjectId(projectId);
    return () => setCurrentProjectId(null);
  }, [projectId, setCurrentProjectId]);

  const duplicateMutation = useMutation({
    mutationFn: () => projectsService.duplicate(projectId!),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      notifySuccess(`Duplicated as "${data.name}"`);
      navigate(`/app/projects/${data.id}`);
    },
    onError: (err) => notifyError('Failed to duplicate', getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectsService.remove(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      notifySuccess('Project deleted');
      navigate('/app/projects');
    },
    onError: (err) => notifyError('Failed to delete', getErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => projectsService.update(projectId!, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      notifySuccess('Project updated');
      setStatusOpen(false);
    },
    onError: (err) => notifyError('Failed to update', getErrorMessage(err)),
  });

  const base = `/app/projects/${projectId}`;
  const currentPath = pathnameToProjectPath(location.pathname, base);
  const activeGroup = NAV_GROUPS.find((g) => currentPath === `/${g.path}` || currentPath.startsWith(`/${g.path}/`)) || NAV_GROUPS[0];
  const activeItem = activeGroup?.items?.find((i) => currentPath === `/${i.path}`);

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </PageContainer>
    );
  }

  if (isError || !project) {
    return (
      <PageContainer>
        <button className={styles.backBtn} onClick={() => navigate('/app/projects')}>
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </button>
        <ErrorState title={isError ? 'Failed to load project' : 'Project not found'} message={isError ? getErrorMessage(error) : undefined} onRetry={() => (isError ? refetch() : navigate('/app/projects'))} />
      </PageContainer>
    );
  }

  const p = project as Project;
  const meta = PROBLEM_ICONS[p.problem_type || ''] || <Package className="w-6 h-6" />;
  const archived = p.status === 'archived';

  function go(group: NavGroup) {
    const target = group.items && group.items.length ? `${base}/${group.items[0].path}` : `${base}/${group.path}`;
    navigate(target);
  }

  return (
    <PageContainer maxWidth="full">
      <div className={styles.backRow}>
        <button className={styles.backBtn} onClick={() => navigate('/app/projects')}>
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </button>
        <StatusBadge status={p.status} />
      </div>

      <div className={styles.hero}>
        <div className={styles.heroMain}>
          <div className={styles.heroIcon}>{meta}</div>
          <div className="min-w-0">
            <h1 className={styles.heroTitle}>
              {p.name}
              {p.version && p.version > 1 && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/15 text-primary">v{p.version}</span>}
            </h1>
            {p.description && <p className={styles.heroDesc}>{p.description}</p>}
            <div className={styles.heroMeta}>
              <span className={styles.metaChip}><Target className="w-3 h-3" />{(p.problem_type || 'classification').replace('_', ' ')}</span>
              <span className={styles.metaChip}>{p.visibility === 'team' ? <Users className="w-3 h-3" /> : <UserRound className="w-3 h-3" />}{p.visibility || 'private'}</span>
              {p.owner && <span className={styles.metaChip}><User className="w-3 h-3" />{p.owner}</span>}
              <span className={styles.metaChip}><Clock className="w-3 h-3" />Updated {timeAgo(p.updated_at || p.created_at)}</span>
              {p.tags && p.tags.length > 0 && <span className={styles.metaChip}><Globe className="w-3 h-3" />{p.tags.length} tags</span>}
            </div>
            {p.tags && p.tags.length > 0 && (
              <div className={styles.badges}>
                {p.tags.map((t) => <span key={t} className={styles.aboutTag}>{t}</span>)}
              </div>
            )}
          </div>
        </div>
        <div className={styles.heroActions}>
          <Button variant="secondary" size="sm" onClick={() => duplicateMutation.mutate()} loading={duplicateMutation.isPending} icon={<Copy className="w-4 h-4" />}>Duplicate</Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(`${base}/settings`)} icon={<Pencil className="w-4 h-4" />}>Edit</Button>
          <Button variant="secondary" size="sm" onClick={() => setStatusOpen(true)} icon={<Archive className="w-4 h-4" />}>{archived ? 'Restore' : 'Archive'}</Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)} icon={<Trash2 className="w-4 h-4" />}>Delete</Button>
        </div>
      </div>

      <div className={ws.subnav}>
        <div className={ws.groupTabs}>
          {NAV_GROUPS.map((group) => {
            const Icon = group.icon;
            const active = group.key === activeGroup.key;
            return (
              <button key={group.key} className={`${ws.groupTab} ${active ? ws.groupTabActive : ''}`} onClick={() => go(group)}>
                <span className={ws.groupIcon}><Icon className="w-4 h-4" /></span>
                {group.label}
              </button>
            );
          })}
        </div>
        {activeGroup.items && activeGroup.items.length > 0 && (
          <div className={ws.subTabs}>
            {activeGroup.items.map((item) => {
              const Icon = item.icon;
              const active = activeItem?.path === item.path;
              return (
                <button key={item.path} className={`${ws.subTab} ${active ? ws.subTabActive : ''}`} onClick={() => navigate(`${base}/${item.path}`)}>
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={ws.content}>
        <Outlet />
      </div>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Project"
        message={`Delete "${p.name}"? This will not delete associated datasets or models.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
      <Dialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onConfirm={() => statusMutation.mutate(archived ? 'active' : 'archived')}
        title={archived ? 'Restore Project' : 'Archive Project'}
        message={archived ? `Restore "${p.name}" to the active workspace?` : `Archive "${p.name}"? It will be hidden from the active workspace.`}
        confirmLabel={archived ? 'Restore' : 'Archive'}
        loading={statusMutation.isPending}
      />
    </PageContainer>
  );
}

function pathnameToProjectPath(pathname: string, base: string): string {
  if (!pathname.startsWith(base)) return '/overview';
  return pathname.slice(base.length) || '/overview';
}
