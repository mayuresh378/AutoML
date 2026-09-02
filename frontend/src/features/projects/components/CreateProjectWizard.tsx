import { useRef, useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Target, TrendingUp, LineChart, Boxes, Upload, Database, HardDrive, Cloud,
  Link, Server, Rocket, Check, ChevronLeft, ChevronRight, X, Tag, FileUp, Users, UserRound,
} from 'lucide-react';
import { projectsService, type ProjectProblemType, type ProjectVisibility } from '../../../services/projects.service';
import { http, getErrorMessage } from '../../../services/http';
import { useNotification } from '../../../hooks/useNotification';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import styles from './CreateProjectWizard.module.css';

const STEPS = ['Basics', 'Dataset', 'Compute', 'Review'];

const PROBLEM_TYPES: { key: ProjectProblemType; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'classification', label: 'Classification', desc: 'Predict a category or label', icon: <Target className="w-4 h-4" /> },
  { key: 'regression', label: 'Regression', desc: 'Predict a continuous value', icon: <TrendingUp className="w-4 h-4" /> },
  { key: 'time_series', label: 'Time Series', desc: 'Forecast values over time', icon: <LineChart className="w-4 h-4" /> },
  { key: 'clustering', label: 'Clustering', desc: 'Discover groups in unlabeled data', icon: <Boxes className="w-4 h-4" /> },
];

const SOURCES = [
  { key: 'upload', label: 'CSV / Excel / Parquet', icon: <FileUp className="w-4 h-4" /> },
  { key: 'postgresql', label: 'PostgreSQL', icon: <Database className="w-4 h-4" /> },
  { key: 'mysql', label: 'MySQL', icon: <Database className="w-4 h-4" /> },
  { key: 's3', label: 'Amazon S3', icon: <Cloud className="w-4 h-4" /> },
  { key: 'azure', label: 'Azure Blob', icon: <Cloud className="w-4 h-4" /> },
  { key: 'gcs', label: 'Google Cloud Storage', icon: <Cloud className="w-4 h-4" /> },
  { key: 'sql', label: 'SQL Server', icon: <Server className="w-4 h-4" /> },
  { key: 'rest', label: 'REST API', icon: <Link className="w-4 h-4" /> },
  { key: 'streaming', label: 'Streaming / Kafka', icon: <HardDrive className="w-4 h-4" /> },
];

const COMPUTE = [
  { key: 'small', name: 'Starter', spec: '2 vCPU · 8 GB · 4 workers', price: '$0.09 /hr' },
  { key: 'large', name: 'Standard', spec: '8 vCPU · 32 GB · 8 workers', price: '$0.36 /hr' },
  { key: 'gpu', name: 'GPU Accelerated', spec: '4x GPU · 64 GB · 4 workers', price: '$1.40 /hr' },
];

interface CreateProjectWizardProps {
  open: boolean;
  onClose: () => void;
}

export default function CreateProjectWizard({ open, onClose }: CreateProjectWizardProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { notifySuccess, notifyError } = useNotification();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [problemType, setProblemType] = useState<ProjectProblemType>('classification');
  const [visibility, setVisibility] = useState<ProjectVisibility>('private');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [source, setSource] = useState('upload');
  const [file, setFile] = useState<File | null>(null);
  const [compute, setCompute] = useState('small');

  useEffect(() => {
    if (open) {
      setStep(0);
      setName('');
      setDescription('');
      setProblemType('classification');
      setVisibility('private');
      setTags([]);
      setTagInput('');
      setSource('upload');
      setFile(null);
      setCompute('small');
    }
  }, [open]);

  const addTag = () => {
    const t = tagInput.trim().replace(/,/g, '');
    if (t && !tags.includes(t) && tags.length < 8) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const canNext =
    step === 0 ? name.trim().length > 0 : true;

  const createMutation = useMutation({
    mutationFn: () =>
      projectsService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        problem_type: problemType,
        visibility,
        tags: tags.length ? tags : undefined,
      }),
    onSuccess: async (project) => {
      let uploaded = false;
      if (file) {
        try {
          await http.upload<{ message: string }>('/datasets', file, 'file', { project_id: project.id });
          uploaded = true;
        } catch (e) {
          notifyError('Project created, but dataset upload failed', getErrorMessage(e));
        }
      }
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['datasets'] });
      notifySuccess(uploaded ? 'Project created with dataset' : 'Project created');
      onClose();
      navigate(`/app/projects/${project.id}`);
    },
    onError: (err) => notifyError('Failed to create project', getErrorMessage(err)),
  });

  const handleCreate = () => createMutation.mutate();

  return (
    <Modal open={open} onClose={onClose} title="New Project" description="Set up your machine learning project" size="lg">
      <div className={styles.stepper}>
        {STEPS.map((label, i) => (
          <div key={label} className={`${styles.step} ${i === step ? styles.stepActive : ''} ${i < step ? styles.stepDone : ''}`}>
            <div className={styles.stepNum}>{i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}</div>
            <span className={styles.stepLabel}>{label}</span>
            {i < STEPS.length - 1 && <div className={`${styles.stepLine} ${i < step ? styles.stepLineDone : ''}`} />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <Input
            label="Project Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Customer Churn Prediction"
            autoFocus
          />
          <div>
            <label className={styles.sectionLabel}>Description</label>
            <textarea
              className="w-full rounded bg-card border border-border px-4 py-2.5 text-sm text-zinc-200 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about? (optional)"
            />
          </div>
          <div>
            <span className={styles.sectionLabel}>Problem Type</span>
            <div className={styles.problemGrid}>
              {PROBLEM_TYPES.map((p) => (
                <button key={p.key} type="button" className={`${styles.problemCard} ${problemType === p.key ? styles.problemActive : ''}`} onClick={() => setProblemType(p.key)}>
                  <div className={styles.problemHeader}>
                    <div className={styles.problemIcon}>{p.icon}</div>
                    <span className={styles.problemTitle}>{p.label}</span>
                  </div>
                  <span className={styles.problemDesc}>{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <span className={styles.sectionLabel}>Visibility</span>
              <div className={styles.segGroup}>
                <button type="button" className={`${styles.segBtn} ${visibility === 'private' ? styles.segActive : ''}`} onClick={() => setVisibility('private')}>
                  <UserRound className="w-3.5 h-3.5" /> Private
                </button>
                <button type="button" className={`${styles.segBtn} ${visibility === 'team' ? styles.segActive : ''}`} onClick={() => setVisibility('team')}>
                  <Users className="w-3.5 h-3.5" /> Team
                </button>
              </div>
            </div>
            <div>
              <span className={styles.sectionLabel}>Tags</span>
              <div className={styles.tagInputRow}>
                <Input
                  className={styles.tagInput}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="Add tag, press Enter"
                  icon={<Tag className="w-4 h-4" />}
                />
                <Button variant="secondary" size="md" onClick={addTag} disabled={!tagInput.trim()}>Add</Button>
              </div>
              {tags.length > 0 && (
                <div className={styles.tagChips}>
                  {tags.map((t) => (
                    <span key={t} className={styles.tagChip}>
                      {t}
                      <button type="button" className={styles.tagRemove} onClick={() => removeTag(t)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <span className={styles.sectionLabel}>Import Dataset</span>
          <p className={styles.sectionHint}>Choose where your training data comes from.</p>
          <div className={styles.sourceGrid}>
            {SOURCES.map((s) => (
              <button key={s.key} type="button" className={`${styles.sourceCard} ${source === s.key ? styles.sourceActive : ''}`} onClick={() => setSource(s.key)}>
                <div className={styles.sourceIcon}>{s.icon}</div>
                <span className={styles.sourceName}>{s.label}</span>
              </button>
            ))}
          </div>

          {source === 'upload' && (
            <div className="mt-5">
              <input ref={fileRef} type="file" className="hidden" accept=".csv,.tsv,.xlsx,.xls,.parquet,.json,.jsonl" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {file ? (
                <div className={styles.fileInfo}>
                  <FileUp className="w-4 h-4" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-zinc-500">{Math.round(file.size / 1024)} KB</span>
                  <button type="button" className="text-primary hover:text-primary/80" onClick={() => fileRef.current?.click()}>Change</button>
                </div>
              ) : (
                <div className={styles.fileDrop} onClick={() => fileRef.current?.click()}>
                  <div className={styles.fileDropIcon}><Upload className="w-5 h-5" /></div>
                  <span className={styles.fileDropText}>Drop a file here or click to browse</span>
                  <span className={styles.fileDropSub}>CSV, Excel, Parquet, JSON — up to 100 MB</span>
                </div>
              )}
            </div>
          )}

          {source !== 'upload' && (
            <div className={styles.sourceNote}>
              Connecting to <strong className="text-zinc-300">{SOURCES.find((s) => s.key === source)?.label}</strong> will be configured after the project is created. You can add data connections from the project's Datasets tab.
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <span className={styles.sectionLabel}>Compute Configuration</span>
          <p className={styles.sectionHint}>Choose the default compute environment for training runs.</p>
          <div className={styles.computeGrid}>
            {COMPUTE.map((c) => (
              <button key={c.key} type="button" className={`${styles.computeCard} ${compute === c.key ? styles.computeActive : ''}`} onClick={() => setCompute(c.key)}>
                <div className={styles.computeTop}>
                  <span className={styles.computeName}>{c.name}</span>
                  {compute === c.key && <Check className="w-4 h-4 text-primary" />}
                </div>
                <span className={styles.computeSpec}>{c.spec}</span>
                <span className={styles.computePrice}>{c.price}</span>
              </button>
            ))}
          </div>
          <div className="mt-5">
            <Select
              label="AutoML Mode"
              options={[
                { value: 'auto', label: 'Automatic — let the engine search' },
                { value: 'guided', label: 'Guided — I set constraints' },
                { value: 'manual', label: 'Manual — full control' },
              ]}
              defaultValue="auto"
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className={styles.reviewCard}>
            <div className={styles.reviewHeader}>
              <span className={styles.reviewTitle}>Basics</span>
              <button type="button" className={styles.reviewEdit} onClick={() => setStep(0)}>Edit</button>
            </div>
            <div className={styles.reviewRows}>
              <div className={styles.reviewRow}><span className={styles.reviewKey}>Name</span><span className={styles.reviewValue}>{name || '—'}</span></div>
              <div className={styles.reviewRow}><span className={styles.reviewKey}>Description</span><span className={styles.reviewValue}>{description || '—'}</span></div>
              <div className={styles.reviewRow}><span className={styles.reviewKey}>Problem Type</span><span className={styles.reviewValue} style={{ textTransform: 'capitalize' }}>{problemType.replace('_', ' ')}</span></div>
              <div className={styles.reviewRow}><span className={styles.reviewKey}>Visibility</span><span className={styles.reviewValue} style={{ textTransform: 'capitalize' }}>{visibility}</span></div>
              {tags.length > 0 && (
                <div className={styles.reviewRow}>
                  <span className={styles.reviewKey}>Tags</span>
                  <div className={styles.reviewTags}>{tags.map((t) => <span key={t} className={styles.reviewTag}>{t}</span>)}</div>
                </div>
              )}
            </div>
          </div>
          <div className={styles.reviewCard}>
            <div className={styles.reviewHeader}>
              <span className={styles.reviewTitle}>Dataset</span>
              <button type="button" className={styles.reviewEdit} onClick={() => setStep(1)}>Edit</button>
            </div>
            <div className={styles.reviewRows}>
              <div className={styles.reviewRow}><span className={styles.reviewKey}>Source</span><span className={styles.reviewValue}>{SOURCES.find((s) => s.key === source)?.label}</span></div>
              {file && <div className={styles.reviewRow}><span className={styles.reviewKey}>File</span><span className={styles.reviewValue}>{file.name}</span></div>}
            </div>
          </div>
          <div className={styles.reviewCard}>
            <div className={styles.reviewHeader}>
              <span className={styles.reviewTitle}>Compute</span>
              <button type="button" className={styles.reviewEdit} onClick={() => setStep(2)}>Edit</button>
            </div>
            <div className={styles.reviewRows}>
              <div className={styles.reviewRow}><span className={styles.reviewKey}>Environment</span><span className={styles.reviewValue}>{COMPUTE.find((c) => c.key === compute)?.name} ({COMPUTE.find((c) => c.key === compute)?.price})</span></div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.wizardFooter}>
        <span className={styles.stepIndicator}>Step {step + 1} of {STEPS.length}</span>
        <div className={styles.footerActions}>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)} icon={<ChevronLeft className="w-4 h-4" />}>Back</Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext} iconRight={<ChevronRight className="w-4 h-4" />}>
              Continue
            </Button>
          ) : (
            <Button onClick={handleCreate} loading={createMutation.isPending} icon={<Rocket className="w-4 h-4" />}>
              {createMutation.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
