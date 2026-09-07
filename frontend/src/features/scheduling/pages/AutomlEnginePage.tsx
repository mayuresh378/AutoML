import { useState, useEffect, useRef } from 'react';
import { engineService, EngineProgress, EngineDataset, EngineModelsResponse, EngineDatasetProfile, EngineRecommendation } from '../../../services/engine.service';
import { datasetsService } from '../../../services/datasets.service';
import type { DatasetProfile } from '../../../types/api';
import { EngineHero } from './components/EngineHero';
import { EngineStepper } from './components/EngineStepper';
import { DatasetStep } from './components/DatasetStep';
import { IntelligencePanel } from './components/IntelligencePanel';
import { TaskStep } from './components/TaskStep';
import { RunModeStep } from './components/RunModeStep';
import { PreprocessStep } from './components/PreprocessStep';
import { AlgorithmStep } from './components/AlgorithmStep';
import { ValidationStep } from './components/ValidationStep';
import { RunSection } from './components/RunSection';
import { TrainingScreen } from './components/TrainingScreen';
import { ResultsPanel } from './components/ResultsPanel';
import { ReportPanel } from './components/ReportPanel';
import styles from './AutoMLEnginePage.module.css';

const STEPS = [
  { id: 'dataset', label: 'Dataset' },
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'task', label: 'Task' },
  { id: 'mode', label: 'Run Mode' },
  { id: 'preprocess', label: 'Preprocessing' },
  { id: 'algorithms', label: 'Algorithms' },
  { id: 'validation', label: 'Validation' },
] as const;

function getTaskAlgorithms(models: EngineModelsResponse | null, taskType: string): string[] {
  if (!models) return [];
  const key = taskType as keyof EngineModelsResponse;
  const val = models[key];
  return Array.isArray(val) ? val : [];
}

export default function AutoMLEnginePage() {
  const [taskType, setTaskType] = useState('classification');
  const [datasets, setDatasets] = useState<EngineDataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState('');
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [targetColumn, setTargetColumn] = useState('');
  const [models, setModels] = useState<EngineModelsResponse | null>(null);
  const [selectedAlgos, setSelectedAlgos] = useState<string[]>([]);

  const [intelProfile, setIntelProfile] = useState<EngineDatasetProfile | null>(null);
  const [recommendation, setRecommendation] = useState<EngineRecommendation | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);

  const [mode, setMode] = useState('auto');
  const [hpoBudget, setHpoBudget] = useState(8);

  const [preprocess, setPreprocess] = useState<Record<string, boolean>>({
    imputation: true,
    dedupe: true,
    outlier: false,
    scaling: true,
    labelEncoding: false,
    oneHot: true,
    featureSelection: true,
    pca: false,
    balancing: false,
    leakage: true,
  });

  const [validationMethod, setValidationMethod] = useState('cross_validation');
  const [cvFolds, setCvFolds] = useState(5);
  const [testSize, setTestSize] = useState(20);
  const [shuffle, setShuffle] = useState(true);
  const [randomSeed, setRandomSeed] = useState(42);
  const [nClusters, setNClusters] = useState(3);

  const [progress, setProgress] = useState<EngineProgress | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState('dataset');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const runRef = useRef<HTMLDivElement | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    engineService.models().then(setModels).catch(() => {});
    engineService.datasets().then(r => setDatasets(r.datasets || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (models) setSelectedAlgos(getTaskAlgorithms(models, taskType));
  }, [models, taskType]);

  useEffect(() => {
    if (!selectedDataset) { setProfile(null); return; }
    let cancelled = false;
    setProfile(null);
    datasetsService.profile(selectedDataset)
      .then(p => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setProfile(null); });
    return () => { cancelled = true; };
  }, [selectedDataset]);

  // Dataset intelligence + transparent recommendations
  useEffect(() => {
    if (!selectedDataset || taskType === 'clustering') {
      setIntelProfile(null);
      setRecommendation(null);
      setIntelLoading(false);
      return;
    }
    let cancelled = false;
    setIntelLoading(true);
    engineService.analyze(selectedDataset, { target_column: targetColumn, task_type: taskType })
      .then(({ profile: p, recommendation: rec }) => {
        if (cancelled) return;
        setIntelProfile(p);
        setRecommendation(rec);
        setIntelLoading(false);
        if (!targetColumn && p.target) {
          setTargetColumn(p.target);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setIntelProfile(null);
        setRecommendation(null);
        setIntelLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedDataset, targetColumn, taskType]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting);
      if (visible.length > 0) {
        const el = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = (el.target as HTMLElement).dataset.section;
        if (id) setActiveSection(id);
      }
    }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

    Object.values(sectionRefs.current).forEach(node => { if (node) observer.observe(node); });
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => { if (unsubRef.current) unsubRef.current(); }, []);

  const isClusterOrTS = taskType === 'clustering' || taskType === 'time_series';
  const currentDataset = datasets.find(d => d.name === selectedDataset);
  const targetColumns = currentDataset?.columns || [];

  const toggleAlgo = (algo: string) => setSelectedAlgos(p => p.includes(algo) ? p.filter(a => a !== algo) : [...p, algo]);
  const togglePreprocess = (k: string) => setPreprocess(p => ({ ...p, [k]: !p[k] }));

  const applyRecommended = (modelsToApply: string[]) => {
    if (!models) return;
    const avail = new Set(getTaskAlgorithms(models, taskType));
    const valid = modelsToApply.filter(m => avail.has(m));
    if (valid.length > 0) setSelectedAlgos(valid);
  };

  const canRun = !!selectedDataset && (isClusterOrTS || !!targetColumn) && selectedAlgos.length > 0;

  const scrollTo = (id: string) => {
    const node = sectionRefs.current[id];
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const startRun = async () => {
    if (!canRun) return;
    try {
      setIsRunning(true);
      setProgress(null);
      setExpandedModels(new Set());
      requestAnimationFrame(() => {
        runRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      const resp = await engineService.run({
        file_name: selectedDataset, target_column: targetColumn, task_type: taskType,
        models: selectedAlgos, cv_folds: validationMethod === 'train_test_split' ? 1 : cvFolds,
        n_clusters: taskType === 'clustering' ? nClusters : undefined,
        preprocess,
        validation: {
          method: validationMethod,
          cv_folds: cvFolds,
          test_size: testSize,
          shuffle,
          random_seed: randomSeed,
        },
        mode,
        hpo_budget: mode === 'advanced' ? hpoBudget : 0,
      });
      unsubRef.current = engineService.subscribeProgress(resp.job_id, (data) => {
        setProgress(data);
        if (data.status === 'completed' || data.status === 'failed') {
          setIsRunning(false);
          if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        }
      });
    } catch (err: any) {
      setIsRunning(false);
      setProgress({ status: 'failed', error: err.message || 'Failed', message: err.message });
    }
  };

  const recommendedModels = (recommendation?.recommended || []).map(r => r.model);

  return (
    <div className={styles.page}>
      <EngineHero
        isRunning={isRunning}
        canRun={canRun}
        onRun={startRun}
        algorithmCount={selectedAlgos.length}
        mode={mode}
      />

      <EngineStepper steps={STEPS} active={activeSection} onNavigate={scrollTo} />

      <div className={styles.body}>
        <div
          ref={(el) => { sectionRefs.current['dataset'] = el; }}
          data-section="dataset"
          className={styles.section}
        >
          <DatasetStep
            datasets={datasets}
            selectedDataset={selectedDataset}
            targetColumn={targetColumn}
            profile={profile}
            taskType={taskType}
            isCluster={taskType === 'clustering'}
            nClusters={nClusters}
            onDatasetChange={(v) => { setSelectedDataset(v); setTargetColumn(''); setProfile(null); }}
            onTargetChange={setTargetColumn}
            onNClustersChange={setNClusters}
          />
        </div>

        <div
          ref={(el) => { sectionRefs.current['intelligence'] = el; }}
          data-section="intelligence"
          className={styles.section}
        >
          <IntelligencePanel
            profile={intelProfile}
            recommendation={recommendation}
            loading={intelLoading}
            taskType={taskType}
            selected={selectedAlgos}
            onApplyRecommended={applyRecommended}
          />
        </div>

        <div
          ref={(el) => { sectionRefs.current['task'] = el; }}
          data-section="task"
          className={styles.section}
        >
          <TaskStep selected={taskType} onSelect={setTaskType} />
        </div>

        <div
          ref={(el) => { sectionRefs.current['mode'] = el; }}
          data-section="mode"
          className={styles.section}
        >
          <RunModeStep
            mode={mode}
            hpoBudget={hpoBudget}
            onModeChange={setMode}
            onHpoBudgetChange={setHpoBudget}
          />
        </div>

        <div
          ref={(el) => { sectionRefs.current['preprocess'] = el; }}
          data-section="preprocess"
          className={styles.section}
        >
          <PreprocessStep options={preprocess} onToggle={togglePreprocess} />
        </div>

        <div
          ref={(el) => { sectionRefs.current['algorithms'] = el; }}
          data-section="algorithms"
          className={styles.section}
        >
          <AlgorithmStep
            algorithms={getTaskAlgorithms(models, taskType)}
            selected={selectedAlgos}
            onToggle={toggleAlgo}
            recommendedModels={recommendedModels}
          />
        </div>

        <div
          ref={(el) => { sectionRefs.current['validation'] = el; }}
          data-section="validation"
          className={styles.section}
        >
          <ValidationStep
            method={validationMethod}
            onMethodChange={setValidationMethod}
            cvFolds={cvFolds}
            onCvFoldsChange={setCvFolds}
            testSize={testSize}
            onTestSizeChange={setTestSize}
            shuffle={shuffle}
            onShuffleChange={setShuffle}
            randomSeed={randomSeed}
            onRandomSeedChange={setRandomSeed}
          />
        </div>

        <div
          ref={(el) => { sectionRefs.current['run'] = el; }}
          data-section="run"
          className={styles.section}
        >
          <RunSection
            dataset={selectedDataset}
            algorithmCount={selectedAlgos.length}
            taskType={taskType}
            validationLabel={validationMethod === 'train_test_split' ? `${testSize}% Holdout` : `${cvFolds}-Fold CV`}
            canRun={canRun}
            isRunning={isRunning}
            onRun={startRun}
            mode={mode}
            hpoBudget={hpoBudget}
          />
        </div>

        {(isRunning || progress) && (
          <div ref={runRef}>
            <TrainingScreen progress={progress} isRunning={isRunning} />
          </div>
        )}

        <ResultsPanel
          progress={progress}
          taskType={taskType}
          expandedModels={expandedModels}
          onToggleExpand={(name: string) => setExpandedModels(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; })}
        />

        <ReportPanel report={progress?.report || null} />
      </div>
    </div>
  );
}