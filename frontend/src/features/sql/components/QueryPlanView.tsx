import { useState, useCallback, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { Activity, Loader2, AlertTriangle, Copy, Check, Terminal, DollarSign } from 'lucide-react';
import styles from './QueryPlanView.module.css';
import { sqlService } from '../services/sqlEditor.service';
import { QueryPlan } from '../types';

interface QueryPlanViewProps {
  query: string;
  dataset?: string;
  onPlanReady?: (planLines: string[]) => void;
}

interface ParsedPlanNode {
  depth: number;
  text: string;
  cost?: number;
  rows?: number;
}

function parsePlan(lines: string[]): ParsedPlanNode[] {
  return lines.map((line) => {
    const depth = (line.match(/^\s*/)?.[0]?.length || 0) / 2;
    const costMatch = line.match(/cost=(\d+\.?\d*)/);
    const rowsMatch = line.match(/rows=(\d+)/);
    return {
      depth,
      text: line.trim(),
      cost: costMatch ? parseFloat(costMatch[1]) : undefined,
      rows: rowsMatch ? parseInt(rowsMatch[1], 10) : undefined,
    };
  });
}

export const QueryPlanView = memo(function QueryPlanView({ query, dataset, onPlanReady }: QueryPlanViewProps) {
  const [plan, setPlan] = useState<QueryPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => plan ? parsePlan(plan.plan) : [], [plan]);
  const maxCost = useMemo(() => Math.max(...parsed.map((n) => n.cost || 0), 1), [parsed]);
  const totalCost = useMemo(() => {
    const roots = parsed.filter((n) => n.cost !== undefined);
    return roots.length > 0 ? Math.max(...roots.map((n) => n.cost || 0)) : 0;
  }, [parsed]);
  const estimatedRows = useMemo(() => {
    const rows = parsed.filter((n) => n.rows !== undefined).map((n) => n.rows!);
    return rows.length > 0 ? rows[rows.length - 1] : null;
  }, [parsed]);

  const handleExplain = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await sqlService.explainQuery(query, dataset);
      setPlan(data);
      onPlanReady?.(data.plan);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [query, dataset]);

  const handleCopy = useCallback(async () => {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(plan.plan.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [plan]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Activity className={styles.headerIcon} />
        <span className={styles.headerText}>Execution Plan</span>
        <button onClick={handleExplain} disabled={loading || !query.trim()} className={styles.explainBtn}>
          {loading ? <Loader2 className={styles.btnSpinner} /> : <Activity className={styles.btnIcon} />}
          {loading ? 'Analyzing...' : 'Explain'}
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          <AlertTriangle className={styles.errorIcon} />
          {error}
        </div>
      )}

      {plan && parsed.length > 0 && (
        <div className={styles.planContainer}>
          <div className={styles.planHeader}>
            <Terminal className={styles.planIcon} />
            <span>Query Execution Plan</span>
            <div className={styles.planHeaderRight}>
              {totalCost > 0 && (
                <span className={styles.costBadge}>
                  <DollarSign className={styles.costIcon} />
                  Cost: {totalCost.toFixed(2)}
                </span>
              )}
              {estimatedRows !== null && (
                <span className={styles.rowsBadge}>
                  Est. Rows: {estimatedRows.toLocaleString()}
                </span>
              )}
              <button onClick={handleCopy} className={styles.copyBtn}>
                {copied ? <Check className={styles.copyIcon} /> : <Copy className={styles.copyIcon} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div className={styles.planBody}>
            {parsed.map((node, i) => (
              <div key={i} className={styles.planLine}>
                <span className={styles.lineNum}>{i + 1}</span>
                <span className={styles.lineContent} style={{ paddingLeft: node.depth * 16 }}>
                  {node.text}
                </span>
                {node.cost !== undefined && (
                  <span
                    className={styles.costBar}
                    style={{
                      width: `${Math.max(5, (node.cost / maxCost) * 100)}%`,
                      opacity: 0.3 + (node.cost / maxCost) * 0.7,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!plan && !loading && !error && (
        <div className={styles.emptyState}>
          <Activity className={styles.emptyIcon} />
          <p className={styles.emptyText}>Click "Explain" to view the query execution plan</p>
          <p className={styles.emptySubtext}>See how DuckDB processes your query and identify optimization opportunities</p>
        </div>
      )}
    </div>
  );
});
