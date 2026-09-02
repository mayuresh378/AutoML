import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, Loader2, Copy, Check, ChevronDown,
  RotateCcw, History, Trash2, Brain, BarChart3, Zap,
  TrendingUp, Bug, Terminal, Paperclip,
} from 'lucide-react';
import { aiService } from '../../../services/ai.service';
import styles from './AIAssistantPage.module.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const WELCOME_ACTIONS = [
  { icon: Brain, label: 'Choose Algorithm', desc: 'Recommend the best model' },
  { icon: BarChart3, label: 'Explain Dataset', desc: 'Analyze your data' },
  { icon: Zap, label: 'Improve Accuracy', desc: 'Optimize hyperparameters' },
  { icon: TrendingUp, label: 'Debug Training', desc: 'Fix convergence issues' },
  { icon: Bug, label: 'SQL Generation', desc: 'Write SQL queries' },
  { icon: Terminal, label: 'Preprocessing', desc: 'Clean your dataset' },
];

function renderMarkdown(text: string): string {
  let html = text;

  // Code blocks with syntax highlighting wrapper
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const langAttr = lang ? ` data-language="${lang}"` : '';
    return `<pre${langAttr} class="${styles.markdown}"><code>${code
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }</code></pre>`;
  });

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Blockquote
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Tables
  const tableRegex = /^\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)*)/gm;
  html = html.replace(tableRegex, (_, header, body) => {
    const headers = header.split('|').filter((c: string) => c.trim());
    const rows = body.trim().split('\n').map((row: string) =>
      row.split('|').filter((c: string) => c.trim())
    );
    const hHtml = headers.map((h: string) => `<th>${h.trim()}</th>`).join('');
    const bHtml = rows.map((r: string[]) =>
      `<tr>${r.map((c: string) => `<td>${c.trim()}</td>`).join('')}</tr>`
    ).join('');
    return `<table><thead><tr>${hHtml}</tr></thead><tbody>${bHtml}</tbody></table>`;
  });

  // Single pipe row tables (simplified)
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    if (match.includes('---')) return '';
    const cells = match.split('|').filter((c: string) => c.trim());
    const cellHtml = cells.map((c: string) => `<td>${c.trim()}</td>`).join('');
    return `<tr>${cellHtml}</tr>`;
  });

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

  // Line breaks
  html = html.replace(/\n\n/g, '<br/><br/>');
  html = html.replace(/\n/g, '<br/>');

  return html;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button className={styles.copyBtn} onClick={handleCopy} title="Copy to clipboard">
      {copied ? <Check className={styles.copyBtnSvg} /> : <Copy className={styles.copyBtnSvg} />}
    </button>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const isTyping = msg.id === 'typing';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`${styles.messageRow} ${isUser ? styles.messageRowUser : ''}`}
    >
      {!isUser && (
        <div className={styles.avatarBot}>
          <Sparkles className={styles.avatarBotSvg} />
        </div>
      )}
      {isTyping ? (
        <div className={`${styles.bubble} ${styles.bubbleBot} ${styles.typingContainer}`}>
          <div className={styles.aiName}>
            <Sparkles className={styles.aiNameIcon} />
            <span className={styles.aiNameText}>AutoML AI</span>
          </div>
          <div className={styles.typingRow}>
            <div className={styles.typingDots}>
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
              <span className={styles.typingDot} />
            </div>
            <span className={styles.typingLabel}>Thinking...</span>
          </div>
        </div>
      ) : (
        <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleBot}`}>
          {!isUser && (
            <div className={styles.aiName}>
              <Sparkles className={styles.aiNameIcon} />
              <span className={styles.aiNameText}>AutoML AI</span>
            </div>
          )}
          {isUser ? (
            <span>{msg.content}</span>
          ) : (
            <div className={styles.bubbleBotContent}>
              <div
                className={styles.markdown}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />
              <CopyButton text={msg.content} />
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function WelcomeCard({ onAction }: { onAction: (text: string) => void }) {
  return (
    <motion.div
      className={styles.welcome}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className={styles.welcomeIcon}>
        <Sparkles className={styles.welcomeIconSvg} />
      </div>
      <h2 className={styles.welcomeTitle}>How can I help you today?</h2>
      <p className={styles.welcomeSub}>
        Ask me anything about your machine learning workflow
      </p>

      <div className={styles.welcomeGrid}>
        {WELCOME_ACTIONS.map((action) => (
          <button
            key={action.label}
            className={styles.welcomeCard}
            onClick={() => onAction(action.label)}
          >
            <action.icon className={styles.welcomeCardIcon} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 1 }}>{action.label}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{action.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  const chatMutation = useMutation({
    mutationFn: (question: string) => aiService.chat(question),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== 'typing'),
        { id: `ai_${Date.now()}`, role: 'assistant', content: data.answer, timestamp: Date.now() },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== 'typing'),
        { id: `ai_err_${Date.now()}`, role: 'assistant', content: 'Sorry, something went wrong. Please try again.', timestamp: Date.now() },
      ]);
    },
  });

  const isPending = chatMutation.isPending;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollBtn(!atBottom);
  }, []);

  const handleSend = (text?: string) => {
    const q = (text || input).trim();
    if (!q || isPending) return;
    setWelcomeDismissed(true);
    setMessages((prev) => [
      ...prev,
      { id: `user_${Date.now()}`, role: 'user', content: q, timestamp: Date.now() },
      { id: 'typing', role: 'assistant', content: '', timestamp: Date.now() },
    ]);
    setInput('');
    chatMutation.mutate(q);
  };

  const newChat = () => {
    setMessages([]);
    setWelcomeDismissed(false);
    setInput('');
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ─── Header ─── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <Sparkles className={styles.headerIconSvg} />
            </div>
            <div className={styles.headerText}>
              <h1 className={styles.title}>AI Assistant</h1>
              <p className={styles.subtitle}>Powered by AutoML Intelligence</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.headerBtn} onClick={newChat}>
              <RotateCcw className={styles.headerBtnIcon} />
              New Chat
            </button>
            <button className={styles.headerBtn}>
              <History className={styles.headerBtnIcon} />
              History
            </button>
            <button className={styles.headerBtn}>
              <Trash2 className={styles.headerBtnIcon} />
              Clear
            </button>
          </div>
        </div>

        {/* ─── Chat Container ─── */}
        <div
          className={styles.chatContainer}
          ref={chatContainerRef}
          onScroll={handleScroll}
        >
          <div className={styles.chatInner}>
            {messages.length === 0 && !welcomeDismissed ? (
              <WelcomeCard onAction={(label) => {
                const prompts: Record<string, string> = {
                  'Choose Algorithm': 'Which machine learning algorithm should I choose for my dataset?',
                  'Explain Dataset': 'Can you explain what my dataset contains?',
                  'Improve Accuracy': 'How can I improve my model accuracy?',
                  'Debug Training': 'My model is not converging, what should I do?',
                  'SQL Generation': 'Generate SQL queries for my dataset',
                  'Preprocessing': 'Suggest preprocessing steps for my data',
                };
                handleSend(prompts[label] || label);
              }} />
            ) : (
              <AnimatePresence mode="popLayout">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}
              </AnimatePresence>
            )}
            <div ref={chatEndRef} />
          </div>

          {showScrollBtn && (
            <button className={styles.scrollBtn} onClick={() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })}>
              <ChevronDown size={15} />
            </button>
          )}
        </div>

        {/* ─── Input ─── */}
        <div className={styles.inputArea}>
          <form className={styles.inputForm} onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <input
              className={styles.inputField}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your dataset..."
              disabled={isPending}
            />
            <div className={styles.inputActions}>
              <button type="button" className={styles.attachBtn} title="Attach file">
                <Paperclip size={18} />
              </button>
              <button
                type="submit"
                className={styles.sendBtn}
                disabled={!input.trim() || isPending}
              >
                {isPending ? (
                  <Loader2 size={18} className={styles.spin} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
