import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Database, FlaskConical, Package, Rocket, Gauge, Activity, CheckCircle2,
  Upload, BrainCircuit, Terminal, Settings, ExternalLink, Target, TrendingUp,
  LineChart, Boxes, GitBranch, GraduationCap, Sparkles,
} from 'lucide-react';
import { projectsService } from '../../../services/projects.service';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { formatDate, timeAgo } from '../../../lib/formatters';
import { getErrorMessage } from '../../../services/http';
import type { Project } from '../../../types/api';
import styles from './ProjectDetailPage.module.css';

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

export default function ProjectOverview() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const projectId = routeId || '';
  const base = `/app/projects/${projectId}`;

  const { data: project, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsService.get(projectId!),
    enabled: !!projectId,
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
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <ErrorState title={isError ? 'Failed to load project' : 'Project not found'} message={isError ? getErrorMessage(error) : undefined} onRetry={() => (isError ? refetch() : navigate('/app/projects'))} />
    );
  }

  const p = project as Project & { datasets?: { name: string; rows: number; columns: number; size_kb: number }[] };
  const datasets = p.datasets || [];
  const pipelineDoneIndex = PIPELINE.reduce((acc, step, i) => step.done(p) ? i : acc, -1);

  const quickActions = [
    { icon: <Upload className="w-4 h-4" />, title: 'Upload Dataset', desc: 'Add data to this project', onClick: () => navigate(`${base}/data/datasets`) },
    { icon: <BrainCircuit className="w-4 h-4" />, title: 'Run AutoML', desc: 'Let the engine find a model', onClick: () => navigate(`${base}/ml/automl`) },
    { icon: <FlaskConical className="w-4 h-4" />, title: 'New Experiment', desc: 'Start a training run', onClick: () => navigate(`${base}/ml/experiments`) },
    { icon: <Rocket className="w-4 h-4" />, title: 'Deploy Model', desc: 'Ship a model to production', onClick: () => navigate(`${base}/production/deployment`) },
    { icon: <Terminal className="w-4 h-4" />, title: 'SQL Studio', desc: 'Query your data', onClick: () => navigate(`${base}/data/sql`) },
    { icon: <Activity className="w-4 h-4" />, title: 'Monitoring', desc: 'Check endpoint health', onClick: () => navigate(`${base}/production/monitoring`) },
  ];

  return (
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
            <button className={styles.sectionLink} onClick={() => navigate(`${base}/ml/automl`)}>Open AutoML</button>
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
            <button className={styles.sectionLink} onClick={() => navigate(`${base}/settings`)}>Settings</button>
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

      <div className={styles.sectionCard}>
        <div className={styles.sectionTitle}>
          <h3>Linked Datasets</h3>
          <button className={styles.sectionLink} onClick={() => navigate(`${base}/data/explorer`)}>Open Data Explorer <ExternalLink className="w-3 h-3 inline" /></button>
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
                <tr key={d.name} className={styles.datasetRow} onClick={() => navigate(`${base}/data/explorer?dataset=${encodeURIComponent(d.name)}`)}>
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
    </>
  );
}
