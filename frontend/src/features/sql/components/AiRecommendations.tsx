import { useState, useCallback, memo } from 'react';
import {
  Sparkles, Loader2, AlertTriangle, CheckCircle, Lightbulb,
  Target, Wrench, BarChart3, ArrowRight, ChevronDown, ChevronRight,
  TrendingUp, Calendar, Hash,
} from 'lucide-react';
import styles from './AiRecommendations.module.css';
import { QueryProfile, ColumnProfile } from '../types';

interface AiRecommendationsProps {
  profile: QueryProfile | null;
  onInsertQuery: (query: string) => void;
  query?: string;
}

interface Recommendation {
  type: 'target' | 'preprocessing' | 'feature' | 'warning' | 'tip' | 'outlier' | 'date';
  title: string;
  description: string;
  why?: string;
  query?: string;
}

function generateRecommendations(profile: QueryProfile): Recommendation[] {
  const recs: Recommendation[] = [];
  const { columns, summary } = profile;

  const highNullCols = columns.filter((c) => c.null_pct > 30);
  if (highNullCols.length > 0) {
    const names = highNullCols.map((c) => c.name).join(', ');
    recs.push({
      type: 'warning',
      title: 'High Missing Values',
      description: `${highNullCols.length} column(s) have >30% missing values: ${names}. Consider dropping or imputing these columns.`,
      why: `Columns with >30% null values introduce significant bias into models. Most ML algorithms cannot handle missing values natively and require imputation (mean, median, mode, or model-based) before training. Dropping is often better than imputing when the null rate is very high.`,
    });
  }

  const numericCols = columns.filter((c) => c.dtype.toLowerCase().includes('int') || c.dtype.toLowerCase().includes('float') || c.dtype.toLowerCase().includes('double'));
  const catCols = columns.filter((c) => c.dtype.toLowerCase().includes('varchar') || c.dtype.toLowerCase().includes('string') || c.dtype.toLowerCase().includes('text'));

  if (numericCols.length > 0) {
    const candidates = numericCols.filter((c) => c.unique_count > 2 && c.null_pct < 50);
    if (candidates.length > 0) {
      recs.push({
        type: 'target',
        title: 'Potential Target Columns',
        description: `These numeric columns could be good prediction targets: ${candidates.slice(0, 5).map((c) => `${c.name} (${c.unique_count} unique)`).join(', ')}.`,
        why: `A good target column should be numeric with enough unique values to learn patterns from. Columns with very few unique values may be better suited for classification tasks. Consider the distribution — skewed targets may need log transformation.`,
      });
    }
  }

  const highCardCols = columns.filter((c) => c.unique_pct > 90 && c.null_pct < 50);
  if (highCardCols.length > 0) {
    recs.push({
      type: 'feature',
      title: 'High Cardinality Columns',
      description: `${highCardCols.map((c) => c.name).join(', ')} have very high cardinality. These may need encoding (e.g., target encoding) before model training.`,
      why: `High cardinality (many unique values) means one-hot encoding would create hundreds of columns, causing the curse of dimensionality. Target encoding or frequency encoding are more efficient alternatives that preserve information without exploding feature space.`,
    });
  }

  if (numericCols.length > 2) {
    const names = numericCols.slice(0, 4).map((c) => c.name);
    recs.push({
      type: 'tip',
      title: 'Feature Engineering',
      description: `Consider creating interaction features from: ${names.join(', ')}. Polynomial or ratio features often improve model performance.`,
      why: `Interaction features (products, ratios, differences) capture non-linear relationships between variables that linear models miss. Even tree-based models benefit from explicit interactions as they reduce the depth needed to learn the relationship.`,
      query: `SELECT *,\n  ${names[0]} * ${names[1] || names[0]} AS ${names[0]}_x_${names[1] || names[0]}\nFROM data\nLIMIT 100;`,
    });
  }

  if (summary.total_rows > 100000) {
    recs.push({
      type: 'preprocessing',
      title: 'Large Dataset',
      description: `Your dataset has ${summary.total_rows.toLocaleString()} rows. Consider sampling for faster iteration, then train on the full dataset.`,
      why: `Training on the full dataset every iteration is slow. A stratified sample of 10K-50K rows lets you iterate on features and model selection quickly. Once you've found a promising configuration, train on the full dataset for the final model.`,
      query: `SELECT *\nFROM data\nUSING SAMPLE ${Math.min(50000, Math.floor(summary.total_rows * 0.1)).toLocaleString()} ROWS;`,
    });
  }

  if (summary.duplicate_rows > 0) {
    recs.push({
      type: 'warning',
      title: 'Duplicate Rows Detected',
      description: `Found ${summary.duplicate_rows.toLocaleString()} duplicate rows (${((summary.duplicate_rows / summary.total_rows) * 100).toFixed(1)}%). Remove duplicates before training.`,
      why: `Duplicate rows inflate metrics and cause data leakage if duplicates end up in both train and test sets. They also waste compute resources and bias the model toward repeated patterns.`,
      query: `SELECT DISTINCT *\nFROM data;`,
    });
  }

  const constCols = columns.filter((c) => c.unique_count <= 1);
  if (constCols.length > 0) {
    recs.push({
      type: 'warning',
      title: 'Constant Columns',
      description: `${constCols.map((c) => c.name).join(', ')} have only 1 unique value and provide no predictive power. Drop them.`,
      why: `Columns with zero variance cannot contribute to predictions — they add computational overhead and can confuse some algorithms (e.g., those that normalize features). Dropping them is always safe.`,
    });
  }

  if (catCols.length > 0 && numericCols.length > 0) {
    recs.push({
      type: 'preprocessing',
      title: 'Categorical Encoding',
      description: `${catCols.length} categorical column(s) detected: ${catCols.slice(0, 5).map((c) => c.name).join(', ')}. These will need encoding (one-hot, label, or target) for model training.`,
      why: `ML models require numerical input. One-hot encoding works well for low-cardinality columns (<15 unique values). For high-cardinality columns, target encoding or label encoding is more efficient. Tree-based models can handle label encoding directly.`,
    });
  }

  const dateCols = columns.filter((c) =>
    c.dtype.toLowerCase().includes('date') || c.dtype.toLowerCase().includes('timestamp')
  );
  if (dateCols.length > 0 && numericCols.length > 0) {
    recs.push({
      type: 'date',
      title: 'Date Features Available',
      description: `Date columns (${dateCols.map((c) => c.name).join(', ')}) can be decomposed into year, month, day-of-week, and quarter features for richer models.`,
      why: `Raw dates are not directly useful to models. Extracting temporal components (month, day-of-week, quarter) reveals seasonal patterns. The difference between dates can capture trends like time-to-event or recency.`,
      query: `SELECT *,\n  EXTRACT(YEAR FROM ${dateCols[0].name}) AS ${dateCols[0].name}_year,\n  EXTRACT(MONTH FROM ${dateCols[0].name}) AS ${dateCols[0].name}_month,\n  EXTRACT(DOW FROM ${dateCols[0].name}) AS ${dateCols[0].name}_dow\nFROM data\nLIMIT 100;`,
    });
  }

  if (numericCols.length > 0) {
    const skewedCols = numericCols.filter((c) => c.null_pct < 50);
    if (skewedCols.length > 0) {
      recs.push({
        type: 'outlier',
        title: 'Outlier Detection Recommended',
        description: `Numeric columns (${skewedCols.slice(0, 3).map((c) => c.name).join(', ')}) may contain outliers. Check distributions before training.`,
        why: `Outliers skew mean-based models (linear regression, k-means) and affect tree split points. IQR or Z-score filtering on training data (not test) helps. Log transformation is another approach for right-skewed distributions.`,
        query: `SELECT\n  ${skewedCols.map((c) => `AVG(${c.name}) AS avg_${c.name}, STDDEV(${c.name}) AS std_${c.name}, MIN(${c.name}) AS min_${c.name}, MAX(${c.name}) AS max_${c.name}`).join(',\n  ')}\nFROM data;`,
      });
    }
  }

  if (numericCols.length >= 2) {
    recs.push({
      type: 'tip',
      title: 'Correlation Analysis',
      description: 'Check feature correlations to identify multicollinearity and redundant features before training.',
      why: 'Highly correlated features (|r| > 0.9) are redundant and can cause unstable model coefficients. Removing one of each correlated pair simplifies the model without losing information. It also improves interpretability.',
      query: `SELECT *\nFROM (\n  SELECT\n    ${numericCols.slice(0, 5).map((c) => c.name).join(',\n    ')}\n  FROM data\n) QUALIFY TRUE;`,
    });
  }

  if (recs.length === 0) {
    recs.push({
      type: 'tip',
      title: 'Looking Good',
      description: 'Your data looks well-structured. Consider exploring correlations and feature importance after training a model.',
      why: 'A clean dataset with balanced types and low null rates is ideal for training. Start with a simple baseline model (e.g., Random Forest) to establish a performance benchmark before trying more complex architectures.',
    });
  }

  return recs;
}

const TYPE_CONFIG = {
  target: { icon: Target, color: '#22c55e', label: 'Target Suggestion' },
  preprocessing: { icon: Wrench, color: '#3b82f6', label: 'Preprocessing' },
  feature: { icon: BarChart3, color: '#8b5cf6', label: 'Feature Engineering' },
  warning: { icon: AlertTriangle, color: '#f59e0b', label: 'Warning' },
  tip: { icon: Lightbulb, color: '#06b6d4', label: 'Tip' },
  outlier: { icon: TrendingUp, color: '#ec4899', label: 'Outlier Detection' },
  date: { icon: Calendar, color: '#8b5cf6', label: 'Date Features' },
};

export const AiRecommendations = memo(function AiRecommendations({ profile, onInsertQuery }: AiRecommendationsProps) {
  const recs = profile ? generateRecommendations(profile) : [];
  const [expandedWhy, setExpandedWhy] = useState<Record<number, boolean>>({});

  const toggleWhy = useCallback((idx: number) => {
    setExpandedWhy((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Sparkles className={styles.headerIcon} />
        <span className={styles.headerText}>AI Recommendations</span>
        {recs.length > 0 && <span className={styles.recCount}>{recs.length}</span>}
      </div>

      {!profile ? (
        <div className={styles.emptyState}>
          <Lightbulb className={styles.emptyIcon} />
          <p className={styles.emptyText}>Run Data Profiling first to get AI recommendations</p>
        </div>
      ) : (
        <div className={styles.recList}>
          {recs.map((rec, i) => {
            const config = TYPE_CONFIG[rec.type];
            const Icon = config.icon;
            const isWhyOpen = expandedWhy[i] || false;
            return (
              <div key={i} className={styles.recCard}>
                <div className={styles.recHeader}>
                  <Icon className={styles.recIcon} style={{ color: config.color }} />
                  <span className={styles.recType} style={{ color: config.color }}>{config.label}</span>
                </div>
                <div className={styles.recTitle}>{rec.title}</div>
                <div className={styles.recDesc}>{rec.description}</div>
                {rec.why && (
                  <button onClick={() => toggleWhy(i)} className={styles.whyToggle}>
                    {isWhyOpen ? <ChevronDown className={styles.whyIcon} /> : <ChevronRight className={styles.whyIcon} />}
                    Why?
                  </button>
                )}
                {rec.why && isWhyOpen && (
                  <div className={styles.whyContent}>{rec.why}</div>
                )}
                {rec.query && (
                  <button onClick={() => onInsertQuery(rec.query!)} className={styles.insertBtn}>
                    <ArrowRight className={styles.insertIcon} />
                    Use Query
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
