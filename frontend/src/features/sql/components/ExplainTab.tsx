import { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Lightbulb, AlertTriangle, CheckCircle, ChevronDown, ChevronRight,
  Scan, GitMerge, Filter, Zap, TrendingDown, Clock,
} from 'lucide-react';
import styles from './ExplainTab.module.css';
import { QueryPlanView } from './QueryPlanView';

interface ExplainTabProps {
  query: string;
  dataset?: string;
}

interface HintsResult {
  scanCount: number;
  joinCount: number;
  filterCount: number;
  hasSeqScan: boolean;
  hasIndexScan: boolean;
  hasSort: boolean;
  hasLimit: boolean;
  hasAggregation: boolean;
  hasNestedLoop: boolean;
  totalCost: number;
  maxCostNode: string;
  hints: { type: 'info' | 'warning' | 'success'; text: string }[];
}

function analyzePlan(planLines: string[]): HintsResult {
  const raw = planLines.join('\n').toLowerCase();
  const lines = planLines.map((l) => l.trim());

  let scanCount = 0;
  let joinCount = 0;
  let filterCount = 0;
  let hasSeqScan = false;
  let hasIndexScan = false;
  let hasSort = false;
  let hasLimit = false;
  let hasAggregation = false;
  let hasNestedLoop = false;
  let totalCost = 0;
  let maxCostNode = '';

  for (const line of lines) {
    const ll = line.toLowerCase();
    const costMatch = line.match(/cost=(\d+\.?\d*)/);
    const cost = costMatch ? parseFloat(costMatch[1]) : 0;
    if (cost > totalCost) {
      totalCost = cost;
      maxCostNode = line.replace(/^\s+/, '').substring(0, 60);
    }

    if (ll.includes('seqscan') || ll.includes('seq scan')) { scanCount++; hasSeqScan = true; }
    if (ll.includes('indexscan') || ll.includes('index scan')) { scanCount++; hasIndexScan = true; }
    if (ll.includes('hashjoin') || ll.includes('mergejoin') || ll.includes('hash join') || ll.includes('merge join')) joinCount++;
    if (ll.includes('filter') || ll.includes('where')) filterCount++;
    if (ll.includes('sort')) hasSort = true;
    if (ll.includes('limit')) hasLimit = true;
    if (ll.includes('aggregate') || ll.includes('group')) hasAggregation = true;
    if (ll.includes('nested loop')) hasNestedLoop = true;
  }

  const hints: { type: 'info' | 'warning' | 'success'; text: string }[] = [];

  if (hasSeqScan) {
    hints.push({ type: 'warning', text: 'Full table scan detected — consider adding a WHERE clause or creating an index to reduce scanned rows.' });
  }
  if (hasIndexScan) {
    hints.push({ type: 'success', text: 'Index scan used — DuckDB is using an index for efficient lookups.' });
  }
  if (joinCount > 0) {
    hints.push({ type: 'info', text: `${joinCount} join operation(s) detected. Ensure join keys are indexed for best performance.` });
  }
  if (hasNestedLoop) {
    hints.push({ type: 'warning', text: 'Nested loop join detected — this can be slow on large datasets. Consider filtering tables before joining.' });
  }
  if (hasSort && !hasLimit) {
    hints.push({ type: 'info', text: 'Query sorts results without LIMIT — the entire result set is sorted. Add LIMIT if only top results are needed.' });
  }
  if (hasAggregation) {
    hints.push({ type: 'info', text: 'Aggregation query — ensure GROUP BY columns have reasonable cardinality for efficient grouping.' });
  }
  if (filterCount > 0 && hasSeqScan) {
    hints.push({ type: 'info', text: 'Filters applied after scan — DuckDB will scan all rows first, then filter. Consider materialized views for repeated queries.' });
  }
  if (!hasSeqScan && !hasIndexScan && lines.length <= 2) {
    hints.push({ type: 'success', text: 'Simple plan — query should execute efficiently.' });
  }
  if (hasLimit) {
    hints.push({ type: 'success', text: 'LIMIT clause present — DuckDB can short-circuit processing once enough rows are found.' });
  }
  if (scanCount > 2) {
    hints.push({ type: 'info', text: `Multiple table scans (${scanCount}) — each adds I/O overhead. Consider filtering or sampling before joining.` });
  }
  if (totalCost > 1000) {
    hints.push({ type: 'warning', text: `High estimated cost (${totalCost.toFixed(2)}) — this query may be slow on large datasets.` });
  }

  return { scanCount, joinCount, filterCount, hasSeqScan, hasIndexScan, hasSort, hasLimit, hasAggregation, hasNestedLoop, totalCost, maxCostNode, hints };
}

export const ExplainTab = memo(function ExplainTab({ query, dataset }: ExplainTabProps) {
  const [expanded, setExpanded] = useState(true);
  const [hintExpanded, setHintExpanded] = useState(true);

  const planHintState = useState<HintsResult | null>(null);
  const planHints = planHintState[0];

  return (
    <div className={styles.container}>
      <div className={styles.summarySection}>
        <div className={styles.sectionHeader} onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown className={styles.sectionIcon} /> : <ChevronRight className={styles.sectionIcon} />}
          <Activity className={styles.headerIcon} />
          <span className={styles.headerText}>Explainable Analytics</span>
        </div>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={styles.summaryContent}
            >
              <p className={styles.summaryDesc}>
                Click "Explain" in the plan below to analyze query execution. Optimization hints will appear here based on the execution plan.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.planWrapper}>
        <QueryPlanViewWithHints query={query} dataset={dataset} onHintsReady={planHintState[1]} />
      </div>

      {planHints && planHints.hints.length > 0 && (
        <div className={styles.hintsSection}>
          <div className={styles.sectionHeader} onClick={() => setHintExpanded(!hintExpanded)}>
            {hintExpanded ? <ChevronDown className={styles.sectionIcon} /> : <ChevronRight className={styles.sectionIcon} />}
            <Lightbulb className={styles.hintsIcon} />
            <span className={styles.headerText}>Optimization Hints</span>
            <span className={styles.hintsCount}>{planHints.hints.length}</span>
          </div>
          <AnimatePresence>
            {hintExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={styles.hintsList}
              >
                {planHints.hints.map((hint, i) => {
                  const Icon = hint.type === 'warning' ? AlertTriangle : hint.type === 'success' ? CheckCircle : Lightbulb;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`${styles.hintCard} ${styles[`hint_${hint.type}`]}`}
                    >
                      <Icon className={styles.hintIcon} />
                      <span className={styles.hintText}>{hint.text}</span>
                    </motion.div>
                  );
                })}

                {planHints.maxCostNode && (
                  <div className={styles.bottleneckCard}>
                    <TrendingDown className={styles.bottleneckIcon} />
                    <div>
                      <div className={styles.bottleneckLabel}>Most Expensive Operation</div>
                      <code className={styles.bottleneckNode}>{planHints.maxCostNode}</code>
                    </div>
                  </div>
                )}

                <div className={styles.statsRow}>
                  {planHints.scanCount > 0 && (
                    <div className={styles.statChip}>
                      <Scan className={styles.statIcon} />
                      {planHints.scanCount} scan{planHints.scanCount !== 1 ? 's' : ''}
                    </div>
                  )}
                  {planHints.joinCount > 0 && (
                    <div className={styles.statChip}>
                      <GitMerge className={styles.statIcon} />
                      {planHints.joinCount} join{planHints.joinCount !== 1 ? 's' : ''}
                    </div>
                  )}
                  {planHints.filterCount > 0 && (
                    <div className={styles.statChip}>
                      <Filter className={styles.statIcon} />
                      {planHints.filterCount} filter{planHints.filterCount !== 1 ? 's' : ''}
                    </div>
                  )}
                  {planHints.hasSort && (
                    <div className={styles.statChip}>
                      <Zap className={styles.statIcon} />
                      sort
                    </div>
                  )}
                  {planHints.hasLimit && (
                    <div className={styles.statChip}>
                      <Clock className={styles.statIcon} />
                      limit
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
});

function QueryPlanViewWithHints({ query, dataset, onHintsReady }: ExplainTabProps & { onHintsReady: (h: HintsResult) => void }) {
  const handlePlanReady = useMemo(() => {
    let prevPlan: string[] = [];
    return (planLines: string[]) => {
      if (JSON.stringify(planLines) !== JSON.stringify(prevPlan)) {
        prevPlan = planLines;
        onHintsReady(analyzePlan(planLines));
      }
    };
  }, [onHintsReady]);

  return <QueryPlanView query={query} dataset={dataset} onPlanReady={handlePlanReady} />;
}
