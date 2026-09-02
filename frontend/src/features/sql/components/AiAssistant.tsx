import { useState, useCallback, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Send, Loader2, Clock, Copy, Check, Lightbulb } from 'lucide-react';
import styles from './AiAssistant.module.css';

interface AiAssistantProps {
  onInsertQuery: (query: string) => void;
  currentQuery?: string;
  columns?: string[];
  dtypes?: Record<string, string>;
}

function detectQueryType(nl: string): string {
  if (nl.includes('average') || nl.includes('avg') || nl.includes('mean')) return 'avg';
  if (nl.includes('count') || nl.includes('how many') || nl.includes('number of')) return 'count';
  if (nl.includes('top') || nl.includes('highest') || nl.includes('maximum') || nl.includes('largest')) return 'top';
  if (nl.includes('bottom') || nl.includes('lowest') || nl.includes('minimum') || nl.includes('smallest')) return 'bottom';
  if (nl.includes('sum') || nl.includes('total') || nl.includes('add up')) return 'sum';
  if (nl.includes('group') || nl.includes('breakdown') || nl.includes('by ')) return 'group';
  if (nl.includes('filter') || nl.includes('where') || nl.includes('find') || nl.includes('show')) return 'filter';
  if (nl.includes('sort') || nl.includes('order')) return 'sort';
  if (nl.includes('distinct') || nl.includes('unique')) return 'distinct';
  if (nl.includes('distribution') || nl.includes('histogram') || nl.includes('spread')) return 'distribution';
  if (nl.includes('null') || nl.includes('missing') || nl.includes('empty')) return 'nulls';
  if (nl.includes('recent') || nl.includes('latest') || nl.includes('last')) return 'recent';
  return 'default';
}

export const AiAssistant = memo(function AiAssistant({ onInsertQuery, currentQuery, columns = [], dtypes = {} }: AiAssistantProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; sql?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const numericCols = useMemo(() =>
    columns.filter((c) => {
      const t = (dtypes[c] || '').toLowerCase();
      return t.includes('int') || t.includes('float') || t.includes('double');
    }),
  [columns, dtypes]);

  const strCols = useMemo(() =>
    columns.filter((c) => {
      const t = (dtypes[c] || '').toLowerCase();
      return t.includes('varchar') || t.includes('str') || t.includes('text');
    }),
  [columns, dtypes]);

  const dateCols = useMemo(() =>
    columns.filter((c) => {
      const t = (dtypes[c] || '').toLowerCase();
      return t.includes('date') || t.includes('timestamp');
    }),
  [columns, dtypes]);

  const schemaSuggestions = useMemo(() => {
    if (columns.length === 0) return [];
    const suggestions: string[] = [];
    if (numericCols.length > 0) {
      const col = numericCols[0];
      suggestions.push(`What is the average ${col}?`);
      if (numericCols.length > 1) {
        suggestions.push(`Show ${numericCols[0]} vs ${numericCols[1]}`);
      }
    }
    if (strCols.length > 0) {
      suggestions.push(`Count records by ${strCols[0]}`);
      suggestions.push(`Find the top 10 ${strCols[0]} values`);
    }
    if (dateCols.length > 0) {
      suggestions.push(`Show data grouped by month of ${dateCols[0]}`);
    }
    if (suggestions.length === 0) {
      suggestions.push(`Show top 10 rows`, `Count all records`, `Show column statistics`);
    }
    return suggestions.slice(0, 4);
  }, [columns, numericCols, strCols, dateCols]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', content: input }]);
    setLoading(true);
    setInput('');

    const nl = input.toLowerCase();
    const firstCol = columns[0] || 'col';
    const numCol = numericCols[0] || firstCol;
    const numCol2 = numericCols[1] || numericCols[0] || firstCol;
    const strCol = strCols[0] || firstCol;
    const dateCol = dateCols[0] || firstCol;

    setTimeout(() => {
      const qType = detectQueryType(nl);
      let sql = '';
      let explanation = '';

      switch (qType) {
        case 'avg':
          if (strCols.length > 0) {
            sql = `SELECT ${strCol},\n  AVG(${numCol}) AS avg_${numCol},\n  COUNT(*) AS n\nFROM data\nGROUP BY ${strCol}\nORDER BY avg_${numCol} DESC;`;
            explanation = `Averages "${numCol}" grouped by "${strCol}". The COUNT shows sample size per group — useful for assessing reliability of the average.`;
          } else {
            sql = `SELECT AVG(${numCol}) AS avg_${numCol},\n  MIN(${numCol}) AS min_${numCol},\n  MAX(${numCol}) AS max_${numCol}\nFROM data;`;
            explanation = `Computes the average, min, and max of "${numCol}" across all rows.`;
          }
          break;
        case 'count':
          if (strCols.length > 0) {
            sql = `SELECT ${strCol},\n  COUNT(*) AS count\nFROM data\nGROUP BY ${strCol}\nORDER BY count DESC;`;
            explanation = `Counts rows per unique value of "${strCol}". Ordered by count descending so the most common values appear first.`;
          } else {
            sql = `SELECT COUNT(*) AS total_rows,\n  COUNT(DISTINCT ${numCol}) AS unique_${numCol}\nFROM data;`;
            explanation = `Returns the total row count and number of distinct values in "${numCol}".`;
          }
          break;
        case 'top':
          sql = `SELECT *\nFROM data\nORDER BY ${numCol} DESC\nLIMIT 10;`;
          explanation = `Sorts by "${numCol}" descending and returns the top 10 rows — the highest values in the dataset.`;
          break;
        case 'bottom':
          sql = `SELECT *\nFROM data\nORDER BY ${numCol} ASC\nLIMIT 10;`;
          explanation = `Sorts by "${numCol}" ascending and returns the bottom 10 rows — the lowest values.`;
          break;
        case 'sum':
          if (strCols.length > 0) {
            sql = `SELECT ${strCol},\n  SUM(${numCol}) AS total_${numCol}\nFROM data\nGROUP BY ${strCol}\nORDER BY total_${numCol} DESC;`;
            explanation = `Sums "${numCol}" per group of "${strCol}". Useful for understanding which categories contribute most to the total.`;
          } else {
            sql = `SELECT SUM(${numCol}) AS total_${numCol}\nFROM data;`;
            explanation = `Computes the total sum of "${numCol}" across all rows.`;
          }
          break;
        case 'group':
          if (strCols.length > 0 && numericCols.length > 0) {
            sql = `SELECT ${strCol},\n  COUNT(*) AS count,\n  AVG(${numCol}) AS avg_${numCol},\n  MIN(${numCol}) AS min_${numCol},\n  MAX(${numCol}) AS max_${numCol}\nFROM data\nGROUP BY ${strCol}\nORDER BY count DESC;`;
            explanation = `Groups by "${strCol}" and shows count, average, min, and max of "${numCol}" per group — a full summary breakdown.`;
          } else {
            sql = `SELECT *\nFROM data\nORDER BY ${numCol}\nLIMIT 100;`;
            explanation = `Showing data sorted by "${numCol}". Add a GROUP BY column for aggregation.`;
          }
          break;
        case 'filter': {
          const searchTerms = nl.split(' ').filter((w) => w.length > 2 && !['show', 'find', 'filter', 'get', 'display'].includes(w)).slice(0, 3);
          if (searchTerms.length > 0 && strCols.length > 0) {
            sql = `SELECT *\nFROM data\nWHERE ${strCol} ILIKE '%${searchTerms.join('%')}%'\nLIMIT 100;`;
            explanation = `Filters rows where "${strCol}" contains "${searchTerms.join(' ')}" (case-insensitive). ILIKE is case-insensitive LIKE.`;
          } else {
            sql = `SELECT *\nFROM data\nWHERE ${numCol} IS NOT NULL\nLIMIT 100;`;
            explanation = `Shows rows where "${numCol}" is not null. Refine with specific conditions.`;
          }
          break;
        }
        case 'sort':
          sql = `SELECT *\nFROM data\nORDER BY ${numCol} DESC\nLIMIT 50;`;
          explanation = `Sorts all rows by "${numCol}" descending. Added LIMIT 50 to avoid returning too many rows.`;
          break;
        case 'distinct':
          if (strCols.length > 0) {
            sql = `SELECT ${strCol},\n  COUNT(*) AS count\nFROM data\nGROUP BY ${strCol}\nORDER BY count DESC;`;
            explanation = `Shows all distinct values of "${strCol}" with their counts — equivalent to SELECT DISTINCT but with frequency information.`;
          } else {
            sql = `SELECT DISTINCT ${numCol}\nFROM data\nORDER BY ${numCol}\nLIMIT 100;`;
            explanation = `Shows all distinct values of "${numCol}".`;
          }
          break;
        case 'distribution':
          sql = `SELECT\n  ${numCol},\n  NTILE(10) OVER (ORDER BY ${numCol}) AS decile\nFROM data\nORDER BY ${numCol};`;
          explanation = `Distributes "${numCol}" into 10 equal bins (deciles) using NTILE(10). Useful for understanding the distribution shape.`;
          break;
        case 'nulls':
          sql = `SELECT\n  ${columns.slice(0, 8).map((c) => `SUM(CASE WHEN ${c} IS NULL THEN 1 ELSE 0 END) AS ${c}_nulls`).join(',\n  ')}\nFROM data;`;
          explanation = `Counts null values in each of the first 8 columns. Helps identify columns with missing data issues.`;
          break;
        case 'recent':
          if (dateCols.length > 0) {
            sql = `SELECT *\nFROM data\nWHERE ${dateCol} >= CURRENT_DATE - INTERVAL '30 days'\nORDER BY ${dateCol} DESC\nLIMIT 100;`;
            explanation = `Shows rows from the last 30 days based on "${dateCol}". Adjust the interval as needed.`;
          } else {
            sql = `SELECT *\nFROM data\nORDER BY ${numCol} DESC\nLIMIT 100;`;
            explanation = `No date column detected. Showing latest rows by "${numCol}" instead.`;
          }
          break;
        default:
          sql = `SELECT *\nFROM data\nLIMIT 100;`;
          explanation = `Showing the first 100 rows. Try being more specific — ask about aggregations, filters, or groupings for better results.`;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: explanation, sql }]);

      const tips: string[] = [];
      if (qType === 'filter' || qType === 'default') tips.push('Be more specific: mention column names, values, or conditions for better SQL.');
      if (numericCols.length > 0) tips.push(`Available numeric columns: ${numericCols.slice(0, 5).join(', ')}`);
      if (strCols.length > 0) tips.push(`Available text columns: ${strCols.slice(0, 5).join(', ')}`);
      if (dateCols.length > 0) tips.push(`Date columns available: ${dateCols.join(', ')} — try asking about time ranges.`);
      if (tips.length > 0) {
        setTimeout(() => {
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: `**Schema hints:**\n${tips.map((t) => `• ${t}`).join('\n')}`,
          }]);
          setLoading(false);
        }, 600);
      } else {
        setLoading(false);
      }
    }, 1000 + Math.random() * 500);
  }, [input, columns, numericCols, strCols, dateCols]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }, []);

  return (
    <div className={styles.assistant}>
      <div className={styles.header}>
        <Sparkles className={styles.headerIcon} />
        <span className={styles.headerText}>AI Assistant</span>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && !loading && (
          <div className={styles.emptyState}>
            <Sparkles className={styles.emptyIcon} />
            <p className={styles.emptyText}>Ask AI to generate SQL from plain English</p>
            <div className={styles.suggestions}>
              {schemaSuggestions.length > 0 ? (
                schemaSuggestions.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className={styles.suggestion}
                  >
                    <Lightbulb className={styles.suggestionIcon} />
                    {prompt}
                  </button>
                ))
              ) : (
                [
                  'Show average by category',
                  'Find top 10 highest values',
                  'Count records by group',
                  'Calculate total by month',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className={styles.suggestion}
                  >
                    <Lightbulb className={styles.suggestionIcon} />
                    {prompt}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant}`}
          >
            <div className={`${styles.bubble} ${msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant}`}>
              {msg.content}
            </div>

            {msg.sql && (
              <div className={styles.sqlBlock}>
                <pre className={styles.sqlPre}>{msg.sql}</pre>
                <div className={styles.sqlActions}>
                  <button
                    onClick={() => copyToClipboard(msg.sql!)}
                    className={`${styles.sqlActionBtn} ${copied === msg.sql ? styles.sqlActionBtnSuccess : ''}`}
                  >
                    {copied === msg.sql ? <Check className={styles.timingIcon} /> : <Copy className={styles.timingIcon} />}
                  </button>
                </div>
                <button
                  onClick={() => onInsertQuery(msg.sql!)}
                  className={styles.insertBtn}
                >
                  Insert
                </button>
              </div>
            )}
          </motion.div>
        ))}

        {loading && (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner} />
            Generating...
          </div>
        )}
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputRow}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={columns.length > 0 ? `Ask about ${columns.slice(0, 3).join(', ')}...` : 'Describe the query you need...'}
            className={styles.input}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={styles.sendBtn}
          >
            {loading ? <Loader2 className={styles.sendIcon} /> : <Send className={styles.sendIcon} />}
          </button>
        </div>
      </div>
    </div>
  );
});
