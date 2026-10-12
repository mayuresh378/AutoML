import React, { useState } from 'react';
import { AlertTriangle, Wrench, ChevronDown, ChevronUp, Terminal, RefreshCw, CheckCircle2 } from 'lucide-react';
import styles from './ErrorDiagnosticsPanel.module.css';

export interface ErrorDetails {
  error_type: string;
  exception_class?: string;
  error_message: string;
  remedy_suggestions?: string[];
  stack_trace?: string;
}

interface ErrorDiagnosticsPanelProps {
  errorTitle?: string;
  errorMessage?: string;
  errorDetails?: ErrorDetails;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ErrorDiagnosticsPanel({
  errorTitle = 'Training Failed',
  errorMessage,
  errorDetails,
  onRetry,
  isRetrying = false,
}: ErrorDiagnosticsPanelProps) {
  const [showStack, setShowStack] = useState(false);

  const displayType = errorDetails?.error_type || 'TrainingError';
  const displayMsg = errorDetails?.error_message || errorMessage || 'An unexpected error occurred during model training.';
  const remedies = errorDetails?.remedy_suggestions || [
    'Check that the dataset format is valid (CSV, TSV, or Parquet).',
    'Verify that the selected target column has variation and is suitable for the chosen task type.',
    'Ensure all selected algorithms are supported and available in the environment.',
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <div className={styles.iconWrapper}>
            <AlertTriangle className={styles.alertIcon} />
          </div>
          <div>
            <div className={styles.headerRow}>
              <h4 className={styles.title}>{errorTitle}</h4>
              <span className={styles.badge}>{displayType}</span>
            </div>
            <p className={styles.message}>{displayMsg}</p>
          </div>
        </div>

        {onRetry && (
          <button
            className={styles.retryBtn}
            onClick={onRetry}
            disabled={isRetrying}
          >
            <RefreshCw className={`${styles.btnIcon} ${isRetrying ? styles.spin : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry Run'}
          </button>
        )}
      </div>

      {remedies && remedies.length > 0 && (
        <div className={styles.remedyBox}>
          <div className={styles.remedyHeader}>
            <Wrench className={styles.wrenchIcon} />
            <span className={styles.remedyTitle}>Actionable Troubleshooting & Fixes</span>
          </div>
          <ul className={styles.remedyList}>
            {remedies.map((remedy, idx) => (
              <li key={idx} className={styles.remedyItem}>
                <CheckCircle2 className={styles.checkIcon} />
                <span>{remedy}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {errorDetails?.stack_trace && (
        <div className={styles.stackSection}>
          <button
            type="button"
            className={styles.stackToggle}
            onClick={() => setShowStack(!showStack)}
          >
            <Terminal className={styles.terminalIcon} />
            <span>Diagnostic Stack Trace</span>
            {showStack ? <ChevronUp className={styles.chevron} /> : <ChevronDown className={styles.chevron} />}
          </button>

          {showStack && (
            <pre className={styles.stackTrace}>
              <code>{errorDetails.stack_trace}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
