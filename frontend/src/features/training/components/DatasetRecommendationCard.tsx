import React from 'react';
import { Sparkles, AlertCircle, CheckCircle, ArrowRight, Gauge, Cpu, BarChart2 } from 'lucide-react';
import type { DatasetRecommendation, TaskType } from '../../../services/training.service';
import styles from './DatasetRecommendationCard.module.css';

interface DatasetRecommendationCardProps {
  recommendation: DatasetRecommendation;
  onApply: (config: {
    targetColumn: string;
    taskType: TaskType;
    algorithms: string[];
  }) => void;
  isLoading?: boolean;
}

export function DatasetRecommendationCard({
  recommendation,
  onApply,
  isLoading = false,
}: DatasetRecommendationCardProps) {
  const {
    target_column,
    target_reason,
    problem_type,
    problem_reason,
    quality_issues,
    recommended_algorithms,
    recommended_metrics,
    complexity,
    estimated_duration,
    complexity_warning,
    total_rows,
    total_columns,
  } = recommendation;

  const handleApplyClick = () => {
    const algos = recommended_algorithms.map((a) => a.name);
    onApply({
      targetColumn: target_column,
      taskType: problem_type,
      algorithms: algos,
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <div className={styles.badgeSparkle}>
            <Sparkles className={styles.sparkleIcon} />
            <span>AI Dataset Recommendations</span>
          </div>
          <span className={styles.metaInfo}>
            {total_rows.toLocaleString()} rows • {total_columns} columns
          </span>
        </div>

        <button
          className={styles.applyBtn}
          onClick={handleApplyClick}
          disabled={isLoading}
        >
          <span>Apply Recommendations</span>
          <ArrowRight className={styles.applyIcon} />
        </button>
      </div>

      <div className={styles.grid}>
        {/* Target & Task Recommendation */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Cpu className={styles.sectionIcon} />
              <span>Target & Problem Type</span>
            </div>
            <span className={`${styles.typeBadge} ${problem_type === 'classification' ? styles.badgeClf : styles.badgeReg}`}>
              {problem_type === 'classification' ? 'Classification' : 'Regression'}
            </span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.propRow}>
              <span className={styles.propLabel}>Suggested Target:</span>
              <strong className={styles.propVal}>{target_column}</strong>
            </div>
            <p className={styles.reasonText}>{target_reason}</p>
            <p className={styles.reasonText}>{problem_reason}</p>
          </div>
        </div>

        {/* Algorithms & Metrics */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <BarChart2 className={styles.sectionIcon} />
              <span>Recommended Models & Metrics</span>
            </div>
            <span className={styles.complexityBadge}>
              <Gauge className={styles.gaugeIcon} /> {complexity} ({estimated_duration})
            </span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.algoTags}>
              {recommended_algorithms.map((algo) => (
                <span key={algo.name} className={`${styles.algoTag} ${algo.priority === 'high' ? styles.tagHigh : ''}`}>
                  {algo.label}
                </span>
              ))}
            </div>
            <div className={styles.metricRow}>
              <span className={styles.propLabel}>Optimal Metrics:</span>
              <span className={styles.metricVal}>
                {recommended_metrics.map((m) => m.label).join(', ')}
              </span>
            </div>
            {complexity_warning && (
              <p className={styles.warningText}>⚠️ {complexity_warning}</p>
            )}
          </div>
        </div>
      </div>

      {/* Quality Issues & Automated Checks */}
      {quality_issues && quality_issues.length > 0 && (
        <div className={styles.qualitySection}>
          <div className={styles.qualityTitle}>Dataset Quality & Preprocessing Checks:</div>
          <div className={styles.qualityList}>
            {quality_issues.map((q, idx) => (
              <div key={idx} className={`${styles.qualityItem} ${styles[q.severity]}`}>
                {q.severity === 'high' ? (
                  <AlertCircle className={styles.qualityIcon} />
                ) : (
                  <CheckCircle className={styles.qualityIcon} />
                )}
                <div>
                  <strong>{q.title}: </strong>
                  <span>{q.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
