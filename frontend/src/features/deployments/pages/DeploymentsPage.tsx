import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, Shield, Code, Server, Box, Download, ArrowDownToLine, Package,
  History, Plus, RefreshCw, Trash2, Play, Square, RotateCcw, Copy, Check,
  AlertTriangle, Clock, Activity, Zap, ExternalLink, ChevronLeft,
} from 'lucide-react';
import {
  useDeployments, useDeploymentDetail, useDeploymentHistory, useCreateDeployment,
  useDeleteDeployment, useUpdateDeploymentStatus, useUpdateDeploymentAccess,
  useModels,
} from '../../../hooks/useApi';
import { deploymentsService } from '../../../services/deployments.service';
import type { Deployment, DeploymentHistoryEntry } from '../../../types/api';
import styles from './DeploymentsPage.module.css';

function StatusBadge({ status }: { status: string }) {
  const s = status === 'active' || status === 'running' ? 'live' : status === 'stopped' ? 'down' : 'draining';
  return <span className={`${styles.badge} ${styles[`badge${s.charAt(0).toUpperCase() + s.slice(1)}`]}`}>{status}</span>;
}

function CopyBlock({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }, [text]);
  return (
    <div className={styles.codeBlock}>
      {label && <div className={styles.codeLabel}>{label}</div>}
      <div className={styles.codeToolbar}>
        <button className={styles.copyBtn} onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <pre className={styles.codePre}><code>{text}</code></pre>
    </div>
  );
}

function AccessControlTab({ dep }: { dep: Deployment }) {
  const updateAccess = useUpdateDeploymentAccess();
  const [anonymous, setAnonymous] = useState(dep.allow_anonymous ?? false);
  const [apiKeyReq, setApiKeyReq] = useState(dep.api_key_required ?? true);
  const [rateLimit, setRateLimit] = useState(dep.rate_limit ?? '');
  const [users, setUsers] = useState((dep.allowed_users ?? []).join('\n'));
  const [ips, setIps] = useState((dep.allowed_ips ?? []).join('\n'));

  const handleSave = () => {
    updateAccess.mutate({
      id: dep.id,
      allow_anonymous: anonymous,
      api_key_required: apiKeyReq,
      rate_limit: rateLimit === '' ? null : Number(rateLimit),
      allowed_users: users.split('\n').filter(Boolean),
      allowed_ips: ips.split('\n').filter(Boolean),
    });
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><Shield size={16} /> Authentication</h3>
        <label className={styles.toggleRow}>
          <span>Allow anonymous access</span>
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className={styles.toggle} />
        </label>
        <label className={styles.toggleRow}>
          <span>Require API key / JWT</span>
          <input type="checkbox" checked={apiKeyReq} onChange={(e) => setApiKeyReq(e.target.checked)} className={styles.toggle} />
        </label>
      </div>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><Zap size={16} /> Rate Limiting</h3>
        <div className={styles.formField}>
          <label>Requests per minute (0 = unlimited)</label>
          <input type="number" value={rateLimit} onChange={(e) => setRateLimit(e.target.value)} className={styles.input} placeholder="e.g. 60" />
        </div>
      </div>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Allowed Users (one per line)</h3>
        <textarea value={users} onChange={(e) => setUsers(e.target.value)} className={styles.textarea} rows={4} placeholder="user@example.com" />
      </div>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Allowed IPs (one per line)</h3>
        <textarea value={ips} onChange={(e) => setIps(e.target.value)} className={styles.textarea} rows={4} placeholder="192.168.1.0/24" />
      </div>
      <button className={styles.saveBtn} onClick={handleSave} disabled={updateAccess.isPending}>
        {updateAccess.isPending ? 'Saving...' : 'Save Access Settings'}
      </button>
    </div>
  );
}

function RestApiTab({ dep }: { dep: Deployment }) {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    deploymentsService.apiSpec(dep.id).then((data) => { setSpec(data); setLoading(false); }).catch(() => setLoading(false));
  }, [dep.id]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><Code size={16} /> REST API Endpoint</h3>
        <div className={styles.endpointBox}>
          <span className={styles.endpointMethod}>POST</span>
          <span className={styles.endpointUrl}>{dep.endpoint_url}</span>
        </div>
        <p className={styles.hint}>Send JSON payloads to this endpoint with a valid JWT or API key in the Authorization header.</p>
      </div>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Request Format</h3>
        <CopyBlock label="Example Request" text={`curl -X POST ${window.location.origin}${dep.endpoint_url} \\\n  -H "Authorization: Bearer YOUR_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"features": [0.5, 1.2, 3.0]}'`} />
      </div>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Response Format</h3>
        <CopyBlock label="Example Response" text={`{\n  "prediction": "class_1",\n  "confidence": 0.9523,\n  "model": "${dep.model_id}"\n}`} />
      </div>
      {spec && (
        <div className={styles.formSection}>
          <h3 className={styles.sectionTitle}>OpenAPI Specification</h3>
          <CopyBlock label="openapi.json" text={JSON.stringify(spec, null, 2)} />
        </div>
      )}
    </div>
  );
}

function FastApiTab({ dep }: { dep: Deployment }) {
  const [code, setCode] = useState(dep.fastapi_code || '');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await deploymentsService.fastapiCode(dep.id);
      setCode(res.code);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { if (!code) generate(); }, []);

  return (
    <div className={styles.tabContent}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><Server size={16} /> FastAPI Serving Code</h3>
        <p className={styles.hint}>Auto-generated FastAPI server for model inference with health checks and prediction endpoint.</p>
        <button className={styles.genBtn} onClick={generate} disabled={loading}>
          <RefreshCw size={14} className={loading ? styles.spin : ''} /> Regenerate
        </button>
      </div>
      {code && <CopyBlock label="serving.py" text={code} />}
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Quick Start</h3>
        <CopyBlock label="Run locally" text={`pip install fastapi uvicorn numpy scikit-learn\nuvicorn ${dep.name}_serving:app --host 0.0.0.0 --port ${dep.docker_port || 8080} --reload`} />
      </div>
    </div>
  );
}

function DockerTab({ dep }: { dep: Deployment }) {
  const [data, setData] = useState<{ compose: string; dockerfile: string; image: string; port: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await deploymentsService.dockerCompose(dep.id);
      setData(res);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { generate(); }, []);

  return (
    <div className={styles.tabContent}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><Box size={16} /> Docker Deployment</h3>
        <p className={styles.hint}>Containerized deployment with docker-compose. Includes health checks and auto-restart.</p>
        <button className={styles.genBtn} onClick={generate} disabled={loading}>
          <RefreshCw size={14} className={loading ? styles.spin : ''} /> Regenerate
        </button>
      </div>
      {data && (
        <>
          <div className={styles.dockerInfo}>
            <div className={styles.dockerStat}><span>Image</span><strong>{data.image}</strong></div>
            <div className={styles.dockerStat}><span>Port</span><strong>{data.port}</strong></div>
          </div>
          <CopyBlock label="docker-compose.yml" text={data.compose} />
          <CopyBlock label="Dockerfile" text={data.dockerfile} />
        </>
      )}
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Deploy</h3>
        <CopyBlock label="Commands" text={`docker-compose build\ndocker-compose up -d\ndocker-compose logs -f`} />
      </div>
    </div>
  );
}

function DownloadTab({ dep }: { dep: Deployment }) {
  const exportPickle = useUpdateDeploymentStatus();
  const [pickleResult, setPickleResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleExportPickle = async () => {
    setLoading(true);
    try {
      const res = await deploymentsService.exportPickle(dep.id);
      setPickleResult(res);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const modelFile = `${dep.model_id}.pkl`;

  return (
    <div className={styles.tabContent}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><Download size={16} /> Download Model</h3>
        <p className={styles.hint}>Download the trained model file for local use or redeployment.</p>
        <div className={styles.downloadCard}>
          <div className={styles.downloadInfo}>
            <Package size={24} />
            <div>
              <strong>{modelFile}</strong>
              <span>Model file (.pkl)</span>
            </div>
          </div>
          <a href={deploymentsService.download(dep.id)} className={styles.downloadBtn} download>
            <Download size={16} /> Download
          </a>
        </div>
      </div>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Pickle Export</h3>
        <p className={styles.hint}>Export and prepare the model as a downloadable pickle archive.</p>
        <button className={styles.genBtn} onClick={handleExportPickle} disabled={loading}>
          {loading ? 'Exporting...' : 'Export Pickle'}
        </button>
        {pickleResult && (
          <div className={styles.exportResult}>
            <Check size={16} />
            <div>
              <strong>{pickleResult.filename}</strong>
              <span>{(pickleResult.size_bytes / 1024).toFixed(1)} KB</span>
            </div>
            <a href={deploymentsService.download(dep.id)} className={styles.downloadBtn} download>
              <Download size={14} /> Download
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function OnnxTab({ dep }: { dep: Deployment }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await deploymentsService.exportOnnx(dep.id);
      setResult(res);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><ArrowDownToLine size={16} /> ONNX Export</h3>
        <p className={styles.hint}>Export the model to ONNX format for cross-platform inference optimization (TensorRT, ONNX Runtime, etc).</p>
        {dep.onnx_model_path && (
          <div className={styles.exportResult}>
            <Check size={16} />
            <span>Previously exported: {dep.onnx_model_path}</span>
          </div>
        )}
        <button className={styles.genBtn} onClick={handleExport} disabled={loading}>
          {loading ? 'Exporting...' : 'Export to ONNX'}
        </button>
        {result && (
          <div className={styles.exportResult}>
            <Check size={16} />
            <div>
              <strong>{result.filename}</strong>
              <span>{result.path}</span>
            </div>
          </div>
        )}
      </div>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Why ONNX?</h3>
        <div className={styles.benefitList}>
          <div className={styles.benefit}><Zap size={14} /> <span>2-5x faster inference with ONNX Runtime</span></div>
          <div className={styles.benefit}><Box size={14} /> <span>Deploy to edge devices, mobile, and web</span></div>
          <div className={styles.benefit}><Server size={14} /> <span>Framework-agnostic format</span></div>
        </div>
      </div>
    </div>
  );
}

function PickleTab({ dep }: { dep: Deployment }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await deploymentsService.exportPickle(dep.id);
      setResult(res);
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><Package size={16} /> Pickle Export</h3>
        <p className={styles.hint}>Export the model as a Python pickle file for direct use with scikit-learn, pandas, or custom pipelines.</p>
        <button className={styles.genBtn} onClick={handleExport} disabled={loading}>
          {loading ? 'Exporting...' : 'Export Pickle File'}
        </button>
        {result && (
          <div className={styles.exportResult}>
            <Check size={16} />
            <div>
              <strong>{result.filename}</strong>
              <span>{(result.size_bytes / 1024).toFixed(1)} KB</span>
            </div>
            <a href={deploymentsService.download(dep.id)} className={styles.downloadBtn} download>
              <Download size={14} /> Download
            </a>
          </div>
        )}
      </div>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Usage</h3>
        <CopyBlock label="Python" text={`import pickle\n\nwith open("${dep.model_id}.pkl", "rb") as f:\n    model = pickle.load(f)\n\n# Make predictions\nprediction = model.predict([[0.5, 1.2, 3.0]])\nprint(prediction)`} />
      </div>
    </div>
  );
}

function HistoryTab({ dep }: { dep: Deployment }) {
  const { data: history, isLoading } = useDeploymentHistory(dep.id);

  const actionIcon = (action: string) => {
    if (action.includes('created')) return <Plus size={14} />;
    if (action.includes('status_')) return <Activity size={14} />;
    if (action.includes('access')) return <Shield size={14} />;
    if (action.includes('onnx')) return <ArrowDownToLine size={14} />;
    if (action.includes('pickle') || action.includes('download')) return <Download size={14} />;
    if (action.includes('docker')) return <Box size={14} />;
    if (action.includes('fastapi')) return <Server size={14} />;
    return <Clock size={14} />;
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}><History size={16} /> Deployment History</h3>
      </div>
      {isLoading ? (
        <div className={styles.loadingInline}><RefreshCw size={16} className={styles.spin} /> Loading history...</div>
      ) : (
        <div className={styles.timeline}>
          {(history ?? []).map((entry: DeploymentHistoryEntry, i: number) => (
            <motion.div key={entry.id} className={styles.timelineItem}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <div className={styles.timelineDot}>{actionIcon(entry.action)}</div>
              <div className={styles.timelineContent}>
                <div className={styles.timelineAction}>{entry.action.replace(/_/g, ' ')}</div>
                {entry.old_status && entry.new_status && (
                  <div className={styles.timelineStatus}>
                    <StatusBadge status={entry.old_status} /> &rarr; <StatusBadge status={entry.new_status} />
                  </div>
                )}
                {entry.actor && <div className={styles.timelineActor}>by {entry.actor}</div>}
                {entry.details && <div className={styles.timelineDetails}>{JSON.stringify(entry.details)}</div>}
              </div>
              <span className={styles.timelineTime}>
                {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
              </span>
            </motion.div>
          ))}
          {(!history || history.length === 0) && (
            <div className={styles.emptyState}>No history entries yet</div>
          )}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: 'access', label: 'Access Control', icon: Shield },
  { id: 'rest-api', label: 'REST API', icon: Code },
  { id: 'fastapi', label: 'FastAPI', icon: Server },
  { id: 'docker', label: 'Docker', icon: Box },
  { id: 'download', label: 'Download', icon: Download },
  { id: 'onnx', label: 'ONNX Export', icon: ArrowDownToLine },
  { id: 'pickle', label: 'Pickle Export', icon: Package },
  { id: 'history', label: 'History', icon: History },
] as const;

type TabId = typeof TABS[number]['id'];

export default function DeploymentsPage() {
  const { data: deployments, isLoading } = useDeployments();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { data: dep, isLoading: depLoading } = useDeploymentDetail(selectedId);
  const [activeTab, setActiveTab] = useState<TabId>('rest-api');
  const deleteDeployment = useDeleteDeployment();
  const updateStatus = useUpdateDeploymentStatus();

  const deps = deployments ?? [];
  const active = deps.filter((d: Deployment) => d.status === 'active' || d.status === 'running');
  const totalReqs = deps.reduce((s: number, d: Deployment) => s + (d.requests_count || 0), 0);
  const avgLat = deps.length ? Math.round(deps.reduce((s: number, d: Deployment) => s + (d.avg_latency_ms || 0), 0) / deps.length) : 0;

  if (selectedId && dep) {
    return (
      <div className={styles.page}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className={styles.detailHeader}>
            <button className={styles.backBtn} onClick={() => { setSelectedId(null); setActiveTab('rest-api'); }}>
              <ChevronLeft size={18} /> Back
            </button>
            <div className={styles.detailTitle}>
              <div className={styles.depAvatar}><Rocket size={18} /></div>
              <div>
                <h1>{dep.endpoint_name || dep.model_name || dep.name}</h1>
                <p>{dep.endpoint_url} &middot; {dep.model_id}</p>
              </div>
            </div>
            <div className={styles.detailActions}>
              <StatusBadge status={dep.status} />
              {dep.status === 'active' || dep.status === 'running' ? (
                <button className={styles.actionBtnDanger} onClick={() => updateStatus.mutate({ id: dep.id, status: 'stopped' })}>
                  <Square size={14} /> Stop
                </button>
              ) : (
                <button className={styles.actionBtn} onClick={() => updateStatus.mutate({ id: dep.id, status: 'active' })}>
                  <Play size={14} /> Start
                </button>
              )}
              <button className={styles.actionBtn} onClick={() => updateStatus.mutate({ id: dep.id, status: 'active' })}>
                <RotateCcw size={14} /> Restart
              </button>
              <button className={styles.deleteBtn} onClick={() => { deleteDeployment.mutate(dep.id, { onSuccess: () => setSelectedId(null) }); }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>

          <div className={styles.detailStats}>
            <div className={styles.detailStat}>
              <span>Type</span><strong>{dep.deployment_type || 'rest_api'}</strong>
            </div>
            <div className={styles.detailStat}>
              <span>Requests</span><strong>{dep.requests_count ?? 0}</strong>
            </div>
            <div className={styles.detailStat}>
              <span>Avg Latency</span><strong>{dep.avg_latency_ms ?? 0}ms</strong>
            </div>
            <div className={styles.detailStat}>
              <span>Environment</span><strong>{dep.environment}</strong>
            </div>
            <div className={styles.detailStat}>
              <span>Created</span><strong>{dep.created_at ? new Date(dep.created_at).toLocaleDateString() : '—'}</strong>
            </div>
          </div>

          <div className={styles.tabBar}>
            {TABS.map((tab) => (
              <button key={tab.id}
                className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab(tab.id)}>
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}>
              {activeTab === 'access' && <AccessControlTab dep={dep} />}
              {activeTab === 'rest-api' && <RestApiTab dep={dep} />}
              {activeTab === 'fastapi' && <FastApiTab dep={dep} />}
              {activeTab === 'docker' && <DockerTab dep={dep} />}
              {activeTab === 'download' && <DownloadTab dep={dep} />}
              {activeTab === 'onnx' && <OnnxTab dep={dep} />}
              {activeTab === 'pickle' && <PickleTab dep={dep} />}
              {activeTab === 'history' && <HistoryTab dep={dep} />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>Deployments</h1>
            <p className={styles.headerDesc}>Deploy, manage, and export your trained models</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.newBtn} onClick={() => setShowForm(!showForm)}>
              <Plus size={16} className={styles.newBtnIcon} /> New Deployment
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <NewDeploymentForm onDone={() => setShowForm(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <span className={styles.statLabel}>Total Endpoints</span>
              <div className={`${styles.statIcon} ${styles.statIconPrimary}`}><Rocket size={16} /></div>
            </div>
            <div className={styles.statValue}>{deps.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <span className={styles.statLabel}>Active</span>
              <div className={`${styles.statIcon} ${styles.statIconSuccess}`}><Activity size={16} /></div>
            </div>
            <div className={styles.statValue}>{active.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <span className={styles.statLabel}>Avg Latency</span>
              <div className={`${styles.statIcon} ${styles.statIconWarning}`}><Zap size={16} /></div>
            </div>
            <div className={styles.statValue}>{avgLat}ms</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statTop}>
              <span className={styles.statLabel}>Total Requests</span>
              <div className={`${styles.statIcon} ${styles.statIconInfo}`}><Activity size={16} /></div>
            </div>
            <div className={styles.statValue}>{totalReqs.toLocaleString()}</div>
          </div>
        </div>

        {isLoading ? (
          <div className={styles.emptyState}><RefreshCw size={20} className={styles.spin} /> Loading deployments...</div>
        ) : deps.length === 0 ? (
          <div className={styles.emptyState}><Rocket size={32} /><p>No deployments yet</p><span>Create your first deployment to serve a model.</span></div>
        ) : (
          <div className={styles.grid}>
            {deps.map((d: Deployment) => (
              <motion.div key={d.id} className={styles.depCard}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }} transition={{ duration: 0.2 }}>
                <div className={styles.depCardTop}>
                  <div className={`${styles.depAvatar} ${d.status === 'active' ? styles.depAvatarLive : styles.depAvatarDown}`}>
                    <Rocket size={18} />
                  </div>
                  <div className={styles.depIdentity}>
                    <span className={styles.depName}>{d.endpoint_name || d.name}</span>
                    <span className={styles.depModel}>{d.model_id}</span>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
                <div className={styles.metrics}>
                  <div className={styles.metric}><span className={styles.metricValue}>{d.avg_latency_ms ?? 0}ms</span><span className={styles.metricLabel}>Latency</span></div>
                  <div className={styles.metric}><span className={styles.metricValue}>{d.requests_count ?? 0}</span><span className={styles.metricLabel}>Requests</span></div>
                  <div className={styles.metric}><span className={styles.metricValue}>{d.deployment_type || 'rest_api'}</span><span className={styles.metricLabel}>Type</span></div>
                </div>
                <div className={styles.cardFooter}>
                  <span className={styles.footerMeta}>{d.endpoint_url}</span>
                  <button className={styles.btnSmall} onClick={() => setSelectedId(d.id)}>Details &rarr;</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function NewDeploymentForm({ onDone }: { onDone: () => void }) {
  const { data: models } = useModels();
  const createDeployment = useCreateDeployment();
  const [modelName, setModelName] = useState('');
  const [endpointName, setEndpointName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName || !endpointName) return;
    createDeployment.mutate({ model_name: modelName, endpoint_name: endpointName }, { onSuccess: onDone });
  };

  const modelFiles = models?.filter((m: any) => m.file_path?.endsWith('.pkl') || m.name) ?? [];

  return (
    <form className={styles.formCard} onSubmit={handleSubmit}>
      <h3 className={styles.formTitle}>New Deployment</h3>
      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label>Model</label>
          <select value={modelName} onChange={(e) => setModelName(e.target.value)} className={styles.select}>
            <option value="">Select model...</option>
            {modelFiles.map((m: any) => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </div>
        <div className={styles.formField}>
          <label>Endpoint Name</label>
          <input value={endpointName} onChange={(e) => setEndpointName(e.target.value)}
            className={styles.input} placeholder="my-api-v1" required />
        </div>
      </div>
      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onDone}>Cancel</button>
        <button type="submit" className={styles.createBtn} disabled={createDeployment.isPending}>
          {createDeployment.isPending ? 'Deploying...' : 'Deploy'}
        </button>
      </div>
    </form>
  );
}
