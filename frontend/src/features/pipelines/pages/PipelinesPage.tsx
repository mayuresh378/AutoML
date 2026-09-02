import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { GitBranch, Play, Plus, Trash2, Search, Settings2 } from 'lucide-react';
import { pipelinesService } from '../../../services/pipelines.service';
import { PipelineBuilder } from '../PipelineBuilder';
import { Card } from '../../../components/ui/Card';
import { PageContainer, PageHeader } from '../../../components/layout/PageContainer';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { Modal } from '../../../components/ui/Modal';
import { Dialog } from '../../../components/ui/Dialog';
import { useNotification } from '../../../hooks/useNotification';
import { staggerContainer, staggerItem } from '../../../lib/animations';
import { pluralize } from '../../../lib/formatters';
import { getErrorMessage } from '../../../services/http';
import type { Pipeline } from '../../../types/api';

export default function PipelinesPage() {
  const qc = useQueryClient();
  const { notifySuccess, notifyError } = useNotification();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editing, setEditing] = useState<Pipeline | null>(null);
  const [search, setSearch] = useState('');

  const { data: pipelines, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => pipelinesService.list(),
    select: (d) => d.pipelines,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => pipelinesService.create(name, []),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      notifySuccess('Pipeline created');
      setCreateOpen(false);
      setEditing(created);
    },
    onError: (err) => notifyError('Failed to create pipeline', getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pipelinesService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipelines'] }); notifySuccess('Pipeline deleted'); setDeleteTarget(null); },
    onError: (err) => notifyError('Failed to delete', getErrorMessage(err)),
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => pipelinesService.run(id),
    onSuccess: (run) => {
      notifySuccess(run.status === 'failed' ? 'Pipeline run failed' : 'Pipeline run completed', run.current_step || undefined);
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      qc.invalidateQueries({ queryKey: ['pipeline-runs'] });
    },
    onError: (err) => notifyError('Failed to run pipeline', getErrorMessage(err)),
  });

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Pipelines" description="Automate your ML workflows" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-44 rounded-2xl bg-white/5 animate-pulse" />)}
        </div>
      </PageContainer>
    );
  }

  if (isError) {
    return <PageContainer><ErrorState title="Failed to load pipelines" message={getErrorMessage(error)} onRetry={refetch} /></PageContainer>;
  }

  const filtered = (pipelines || []).filter((p: any) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <PageContainer>
      <PageHeader title="Pipelines" description="Automate your ML workflows">
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="w-4 h-4" />} className="w-56" />
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="w-4 h-4" />}>New Pipeline</Button>
      </PageHeader>

      {editing ? (
        <PipelineBuilder
          pipeline={editing}
          onBack={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      ) : filtered.length === 0 ? (
        pipelines && pipelines.length > 0 ? (
          <EmptyState title="No pipelines match your search" />
        ) : (
          <EmptyState icon={<GitBranch className="w-8 h-8" />} title="No pipelines yet" description="Create a pipeline to automate your ML workflow from data to deployment" action={{ label: 'Create Pipeline', onClick: () => setCreateOpen(true) }} />
        )
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
          {filtered.map((pipeline: any) => (
            <motion.div key={pipeline.id} variants={staggerItem}>
              <Card padding="md">
                <div className="flex items-center justify-between">
                  <button onClick={() => setEditing(pipeline)} className="flex items-center gap-4 min-w-0 flex-1 text-left group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors">{pipeline.name}</h3>
                        <StatusBadge status={pipeline.status} />
                        {pipeline.schedule && <Badge variant="info" size="sm">{pipeline.schedule}</Badge>}
                      </div>
                      {pipeline.description && <p className="text-xs text-zinc-500 mt-0.5 truncate">{pipeline.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
                        <span>{pluralize(pipeline.steps?.length || 0, 'step')}</span>
                        <span>Updated {new Date(pipeline.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => { runMutation.mutate(pipeline.id); }} loading={runMutation.isPending && runMutation.variables === pipeline.id} icon={<Play className="w-3.5 h-3.5" />}>Run</Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditing(pipeline)} icon={<Settings2 className="w-3.5 h-3.5" />}>Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(pipeline.id)} className="text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Pipeline">
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">A pipeline will be created with default settings and opened in the builder so you can add steps.</p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate('New Pipeline')} loading={createMutation.isPending}>Create Pipeline</Button>
          </div>
        </div>
      </Modal>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)} title="Delete Pipeline" message="Are you sure? This action cannot be undone." confirmLabel="Delete" loading={deleteMutation.isPending} />
    </PageContainer>
  );
}
