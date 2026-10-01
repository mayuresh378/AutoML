import { useEffect, useState, useMemo, useRef } from 'react';
import { Upload, FileText, Sparkles, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Play, RefreshCw, BarChart2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { datasetsService } from '../../../services/datasets.service';
import { useAnalyzeDataset } from '../hooks/useEvaluation';
import type { Dataset, Model } from '../../../types/api';
import type { DatasetAnalyzeResponse, TaskType } from '../services/evaluation.service';
import styles from './EvaluationSetupPanel.module.css';

export interface DatasetSelection {
  fileName: string;
  targetColumn: string;
  taskType: TaskType;
  modelName?: string;
}

interface Props {
  datasets: Dataset[];
  models: Model[];
  selection: DatasetSelection;
  onChange: (next: DatasetSelection) => void;
  onRunEvaluation: () => void;
  onRunModelEvaluation?: () => void;
  isRunning: boolean;
  blockers: string[];
  hasResult: boolean;
}

export function EvaluationSetupPanel({
  datasets,
  models,
  selection,
  onChange,
  onRunEvaluation,
  isRunning,
  blockers,
}: Props) {
  const [analysisData, setAnalysisData] = useState<DatasetAnalyzeResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeMutation = useAnalyzeDataset();

  const readyDatasets = useMemo(
    () => datasets.filter((d) => d.status !== 'error'),
    [datasets]
  );

  // Trigger automatic analysis whenever fileName changes
  useEffect(() => {
    if (!selection.fileName) {
      setAnalysisData(null);
      return;
    }

    analyzeMutation.mutate(
      { fileName: selection.fileName, targetColumn: selection.targetColumn || undefined },
      {
        onSuccess: (data) => {
          setAnalysisData(data);
          const target = selection.targetColumn || data.suggested_target;
          const task = selection.taskType || data.detected_task_type;
          onChange({
            ...selection,
            targetColumn: target,
            taskType: task,
          });
        },
        onError: () => {
          setAnalysisData(null);
        },
      }
    );
  }, [selection.fileName]);

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Please upload a valid tabular .csv file.');
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      const uploaded = await datasetsService.upload(file);
      const fileName = uploaded.name || file.name;
      onChange({
        fileName,
        targetColumn: '',
        taskType: 'classification',
      });
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload dataset.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Model Evaluation</h2>
          <p className={styles.subtitle}>
            Upload a dataset and automatically evaluate a machine learning model.
          </p>
        </div>
        {analysisData && (
          <span className={styles.taskBadge} data-task={selection.taskType}>
            {selection.taskType}
          </span>
        )}
      </div>

      {/* Dataset Selection / Upload Zone */}
      <div className={styles.uploadZoneContainer}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />

        <div className={styles.uploadFlexGrid}>
          <div className={styles.uploadArea} onClick={() => fileInputRef.current?.click()}>
            <Upload className={styles.uploadIcon} />
            <div className={styles.uploadTextGroup}>
              <span className={styles.uploadTitle}>
                {isUploading ? 'Uploading CSV Dataset...' : 'Click to Upload CSV Dataset'}
              </span>
              <span className={styles.uploadHint}>Supports tabular CSV datasets up to 100MB</span>
            </div>
            <Button size="sm" variant="secondary" disabled={isUploading}>
              {isUploading ? <RefreshCw className={styles.spin} /> : 'Upload Dataset'}
            </Button>
          </div>

          {readyDatasets.length > 0 && (
            <div className={styles.selectExistingArea}>
              <span className={styles.selectLabel}>Or select an existing uploaded dataset:</span>
              <Select
                value={selection.fileName}
                placeholder="Choose from existing datasets..."
                onChange={(e) =>
                  onChange({
                    fileName: e.target.value,
                    targetColumn: '',
                    taskType: 'classification',
                  })
                }
                options={readyDatasets.map((d) => ({
                  value: d.name,
                  label: `${d.name} (${d.rows || '?'} rows · ${d.columns?.length || '?'} cols)`,
                }))}
              />
            </div>
          )}
        </div>

        {uploadError && <p className={styles.errorBanner}>{uploadError}</p>}
      </div>

      {/* Dataset Summary & Target Auto-Detection Card */}
      {selection.fileName && (
        <div className={styles.analysisCard}>
          <div className={styles.analysisHeader}>
            <div className={styles.datasetInfoGroup}>
              <FileText className={styles.datasetIcon} />
              <div>
                <h4 className={styles.datasetName}>{selection.fileName}</h4>
                <div className={styles.datasetMetaRow}>
                  <span>Rows: <strong>{analysisData?.rows ?? '...'}</strong></span>
                  <span>Columns: <strong>{analysisData?.columns?.length ?? '...'}</strong></span>
                  {analysisData?.missing_count !== undefined && (
                    <span>Missing: <strong>{analysisData.missing_count}</strong></span>
                  )}
                </div>
              </div>
            </div>

            {analyzeMutation.isPending && (
              <div className={styles.analyzingBadge}>
                <RefreshCw className={styles.spin} />
                Analyzing dataset...
              </div>
            )}
          </div>

          {analysisData && (
            <div className={styles.detectionRow}>
              {/* Target Column Selection */}
              <div className={styles.configField}>
                <label className={styles.fieldLabel}>
                  Target Column
                  <span className={styles.autoTag}>
                    <Sparkles className={styles.sparkleIcon} />
                    Auto-Detected ({analysisData.target_confidence} Confidence)
                  </span>
                </label>
                <Select
                  value={selection.targetColumn}
                  onChange={(e) => {
                    const col = e.target.value;
                    // Auto switch task type if dtype changes drastically
                    const isNumeric = analysisData.numeric_columns.includes(col);
                    const task = isNumeric ? 'regression' : 'classification';
                    onChange({
                      ...selection,
                      targetColumn: col,
                      taskType: task,
                    });
                  }}
                  options={analysisData.columns.map((c) => ({
                    value: c,
                    label: c === analysisData.suggested_target ? `${c} (Suggested Target)` : c,
                  }))}
                />
              </div>

              {/* Task Type Selection */}
              <div className={styles.configField}>
                <label className={styles.fieldLabel}>ML Problem Task Type</label>
                <Select
                  value={selection.taskType}
                  onChange={(e) =>
                    onChange({
                      ...selection,
                      taskType: e.target.value as TaskType,
                    })
                  }
                  options={[
                    { value: 'classification', label: 'Classification' },
                    { value: 'regression', label: 'Regression' },
                  ]}
                />
              </div>
            </div>
          )}

          {analysisData?.potential_id_columns?.length ? (
            <div className={styles.idNotice}>
              <AlertTriangle className={styles.noticeIcon} />
              <span>
                AutoML detected identifier columns (<strong>{analysisData.potential_id_columns.join(', ')}</strong>) which will be automatically excluded from features.
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Blockers / Warnings list */}
      {blockers.length > 0 && (
        <ul className={styles.blockers}>
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}

      {/* Primary Action Button */}
      <div className={styles.actions}>
        <Button
          size="lg"
          variant="primary"
          onClick={onRunEvaluation}
          disabled={isRunning || blockers.length > 0 || analyzeMutation.isPending}
        >
          {isRunning ? (
            <>
              <RefreshCw className={styles.spin} />
              Evaluating Model...
            </>
          ) : (
            <>
              <Play fill="currentColor" />
              Evaluate Model
            </>
          )}
        </Button>
        <span className={styles.hint}>
          AutoML will automatically preprocess features, train baseline models, and compute evaluation metrics.
        </span>
      </div>
    </div>
  );
}
