import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, Trash2 } from 'lucide-react';
import { projectsService } from '../../../services/projects.service';
import { useProject } from '../../../hooks/useApi';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Dialog } from '../../../components/ui/Dialog';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useNotification } from '../../../hooks/useNotification';
import { getErrorMessage } from '../../../services/http';
import styles from './ProjectDetailPage.module.css';

export default function ProjectSettings() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { notifySuccess, notifyError } = useNotification();
  const projectId = routeId || '';

  const { data: project, isLoading, isError, error, refetch } = useProject(projectId);

  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editProblem, setEditProblem] = useState('classification');
  const [editVisibility, setEditVisibility] = useState('private');
  const [editTags, setEditTags] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    if (project) {
      setEditName(project.name);
      setEditDesc(project.description || '');
      setEditProblem(project.problem_type || 'classification');
      setEditVisibility(project.visibility || 'private');
      setEditTags((project.tags || []).join(', '));
    }
  }, [project]);

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

  const deleteMutation = useMutation({
    mutationFn: () => projectsService.remove(projectId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      notifySuccess('Project deleted');
      navigate('/app/projects');
    },
    onError: (err) => notifyError('Failed to delete', getErrorMessage(err)),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <ErrorState title="Failed to load project" message={getErrorMessage(error)} onRetry={refetch} />
    );
  }

  const archived = project.status === 'archived';

  return (
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

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Project"
        message={`Delete "${project.name}"? This will not delete associated datasets or models.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
      <Dialog
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onConfirm={() => statusMutation.mutate(archived ? 'active' : 'archived')}
        title={archived ? 'Restore Project' : 'Archive Project'}
        message={archived ? `Restore "${project.name}" to the active workspace?` : `Archive "${project.name}"? It will be hidden from the active workspace.`}
        confirmLabel={archived ? 'Restore' : 'Archive'}
        loading={statusMutation.isPending}
      />
    </>
  );
}
