import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowDown, ArrowUp, BarChart3, Brain, Database, GripVertical,
  Info, Play, Plus, Rocket, Save, SlidersHorizontal, Sparkles, Trash2,
  type LucideIcon,
} from 'lucide-react';
import { pipelinesService } from '../../services/pipelines.service';
import { datasetsService } from '../../services/datasets.service';
import type { Pipeline, PipelineStep } from '../../types/api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ErrorState } from '../../components/ui/ErrorState';
import { useNotification } from '../../hooks/useNotification';
import { getErrorMessage } from '../../services/http';
import { cn } from '../../lib/cn';

type StepType = 'load_dataset' | 'split' | 'train' | 'evaluate' | 'predict' | 'deploy';

const STEP_DEFS: { type: StepType; label: string; description: string; icon: LucideIcon; defaultParams: Record<string, any> }[] = [
  { type: 'load_dataset', label: 'Load Dataset', description: 'Load a CSV dataset and set the target column', icon: Database, defaultParams: { dataset: '', target_column: '' } },
  { type: 'split', label: 'Train / Test Split', description: 'Split data into train and test sets', icon: SlidersHorizontal, defaultParams: { test_size: 0.2, stratify: true } },
  { type: 'train', label: 'Train Model', description: 'Run AutoML training on the prepared data', icon: Brain, defaultParams: { cv: 5 } },
  { type: 'evaluate', label: 'Evaluate', description: 'Read evaluation metrics from the trained model', icon: BarChart3, defaultParams: {} },
  { type: 'predict', label: 'Predict', description: 'Make a sample prediction with the trained model', icon: Sparkles, defaultParams: { sample_input: {} } },
  { type: 'deploy', label: 'Deploy', description: 'Create a deployment endpoint for the model', icon: Rocket, defaultParams: { endpoint_name: '' } },
];

function stepDef(type: string) {
  return STEP_DEFS.find((d) => d.type === type);
}

interface PipelineBuilderProps {
  pipeline: Pipeline;
  onBack: () => void;
  onSaved?: () => void;
}

export function PipelineBuilder({ pipeline, onBack, onSaved }: PipelineBuilderProps) {
  const qc = useQueryClient();
  const { notifySuccess, notifyError } = useNotification();

  const [name, setName] = useState(pipeline.name);
  const [description, setDescription] = useState(pipeline.description ?? '');
  const [steps, setSteps] = useState<PipelineStep[]>(pipeline.steps ?? []);
  const [addType, setAddType] = useState<StepType>('load_dataset');
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const [invalidJson, setInvalidJson] = useState(false);

  const { data: datasets } = useQuery({
    queryKey: ['datasets', 'builder'],
    queryFn: () => datasetsService.list(),
    staleTime: 60_000,
  });

  const updateParam = (idx: number, key: string, value: any) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, params: { ...s.params, [key]: value } } : s)));
  };

  const addStep = (type: StepType) => {
    const def = stepDef(type);
    if (!def) return;
    setSteps((prev) => [...prev, { type, params: { ...def.defaultParams } }]);
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const to = idx + dir;
      if (to < 0 || to >= next.length) return prev;
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: () => pipelinesService.update(pipeline.id, { name, description, steps }),
    onSuccess: () => {
      notifySuccess('Pipeline saved');
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      onSaved?.();
    },
    onError: (err) => notifyError('Failed to save pipeline', getErrorMessage(err)),
  });

  const runMutation = useMutation({
    mutationFn: () => pipelinesService.run(pipeline.id),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      if (run.status === 'failed') {
        notifyError('Pipeline run failed', run.error || 'Unknown error');
      } else {
        notifySuccess('Pipeline run completed', run.current_step || undefined);
      }
    },
    onError: (err) => notifyError('Failed to run pipeline', getErrorMessage(err)),
  });

  const handleSave = () => {
    if (invalidJson) {
      notifyError('Invalid JSON', 'Fix the sample_input field before saving.');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="secondary" size="sm" onClick={onBack} icon={<ArrowLeft className="w-4 h-4" />}>
            Back
          </Button>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-zinc-100 truncate">{pipeline.name}</h2>
            <p className="text-xs text-zinc-500">{steps.length} steps · {pipeline.status || 'draft'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => runMutation.mutate()} loading={runMutation.isPending} icon={<Play className="w-4 h-4" />}>
            Run
          </Button>
          <Button onClick={handleSave} loading={saveMutation.isPending} icon={<Save className="w-4 h-4" />}>
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Steps</h3>

            {steps.length === 0 ? (
              <div className="py-8 text-center">
                <GripVertical className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No steps yet. Add your first step below.</p>
                <p className="text-[11px] text-zinc-600 mt-1">Recommended order: Load Dataset → Split → Train → Evaluate → Predict / Deploy</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {steps.map((step, idx) => {
                  const def = stepDef(step.type);
                  if (!def) {
                    return (
                      <div key={idx} className="rounded-lg border border-red-500/20 bg-red-500/[0.04] px-3 py-2 text-xs text-red-400">
                        Unknown step type “{step.type}”
                      </div>
                    );
                  }
                  const Icon = def.icon;
                  return (
                    <div key={idx} className="rounded-xl border border-border bg-white/[0.02]">
                      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-white/[0.05]">
                        <span className="w-6 text-center text-[11px] font-mono text-zinc-600">{idx + 1}</span>
                        <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-zinc-100">{def.label}</div>
                          <div className="text-[11px] text-zinc-500 truncate">{def.description}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} title="Move up" className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-primary/40 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} title="Move down" className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:border-primary/40 disabled:opacity-30 disabled:pointer-events-none transition-colors">
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removeStep(idx)} title="Remove step" className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <StepParams
                          type={step.type}
                          params={step.params}
                          onChange={(key, value) => updateParam(idx, key, value)}
                          datasetOptions={(datasets?.datasets || []).map((d) => ({ value: d.name, label: d.name }))}
                          jsonDraft={jsonDrafts[`${idx}:sample_input`]}
                          onJsonDraft={(value) => {
                            const key = `${idx}:sample_input`;
                            setJsonDrafts((prev) => ({ ...prev, [key]: value }));
                            try {
                              const parsed = JSON.parse(value);
                              updateParam(idx, 'sample_input', parsed);
                              setInvalidJson(false);
                            } catch {
                              setInvalidJson(value.trim().length > 0);
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-white/[0.05] flex flex-wrap items-center gap-2">
              <Select
                value={addType}
                onChange={(e) => setAddType(e.target.value as StepType)}
                options={STEP_DEFS.map((d) => ({ value: d.type, label: d.label }))}
                className="w-56"
              />
              <Button variant="secondary" onClick={() => addStep(addType)} icon={<Plus className="w-4 h-4" />}>
                Add Step
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Pipeline Settings</h3>
            <div className="space-y-3">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My pipeline" />
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What does this pipeline do?"
                  className="w-full rounded bg-card border border-border px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Steps</h3>
            {steps.length === 0 ? (
              <p className="text-xs text-zinc-500">This pipeline has no steps yet.</p>
            ) : (
              <ol className="space-y-1.5">
                {steps.map((step, idx) => {
                  const def = stepDef(step.type);
                  return (
                    <li key={idx} className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="w-4 text-right font-mono text-zinc-600">{idx + 1}</span>
                      {def && <def.icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
                      <span className="truncate">{def?.label ?? step.type}</span>
                      {idx < steps.length - 1 && <span className="text-zinc-700">→</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepParams({
  type, params, onChange, datasetOptions, jsonDraft, onJsonDraft,
}: {
  type: string;
  params: Record<string, any>;
  onChange: (key: string, value: any) => void;
  datasetOptions: { value: string; label: string }[];
  jsonDraft?: string;
  onJsonDraft: (value: string) => void;
}) {
  if (type === 'load_dataset') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select
          label="Dataset"
          placeholder="Select a dataset…"
          options={datasetOptions}
          value={params.dataset ?? ''}
          onChange={(e) => onChange('dataset', e.target.value)}
        />
        <Input label="Target column" value={params.target_column ?? ''} onChange={(e) => onChange('target_column', e.target.value)} placeholder="e.g. target" hint="Column used as prediction target" />
      </div>
    );
  }

  if (type === 'split') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label="Test size"
          type="number"
          min={0.05}
          max={0.9}
          step={0.05}
          value={params.test_size ?? 0.2}
          onChange={(e) => onChange('test_size', Number(e.target.value))}
          hint="Fraction of rows held out for testing (0.05–0.9)"
        />
        <label className="flex items-center gap-2.5 pt-6 text-sm text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={!!params.stratify}
            onChange={(e) => onChange('stratify', e.target.checked)}
            className="w-4 h-4 rounded border-border bg-card accent-primary"
          />
          Stratify split
        </label>
      </div>
    );
  }

  if (type === 'train') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label="Cross-validation folds"
          type="number"
          min={2}
          max={20}
          step={1}
          value={params.cv ?? 5}
          onChange={(e) => onChange('cv', Number(e.target.value))}
          hint="Number of CV folds used during training"
        />
      </div>
    );
  }

  if (type === 'evaluate') {
    return (
      <div className="flex items-start gap-2 text-xs text-zinc-500">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Reads evaluation metrics from the model produced by the train step. No configuration required.
      </div>
    );
  }

  if (type === 'predict') {
    return (
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">Sample input (JSON)</label>
        <textarea
          value={jsonDraft ?? JSON.stringify(params.sample_input ?? {}, null, 2)}
          onChange={(e) => onJsonDraft(e.target.value)}
          rows={4}
          spellCheck={false}
          className={cn(
            'w-full rounded bg-card border px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-2 resize-y',
            'focus:ring-primary/50 focus:border-primary/50',
            'border-border',
          )}
        />
        <p className="text-[11px] text-zinc-600 mt-1">JSON object of feature values for the prediction. Leave empty to use zeros.</p>
      </div>
    );
  }

  if (type === 'deploy') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input
          label="Endpoint name"
          value={params.endpoint_name ?? ''}
          onChange={(e) => onChange('endpoint_name', e.target.value)}
          placeholder="e.g. my-model-prod"
          hint="Leave empty for an auto-generated name"
        />
      </div>
    );
  }

  return (
    <p className="text-xs text-zinc-500">This step type has no configuration options.</p>
  );
}
