import { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Copy, Archive, Trash2, Pencil, Target, TrendingUp, LineChart, Boxes,
  LayoutDashboard, Database, BarChart3, Sparkles, Terminal, BrainCircuit, GraduationCap,
  SlidersHorizontal, FlaskConical, Gauge, Lightbulb, Package, Rocket, Activity, Settings,
  Clock, User, Globe, Upload, GitBranch, CheckCircle2, ExternalLink, PlayCircle,
  UserRound, Users,
} from 'lucide-react';
import { projectsService } from '../../../services/projects.service';
import { useUIStore } from '../../../store/useUIStore';
import { PageContainer } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Dialog } from '../../../components/ui/Dialog';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { useNotification } from '../../../hooks/useNotification';
import { formatDate, timeAgo } from '../../../lib/formatters';
import { getErrorMessage } from '../../../services/http';
import type { Project } from '../../../types/api';
import styles from './ProjectDetailPage.module.css';

type TabKey = 'overview' | 'datasets' | 'profiling' | 'cleaning' | 'features' | 'sql'
  | 'automl' | 'training' | 'hpo' | 'experiments' | 'evaluation' | 'explain'
  | 'registry' | 'deployment' | 'monitoring' | 'settings';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  route?: string;
  blurb?: string;
}

const TABS: TabDef[] = [
  { key: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: 'datasets', label: 'Datasets', icon: <Database className="w-4 h-4" />, route: '/app/datasets', blurb: 'Upload, preview, and manage the datasets linked to this project.' },
  { key: 'profiling', label: 'Data Profiling', icon: <BarChart3 className="w-4 h-4" />, route: '/app/profiling', blurb: 'Run automated data profiling to understand distributions, quality, and drift.' },
  { key: 'cleaning', label: 'Cleaning', icon: <Sparkles className="w-4 h-4" />, route: '/app/cleaning', blurb: 'Clean and transform your data with auto-clean operations and pipelines.' },
  { key: 'features', label: 'Feature Engineering', icon: <GitBranch className="w-4 h-4" />, route: '/app/feature-engineering', blurb: 'Design, generate, and validate features for this project.' },
  { key: 'sql', label: 'SQL Studio', icon: <Terminal className="w-4 h-4" />, route: '/app/sql', blurb: 'Query your data warehouse and datasets with the built-in SQL editor.' },
  { key: 'automl', label: 'AutoML', icon: <BrainCircuit className="w-4 h-4" />, route: '/app/engine', blurb: 'Launch automated ML pipelines that search the best models for you.' },
  { key: 'training', label: 'Training', icon: <GraduationCap className="w-4 h-4" />, route: '/app/training', blurb: 'Configure and run manual training jobs with full control.' },
  { key: 'hpo', label: 'HPO', icon: <SlidersHorizontal className="w-4 h-4" />, route: '/app/hpo', blurb: 'Run hyperparameter optimization sweeps to tune your models.' },
  { key: 'experiments', label: 'Experiments', icon: <FlaskConical className="w-4 h-4" />, route: '/app/experiments', blurb: 'Track, compare, and version all training runs in this project.' },
  { key: 'evaluation', label: 'Evaluation', icon: <Gauge className="w-4 h-4" />, route: '/app/evaluation', blurb: 'Evaluate model performance against test sets and baselines.' },
  { key: 'explain', label: 'Explain AI', icon: <Lightbulb className="w-4 h-4" />, route: '/app/explain', blurb: 'Generate explanations and feature attributions for your models.' },
  { key: 'registry', label: 'Model Registry', icon: <Package className="w-4 h-4" />, route: '/app/models', blurb: 'Version, stage, approve, and promote models across environments.' },
  { key: 'deployment', label: 'Deployment', icon: <Rocket className="w-4 h-4" />, route: '/app/deployments', blurb: 'Deploy models as real-time endpoints or batch inference jobs.' },
  { key: 'monitoring', label: 'Monitoring', icon: <Activity className="w-4 h-4" />, route: '/app/monitoring', blurb: 'Monitor production endpoints for drift, latency, and errors.' },
  { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

const PROBLEM_ICONS: Record<string, React.ReactNode> = {
  classification: <Target className="w-6 h-6" />,
  regression: <TrendingUp className="w-6 h-6" />,
  time_series: <LineChart className="w-6 h-6" />,
  clustering: <Boxes className="w-6 h-6" />,
};

const PIPELINE: { key: string; label: string; icon: React.ReactNode; done: (p: Project) => boolean }[] = [
  { key: 'dataset', label: 'Dataset', icon: <Database className="w-4 h-4" />, done: (p) => (p.dataset_count || 0) > 0 },
  { key: 'clean', label: 'Clean', icon: <Sparkles className="w-4 h-4" />, done: (p) => (p.dataset_count || 0) > 0 },
  { key: 'features', label: 'Features', icon: <GitBranch className="w-4 h-4" />, done: (p) => (p.experiment_count || 0) > 0 },
  { key: 'train', label: 'Train', icon: <GraduationCap className="w-4 h-4" />, done: (p) => (p.experiment_count || 0) > 0 },
  { key: 'evaluate', label: 'Evaluate', icon: <Gauge className="w-4 h-4" />, done: (p) => (p.model_count || 0) > 0 },
  { key: 'deploy', label: 'Deploy', icon: <Rocket className="w-4 h-4" />, done: (p) => (p.deployment_count || 0) > 0 },
];

export default function ProjectDetailPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { notifySuccess, notifyError } = useNotification();
  const storeProjectId = useUIStore((s) => s.currentProjectId);
  const projectId = routeId || storeProjectId;

  const [tab, setTab] = useState<TabKey>('overview');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editProblem, setEditProblem] = useState('');
  const [editVisibility, setEditVisibility] = useState('private');
  const [editTags, setEditTags] = useState('');

  const { data: project, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsService.get(projectId!),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (project) {
      setEditName(project.name);
      setEditDesc(project.description || '');
      setEditProblem(project.problem_type || 'classification');
      setEditVisibility(project.visibility || 'private');
      setEditTags((project.tags || []).join(', '));
    }
  }, [project]);

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

  const updateMutation = useMutation({
    mutationFn: () => projectsService.update(projectId!, {
      name: editName,
      description: editDesc,
      problem_type: editProblem,
      visibility: editVisibility,
      tags: editTags.split(',').map((t) => t.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      notifySuccess('Project saved');
    },
    onError: (err) => notifyError('Failed to save', getErrorMessage(err)),
  });

  const timeline = useMemo(() => {
    if (!project) return [];
    const items: { title: string; detail: string; time: string }[] = [];
    items.push({ title: 'Project created', detail: `by ${project.owner || 'you'}`, time: project.created_at });
    if (project.dataset_count || (project as any).datasets?.length) {
      items.push({ title: 'Datasets linked', detail: `${project.dataset_count || (project as any).datasets.length} dataset${(project.dataset_count || 1) === 1 ? '' : 's'} attached`, time: project.updated_at || project.created_at });
    }
    if (project.experiment_count) {
      items.push({ title: 'Experiments recorded', detail: `${project.experiment_count} training run${project.experiment_count === 1 ? '' : 's'} tracked`, time: project.updated_at || project.created_at });
    }
    if (project.model_count) {
      items.push({ title: 'Models registered', detail: `${project.model_count} model${project.model_count === 1 ? '' : 's'} in the registry`, time: project.updated_at || project.created_at });
    }
    if (project.deployment_count) {
      items.push({ title: 'Deployments active', detail: `${project.deployment_count} endpoint${project.deployment_count === 1 ? '' : 's'} live`, time: project.updated_at || project.created_at });
    }
    items.push({ title: 'Last updated', detail: project.updated_at ? timeAgo(project.updated_at) : '—', time: project.updated_at || project.created_at });
    return items;
  }, [project]);

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

  const p = project as Project & { datasets?: { name: string; rows: number; columns: number; size_kb: number }[] };
  const meta = PROBLEM_ICONS[p.problem_type || ''] || <Package className="w-6 h-6" />;
  const datasets = p.datasets || [];
  const archived = p.status === 'archived';

  const pipelineDoneIndex = PIPELINE.reduce((acc, step, i) => step.done(p) ? i : acc, -1);

  const quickActions = [
    { icon: <Upload className="w-4 h-4" />, title: 'Upload Dataset', desc: 'Add data to this project', onClick: () => navigate('/app/datasets') },
    { icon: <BrainCircuit className="w-4 h-4" />, title: 'Run AutoML', desc: 'Let the engine find a model', onClick: () => navigate('/app/engine') },
    { icon: <FlaskConical className="w-4 h-4" />, title: 'New Experiment', desc: 'Start a training run', onClick: () => navigate('/app/experiments') },
    { icon: <Rocket className="w-4 h-4" />, title: 'Deploy Model', desc: 'Ship a model to production', onClick: () => navigate('/app/deployments') },
    { icon: <Terminal className="w-4 h-4" />, title: 'SQL Studio', desc: 'Query your data', onClick: () => navigate('/app/sql') },
    { icon: <Activity className="w-4 h-4" />, title: 'Monitoring', desc: 'Check endpoint health', onClick: () => navigate('/app/monitoring') },
  ];

  const activeTab = TABS.find((t) => t.key === tab)!;

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
              {p.tags && p.tags.length > 0 && (
                <span className={styles.metaChip}><Globe className="w-3 h-3" />{p.tags.length} tags</span>
              )}
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
          <Button variant="secondary" size="sm" onClick={() => setTab('settings')} icon={<Pencil className="w-4 h-4" />}>Edit</Button>
          <Button variant="secondary" size="sm" onClick={() => setStatusOpen(true)} icon={<Archive className="w-4 h-4" />}>{archived ? 'Restore' : 'Archive'}</Button>
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)} icon={<Trash2 className="w-4 h-4" />}>Delete</Button>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`} onClick={() => setTab(t.key)}>
            <span className={styles.tabIcon}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <div className={styles.statTop}><span className={styles.statLabel}>Datasets</span><div className={styles.statIcon}><Database className="w-4 h-4" /></div></div>
              <span className={styles.statValue}>{p.dataset_count || 0}</span>
              <span className={styles.statSub}>{datasets.length ? `${datasets.length} linked now` : 'No data attached yet'}</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTop}><span className={styles.statLabel}>Experiments</span><div className={styles.statIcon}><FlaskConical className="w-4 h-4" /></div></div>
              <span className={styles.statValue}>{p.experiment_count || 0}</span>
              <span className={styles.statSub}>tracked training runs</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTop}><span className={styles.statLabel}>Models</span><div className={styles.statIcon}><Package className="w-4 h-4" /></div></div>
              <span className={styles.statValue}>{p.model_count || 0}</span>
              <span className={styles.statSub}>in the model registry</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTop}><span className={styles.statLabel}>Deployments</span><div className={styles.statIcon}><Rocket className="w-4 h-4" /></div></div>
              <span className={styles.statValue}>{p.deployment_count || 0}</span>
              <span className={styles.statSub}>production endpoints</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTop}><span className={styles.statLabel}>Best Accuracy</span><div className={styles.statIcon}><Gauge className="w-4 h-4" /></div></div>
              <span className={styles.statValue}>{p.model_count ? '—' : '—'}</span>
              <span className={styles.statSub}>{p.model_count ? 'evaluate models to track' : 'no models trained yet'}</span>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statTop}><span className={styles.statLabel}>Prediction Requests</span><div className={styles.statIcon}><Activity className="w-4 h-4" /></div></div>
              <span className={styles.statValue}>{p.deployment_count ? '—' : '0'}</span>
              <span className={styles.statSub}>{p.deployment_count ? 'check monitoring tab' : 'no live endpoints'}</span>
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>
                <h3>Pipeline Progress</h3>
                <button className={styles.sectionLink} onClick={() => navigate('/app/engine')}>Open AutoML</button>
              </div>
              <div className={styles.pipeline}>
                {PIPELINE.map((step, i) => {
                  const isActive = i === pipelineDoneIndex + 1;
                  return (
                    <div key={step.key} className={`${styles.pipeStep} ${i <= pipelineDoneIndex ? styles.pipeDone : ''} ${isActive ? styles.pipeActive : ''}`}>
                      {i < PIPELINE.length - 1 && <div className={`${styles.pipeLine} ${i < pipelineDoneIndex ? styles.pipeLineDone : ''}`} />}
                      <div className={styles.pipeNode}>{i <= pipelineDoneIndex ? <CheckCircle2 className="w-4 h-4" /> : step.icon}</div>
                      <span className={styles.pipeLabel}>{step.label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-500 mt-3">
                {pipelineDoneIndex >= PIPELINE.length - 1 ? 'All pipeline stages completed.' : `Next stage: ${PIPELINE[pipelineDoneIndex + 1]?.label}.`}
              </p>
            </div>

            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}>
                <h3>About</h3>
                <button className={styles.sectionLink} onClick={() => setTab('settings')}>Settings</button>
              </div>
              <div>
                <div className={styles.aboutRow}><span className={styles.aboutKey}>Problem Type</span><span className={styles.aboutValue} style={{ textTransform: 'capitalize' }}>{(p.problem_type || 'classification').replace('_', ' ')}</span></div>
                <div className={styles.aboutRow}><span className={styles.aboutKey}>Visibility</span><span className={styles.aboutValue} style={{ textTransform: 'capitalize' }}>{p.visibility || 'private'}</span></div>
                <div className={styles.aboutRow}><span className={styles.aboutKey}>Version</span><span className={styles.aboutValue}>v{p.version || 1}</span></div>
                <div className={styles.aboutRow}><span className={styles.aboutKey}>Owner</span><span className={styles.aboutValue}>{p.owner || '—'}</span></div>
                <div className={styles.aboutRow}><span className={styles.aboutKey}>Created</span><span className={styles.aboutValue}>{formatDate(p.created_at)}</span></div>
                <div className={styles.aboutRow}><span className={styles.aboutKey}>Last Updated</span><span className={styles.aboutValue}>{formatDate(p.updated_at || p.created_at)}</span></div>
                {p.tags && p.tags.length > 0 && (
                  <div className={styles.aboutRow}>
                    <span className={styles.aboutKey}>Tags</span>
                    <div className={styles.aboutTags}>{p.tags.map((t) => <span key={t} className={styles.aboutTag}>{t}</span>)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.grid2}>
            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}><h3>Quick Actions</h3></div>
              <div className={styles.quickGrid}>
                {quickActions.map((qa) => (
                  <button key={qa.title} className={styles.quickAction} onClick={qa.onClick}>
                    <div className={styles.quickActionIcon}>{qa.icon}</div>
                    <span className={styles.quickActionTitle}>{qa.title}</span>
                    <span className={styles.quickActionDesc}>{qa.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.sectionCard}>
              <div className={styles.sectionTitle}><h3>Activity</h3></div>
              <div className={styles.timeline}>
                {timeline.map((item, i) => (
                  <div key={i} className={styles.tlItem}>
                    <div className={styles.tlDot} />
                    <div className={styles.tlBody}>
                      <div className={styles.tlTitle}>{item.title}</div>
                      <div className={styles.tlDetail}>{item.detail}</div>
                      <div className={styles.tlTime}>{timeAgo(item.time)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'datasets' && (
        <div className={styles.sectionCard}>
          <div className={styles.sectionTitle}>
            <h3>Project Datasets</h3>
            <button className={styles.sectionLink} onClick={() => navigate('/app/datasets')}>Open Data Explorer <ExternalLink className="w-3 h-3 inline" /></button>
          </div>
          {datasets.length === 0 ? (
            <EmptyState
              icon={<Database className="w-8 h-8" />}
              title="No datasets linked"
              description="Upload a dataset or connect a data source to start working with data."
              action={{ label: 'Upload Dataset', onClick: () => navigate('/app/datasets') }}
            />
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Dataset</th>
                  <th>Rows</th>
                  <th>Columns</th>
                  <th>Size</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={d.name} className={styles.datasetRow} onClick={() => navigate(`/app/explorer?dataset=${encodeURIComponent(d.name)}`)}>
                    <td><span className={styles.tableName}><Database className="w-4 h-4 text-primary" />{d.name}</span></td>
                    <td>{d.rows.toLocaleString()}</td>
                    <td>{d.columns}</td>
                    <td>{d.size_kb} KB</td>
                    <td className="text-right"><ExternalLink className="w-3.5 h-3.5 inline text-zinc-500" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <>
          <div className={styles.settingsCard}>
            <h3>General Settings</h3>
            <div className="space-y-4">
              <Input label="Project Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description</label>
                <textarea
                  className="w-full rounded bg-card border border-border px-4 py-2.5 text-sm text-zinc-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                />
              </div>
              <Select
                label="Problem Type"
                value={editProblem}
                onChange={(e) => setEditProblem(e.target.value)}
                options={[
                  { value: 'classification', label: 'Classification' },
                  { value: 'regression', label: 'Regression' },
                  { value: 'time_series', label: 'Time Series' },
                  { value: 'clustering', label: 'Clustering' },
                ]}
              />
              <Select
                label="Visibility"
                value={editVisibility}
                onChange={(e) => setEditVisibility(e.target.value)}
                options={[
                  { value: 'private', label: 'Private' },
                  { value: 'team', label: 'Team' },
                ]}
              />
              <Input label="Tags (comma-separated)" value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="fraud, banking, production" />
              <div className="flex justify-end pt-2">
                <Button onClick={() => updateMutation.mutate()} loading={updateMutation.isPending}>Save Changes</Button>
              </div>
            </div>
          </div>

          <div className={styles.dangerZone}>
            <h3>Danger Zone</h3>
            <p className={styles.dangerDesc}>{archived ? 'Restore this project to the active workspace, or delete it permanently.' : 'Archive this project to move it out of the active workspace, or delete it permanently. Datasets and models are not deleted.'}</p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setStatusOpen(true)} icon={<Archive className="w-4 h-4" />}>
                {archived ? 'Restore Project' : 'Archive Project'}
              </Button>
              <Button variant="danger" onClick={() => setDeleteOpen(true)} icon={<Trash2 className="w-4 h-4" />}>Delete Project</Button>
            </div>
          </div>
        </>
      )}

      {activeTab.route && tab !== 'datasets' && tab !== 'settings' && (
        <div className={styles.sectionCard}>
          <div className={styles.moduleLaunch}>
            <div className={styles.moduleInner}>
              <div className={styles.moduleIcon}>{activeTab.icon}</div>
              <h3 className={styles.moduleTitle}>{activeTab.label}</h3>
              <p className={styles.moduleDesc}>{activeTab.blurb}</p>
              <Button onClick={() => navigate(activeTab.route!)} icon={<PlayCircle className="w-4 h-4" />}>Open {activeTab.label}</Button>
            </div>
          </div>
        </div>
      )}

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
