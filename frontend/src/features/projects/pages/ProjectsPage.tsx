import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban, Plus, Trash2, Search, FolderOpen, CheckCircle2, Archive, Clock, Layers,
  Copy, Target, TrendingUp, LineChart, Boxes, LayoutGrid, List, ArrowUpDown, Users, UserRound,
} from 'lucide-react';
import { projectsService } from '../../../services/projects.service';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Dialog } from '../../../components/ui/Dialog';
import { useNotification } from '../../../hooks/useNotification';
import { staggerContainer, staggerItem } from '../../../lib/animations';
import { timeAgo, formatDate } from '../../../lib/formatters';
import { getErrorMessage } from '../../../services/http';
import CreateProjectWizard from '../components/CreateProjectWizard';
import styles from './ProjectsPage.module.css';

type Filter = 'all' | 'active' | 'completed' | 'archived';
type View = 'grid' | 'list';
type Sort = 'updated' | 'name' | 'created';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'archived', label: 'Archived' },
];

const PROBLEM_META: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
  classification: { icon: <Target className="w-5 h-5" />, cls: 'indigo', label: 'Classification' },
  regression: { icon: <TrendingUp className="w-5 h-5" />, cls: 'emerald', label: 'Regression' },
  time_series: { icon: <LineChart className="w-5 h-5" />, cls: 'cyan', label: 'Time Series' },
  clustering: { icon: <Boxes className="w-5 h-5" />, cls: 'amber', label: 'Clustering' },
};

function problemMeta(pt?: string) {
  return PROBLEM_META[pt || ''] || { icon: <FolderKanban className="w-5 h-5" />, cls: 'indigo', label: 'ML Project' };
}

function statusProgress(status?: string) {
  switch (status) {
    case 'completed': return 100;
    case 'training': return 55;
    case 'active': return 65;
    case 'development': return 30;
    case 'archived': return 100;
    default: return 0;
  }
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { notifySuccess, notifyError } = useNotification();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<View>('grid');
  const [sort, setSort] = useState<Sort>('updated');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ id: string; name: string; to: 'archived' | 'active' } | null>(null);

  const { data: projects, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsService.list(),
    select: (d) => d.projects,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); notifySuccess('Project deleted'); setDeleteTarget(null); },
    onError: (err) => notifyError('Failed to delete', getErrorMessage(err)),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => projectsService.duplicate(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      notifySuccess(`Duplicated as "${data.name}"`);
    },
    onError: (err) => notifyError('Failed to duplicate', getErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => projectsService.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); notifySuccess('Project updated'); setStatusTarget(null); },
    onError: (err) => notifyError('Failed to update', getErrorMessage(err)),
  });

  const all = projects || [];

  const counts = {
    all: all.length,
    active: all.filter((p) => p.status === 'active').length,
    completed: all.filter((p) => p.status === 'completed').length,
    archived: all.filter((p) => p.status === 'archived').length,
  };

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    const list = all.filter((p) =>
      (filter === 'all' || p.status === filter) &&
      (p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query) ||
        p.tags?.some((t) => t.toLowerCase().includes(query)))
    );
    const byName = (a: any, b: any) => a.name.localeCompare(b.name);
    switch (sort) {
      case 'name': return [...list].sort(byName);
      case 'created': return [...list].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      default: return [...list].sort((a: any, b: any) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
    }
  }, [all, search, filter, sort]);

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Projects" description="Organize and manage your ML workflows" />
        <div className={styles.stats}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      </PageContainer>
    );
  }

  if (isError) {
    return <PageContainer><ErrorState title="Failed to load projects" message={getErrorMessage(error)} onRetry={refetch} /></PageContainer>;
  }

  const openProject = (id: string) => navigate(`/app/projects/${id}`);
  const totalCounts = filtered.reduce((acc, p: any) => ({
    datasets: acc.datasets + (p.dataset_count || 0),
    models: acc.models + (p.model_count || 0),
  }), { datasets: 0, models: 0 });

  return (
    <PageContainer>
      <PageHeader title="Projects" description="Organize and manage your ML workflows">
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="w-4 h-4" />}>New Project</Button>
      </PageHeader>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Total</span>
            <div className={`${styles.statIcon} ${styles.accent}`}><Layers className="w-4 h-4" /></div>
          </div>
          <span className={styles.statValue}>{counts.all}</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Active</span>
            <div className={styles.statIcon}><FolderOpen className="w-4 h-4" /></div>
          </div>
          <span className={styles.statValue}>{counts.active}</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Completed</span>
            <div className={`${styles.statIcon} ${styles.success}`}><CheckCircle2 className="w-4 h-4" /></div>
          </div>
          <span className={styles.statValue}>{counts.completed}</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statLabel}>Archived</span>
            <div className={`${styles.statIcon} ${styles.warning}`}><Archive className="w-4 h-4" /></div>
          </div>
          <span className={styles.statValue}>{counts.archived}</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {FILTERS.map((f) => (
            <button key={f.key} className={`${styles.filterBtn} ${filter === f.key ? styles.active : ''}`} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className={styles.toolbarRight}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}><Search className="w-4 h-4" /></span>
            <input className={styles.searchInput} placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className={styles.sortWrap}>
            <ArrowUpDown className="w-3.5 h-3.5" />
            <select className={styles.sortSelect} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="updated">Last updated</option>
              <option value="name">Name</option>
              <option value="created">Date created</option>
            </select>
          </div>
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'grid' ? styles.active : ''}`} title="Grid view" onClick={() => setView('grid')}><LayoutGrid className="w-4 h-4" /></button>
            <button className={`${styles.viewBtn} ${view === 'list' ? styles.active : ''}`} title="List view" onClick={() => setView('list')}><List className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        all.length > 0 ? (
          <EmptyState icon={<FolderKanban className="w-8 h-8" />} title="No projects match your filters" description="Try a different search or filter" />
        ) : (
          <EmptyState icon={<FolderKanban className="w-8 h-8" />} title="No projects yet" description="Create a project to organize your datasets, models, and deployments" action={{ label: 'Create Project', onClick: () => setCreateOpen(true) }} />
        )
      ) : view === 'grid' ? (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className={styles.grid}>
          {filtered.map((project) => {
            const meta = problemMeta(project.problem_type);
            const progress = statusProgress(project.status);
            return (
              <motion.div key={project.id} variants={staggerItem}>
                <div className={styles.projectCard} onClick={() => openProject(project.id)}>
                  <div className={styles.cardTop}>
                    <div className={`${styles.projectIcon} ${styles[meta.cls]}`}>{meta.icon}</div>
                    <StatusBadge status={project.status} />
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.cardNameRow}>
                      <h3 className={styles.projectName}>{project.name}</h3>
                      {project.version && project.version > 1 && <span className={styles.versionTag}>v{project.version}</span>}
                    </div>
                    {project.description && <p className={styles.projectDesc}>{project.description}</p>}
                    <span className={styles.problemLabel}>{meta.label}</span>
                    {project.tags && project.tags.length > 0 && (
                      <div className={styles.tags}>
                        {project.tags.slice(0, 3).map((t: string) => <span key={t} className={styles.tag}>{t}</span>)}
                        {project.tags.length > 3 && <span className={styles.tag}>+{project.tags.length - 3}</span>}
                      </div>
                    )}
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <div className={styles.cardMeta}>
                    <div className={styles.countRow}>
                      <span className={styles.countCell}><Layers className="w-3.5 h-3.5" />{(project as any).dataset_count || 0} datasets</span>
                      <span className={styles.countCell}><FolderKanban className="w-3.5 h-3.5" />{(project as any).experiment_count || 0} runs</span>
                      <span className={styles.countCell}><Target className="w-3.5 h-3.5" />{(project as any).model_count || 0} models</span>
                    </div>
                    <div className={styles.cardFooter}>
                      <div className={styles.createdLine}>
                        <span className={styles.created}><Clock className="w-3.5 h-3.5" />{timeAgo(project.updated_at || project.created_at)}</span>
                        {project.owner && (
                          <span className={styles.owner} title={`Owner: ${project.owner}`}>
                            {(project.visibility === 'team' ? <Users className="w-3 h-3" /> : <UserRound className="w-3 h-3" />)}
                            {project.owner}
                          </span>
                        )}
                      </div>
                      <div className={styles.actions}>
                        <button className={styles.actionBtn} title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateMutation.mutate(project.id); }}>
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {project.status === 'archived' ? (
                          <button className={styles.actionBtn} title="Restore" onClick={(e) => { e.stopPropagation(); statusMutation.mutate({ id: project.id, status: 'active' }); }}>
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button className={styles.actionBtn} title="Archive" onClick={(e) => { e.stopPropagation(); setStatusTarget({ id: project.id, name: project.name, to: 'archived' }); }}>
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button className={`${styles.actionBtn} ${styles.danger}`} title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(project.id); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className={styles.list}>
          <div className={styles.listHead}>
            <span className={styles.listHeadCell}>Project</span>
            <span className={styles.listHeadCell}>Type</span>
            <span className={styles.listHeadCell}>Datasets</span>
            <span className={styles.listHeadCell}>Models</span>
            <span className={styles.listHeadCell}>Status</span>
            <span className={styles.listHeadCell}>Updated</span>
            <span className={styles.listHeadCell}></span>
          </div>
          {filtered.map((project) => {
            const meta = problemMeta(project.problem_type);
            return (
              <motion.div key={project.id} variants={staggerItem} className={styles.listRow} onClick={() => openProject(project.id)}>
                <div className={styles.listNameCell}>
                  <div className={`${styles.projectIcon} ${styles[meta.cls]} ${styles.smallIcon}`}>{meta.icon}</div>
                  <div className={styles.listNameWrap}>
                    <span className={styles.listName}>{project.name}</span>
                    <span className={styles.listDesc}>{project.description || 'No description'}</span>
                  </div>
                </div>
                <span className={styles.listCell}>{meta.label}</span>
                <span className={styles.listCell}>{(project as any).dataset_count || 0}</span>
                <span className={styles.listCell}>{(project as any).model_count || 0}</span>
                <span className={styles.listCell}><StatusBadge status={project.status} /></span>
                <span className={styles.listCell}>{formatDate(project.updated_at || project.created_at)}</span>
                <div className={styles.listActions}>
                  <button className={styles.actionBtn} title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateMutation.mutate(project.id); }}><Copy className="w-3.5 h-3.5" /></button>
                  <button className={`${styles.actionBtn} ${styles.danger}`} title="Delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(project.id); }}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </motion.div>
            );
          })}
          <div className={styles.listFoot}>
            {filtered.length} project{filtered.length === 1 ? '' : 's'} · {totalCounts.datasets} datasets · {totalCounts.models} models
          </div>
        </motion.div>
      )}

      <CreateProjectWizard open={createOpen} onClose={() => setCreateOpen(false)} />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        title="Delete Project"
        message="Are you sure? This will not delete associated datasets or models."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />

      <Dialog
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => statusTarget && statusMutation.mutate({ id: statusTarget.id, status: statusTarget.to })}
        title={statusTarget?.to === 'archived' ? 'Archive Project' : 'Restore Project'}
        message={statusTarget?.to === 'archived' ? `Archive "${statusTarget?.name}"? It will be hidden from the active workspace.` : `Restore "${statusTarget?.name}" to active?`}
        confirmLabel={statusTarget?.to === 'archived' ? 'Archive' : 'Restore'}
        loading={statusMutation.isPending}
      />
    </PageContainer>
  );
}
