import { memo, useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount, OnChange, loader } from '@monaco-editor/react';

loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs',
  },
});

interface SqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onMount?: (editor: any, monaco: any) => void;
  fontSize?: number;
  minimap?: boolean;
  className?: string;
  isDark?: boolean;
  columns?: string[];
  tableNames?: string[];
}

export const SqlEditor = memo(function SqlEditor({
  value, onChange, onMount, fontSize = 14, minimap = true, className, isDark = true, columns = [], tableNames = [],
}: SqlEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    const registerCompletions = (cols: string[], tables: string[]) => {
      monaco.languages.registerCompletionItemProvider('sql', {
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          const keywords = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'UNION', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'DISTINCT', 'AS', 'ON', 'AND', 'OR', 'IN', 'NOT', 'NULL', 'IS', 'BETWEEN', 'LIKE', 'COUNT', 'AVG', 'SUM', 'MIN', 'MAX', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'EXISTS', 'INNER', 'OUTER', 'CROSS', 'INDEX', 'TABLE', 'VIEW', 'WITH', 'RECURSIVE', 'CAST', 'COALESCE', 'NULLIF', 'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LEAD', 'LAG', 'FIRST_VALUE', 'LAST_VALUE', 'OVER', 'PARTITION BY', 'WINDOW', 'BETWEEN', 'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST', 'LIMIT', 'OFFSET', 'FETCH', 'NEXT', 'ROWS', 'ONLY', 'EXPLAIN', 'ANALYZE', 'TRUE', 'FALSE'];
          const suggestions = [
            ...keywords.map((kw) => ({
              label: kw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: kw,
              range,
              detail: 'SQL Keyword',
            })),
            ...tables.map((t) => ({
              label: t,
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: t,
              range,
              detail: 'Table',
            })),
            ...cols.map((c) => ({
              label: c,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: c,
              range,
              detail: 'Column',
            })),
          ];
          return { suggestions };
        },
      });
    };

    registerCompletions(columns, tableNames);

    editor.addAction({
      id: 'run-query',
      label: 'Run Query',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        editor.getAction('editor.action.executeCommand')?.run();
      },
    });

    if (onMount) onMount(editor, monaco);
  }, [onMount, columns, tableNames]);

  const handleChange: OnChange = useCallback((val) => {
    if (val !== undefined) onChange(val);
  }, [onChange]);

  return (
    <div className={className} style={{ height: '100%' }}>
      <Editor
        height="100%"
        defaultLanguage="sql"
        theme={isDark ? 'vs-dark' : 'vs'}
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        loading={
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', background: isDark ? '#1e1e1e' : '#ffffff', color: '#888', fontSize: 13,
          }}>
            Loading editor...
          </div>
        }
        options={{
          fontSize,
          fontFamily: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
          lineNumbers: 'on',
          minimap: { enabled: minimap },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          insertSpaces: true,
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          matchBrackets: 'always',
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          formatOnPaste: true,
          folding: true,
          foldingStrategy: 'indentation',
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          parameterHints: { enabled: true },
          snippetSuggestions: 'inline',
          codeLens: true,
          contextmenu: true,
          mouseWheelZoom: true,
          multiCursorModifier: 'alt',
          renderWhitespace: 'selection',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          find: { addExtraSpaceOnTop: false, autoFindInSelection: 'never' },
          padding: { top: 12, bottom: 12 },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          renderLineHighlight: 'line',
          selectionHighlight: true,
          occurrencesHighlight: 'singleFile',
          roundedSelection: true,
        }}
      />
    </div>
  );
});
