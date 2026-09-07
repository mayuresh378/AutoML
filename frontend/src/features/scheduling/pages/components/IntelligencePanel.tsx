import { Sparkles, BrainCircuit, Target, Layers, Database } from 'lucide-react';
import type { EngineDatasetProfile, EngineRecommendation } from '../../../../services/engine.service';
import { SectionCard } from './SectionCard';
import styles from './IntelligencePanel.module.css';

interface Props {
  profile: EngineDatasetProfile | null;
  recommendation: EngineRecommendation | null;
  loading: boolean;
  taskType: string;
  selected: string[];
  onApplyRecommended: (models: string[]) => void;
}

function fmtPct(v: number | undefined | null): string {
  if (v == null) return '—';
  return `${v.toFixed(1)}%`;
}

export function IntelligencePanel({ profile, recommendation, loading, taskType, selected, onApplyRecommended }: Props) {
  if (loading) {
    return (
      <SectionCard number={1} title="Dataset Intelligence" subtitle="Analyzing your dataset...">
        <div className={styles.loading}>
          <span className={styles.spinner} />
          <span>Running target detection, feature type analysis and data quality checks...</span>
        </div>
      </SectionCard>
    );
  }

  if (!profile) return null;

  const ft = profile.feature_types || {};
  const featCount = [
    { k: 'numeric', label: 'Numeric', n: (ft.numeric || []).length },
    { k: 'categorical', label: 'Categorical', n: (ft.categorical || []).length },
    { k: 'datetime', label: 'Datetime', n: (ft.datetime || []).length },
    { k: 'boolean', label: 'Boolean', n: (ft.boolean || []).length },
    { k: 'text', label: 'Text', n: (ft.text || []).length },
  ].filter(f => f.n > 0);

  const imb = profile.class_imbalance;
  const missingPct = profile.missing?.missing_pct;

  const stats = [
    { label: 'Rows', value: profile.rows.toLocaleString() },
    { label: 'Features', value: String(profile.n_features) },
    { label: 'Missing', value: fmtPct(missingPct) },
    { label: 'Duplicates', value: fmtPct(profile.duplicates?.pct) },
  ];

  const recommendedModels = (recommendation?.recommended || []).map(r => r.model);
  const applied = recommendedModels.filter(m => selected.includes(m)).length;

  return (
    <>
      <SectionCard number={1} title="Dataset Intelligence" subtitle="What AutoML inferred from your dataset — every decision is transparent">
        <div className={styles.detected}>
          <div className={styles.detectedItem}>
            <span className={styles.detectedIcon}><Target size={15} /></span>
            <div>
              <span className={styles.detectedLabel}>Target Column</span>
              <span className={styles.detectedVal}>
                {profile.target || 'not detected'}
                {profile.target && (profile.target_detection?.suggested === profile.target) && (
                  <span className={styles.autoBadge}>AUTO</span>
                )}
              </span>
            </div>
          </div>
          <div className={styles.detectedItem}>
            <span className={styles.detectedIcon}><BrainCircuit size={15} /></span>
            <div>
              <span className={styles.detectedLabel}>Inferred Task</span>
              <span className={styles.detectedVal}>
                {profile.target_detection?.inferred_task || taskType}
                {profile.target_detection?.inferred_task && (
                  <span className={styles.autoBadge}>AUTO</span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.statsRow}>
          {stats.map(s => (
            <div key={s.label} className={styles.statBox}>
              <span className={styles.statVal}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {featCount.length > 0 && (
          <div className={styles.features}>
            <span className={styles.featuresTitle}><Layers size={13} /> Feature Mix</span>
            <div className={styles.featureChips}>
              {featCount.map(f => (
                <span key={f.k} className={styles.chip}><b>{f.n}</b> {f.label}</span>
              ))}
            </div>
          </div>
        )}

        {imb?.detected && (
          <div className={`${styles.warn} ${imb.severity === 'high' ? styles.warnHigh : imb.severity === 'medium' ? styles.warnMed : ''}`}>
            <Database size={13} />
            <span>
              Class imbalance detected{imb.imbalance_ratio != null ? ` (${imb.imbalance_ratio}x)` : ''} across
              {imb.classes != null ? ` ${imb.classes}` : ''} classes — severity: <b>{imb.severity}</b>.
              Consider class weights / resampling for the champion.
            </span>
          </div>
        )}
      </SectionCard>

      {recommendation && (
        <SectionCard
          number={2}
          title="Model Recommendations"
          subtitle="Ranked by typical baseline quality for this task combined with this dataset's size and features"
          action={
            <button
              type="button"
              className={styles.applyBtn}
              onClick={() => onApplyRecommended(recommendedModels)}
              disabled={recommendedModels.length === 0}
            >
              <Sparkles size={13} />
              {applied === recommendedModels.length && recommendedModels.length > 0
                ? 'Applied'
                : `Apply recommended (${recommendedModels.length})`}
            </button>
          }
        >
          <div className={styles.recList}>
            {recommendation.recommended.map((r, i) => (
              <div key={r.model} className={styles.recRow}>
                <span className={styles.recRank}>{i + 1}</span>
                <div className={styles.recBody}>
                  <span className={styles.recName}>{r.model}</span>
                  <p className={styles.recReasons}>
                    {r.reasons.length > 0 ? r.reasons.join(' · ') : 'Strong default baseline for this task'}
                  </p>
                </div>
                <span className={styles.recScore}>{r.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <p className={styles.rationale}>{recommendation.rationale}</p>
        </SectionCard>
      )}
    </>
  );
}