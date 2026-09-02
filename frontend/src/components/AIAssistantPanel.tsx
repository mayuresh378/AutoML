import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowUp, Wand2, Loader2 } from 'lucide-react';
import { BASE } from '../lib/api';
import { staggerContainer, staggerItem } from '../lib/animations';

interface Message {
  role: 'assistant' | 'user';
  text: string;
}

const WELCOME: Message = {
  role: 'assistant',
  text: "👋 Hi! I'm your AutoML assistant. Ask me about your datasets, models, experiments, or what to do next."
};

export function AIAssistantPanel() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${BASE}/ai/suggestions`)
      .then(r => r.json())
      .then(d => setSuggestions(d.suggestions || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setMessages(m => [...m, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('question', text);
      const res = await fetch(`${BASE}/ai/chat`, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({ answer: "Empty response from server" }));
      setMessages(m => [...m, { role: 'assistant', text: data.answer || "Sorry, I couldn't process that." }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: "I'm having trouble connecting to the backend. Make sure the server is running." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-border bg-card/60">
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-gradient-to-br from-primary to-accent">
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-medium text-zinc-100">AI Assistant</span>
      </div>

      <motion.div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            variants={staggerItem}
            className={m.role === 'assistant' ? 'flex gap-2' : 'flex gap-2 justify-end'}
          >
            {m.role === 'assistant' && (
              <div className="h-6 w-6 shrink-0 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center mt-0.5">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            )}
            <div
              className={
                m.role === 'assistant'
                  ? 'text-[13px] leading-relaxed text-zinc-300 bg-white/[0.04] rounded-lg rounded-tl-sm px-3 py-2 max-w-[85%] whitespace-pre-wrap'
                  : 'text-[13px] leading-relaxed text-white bg-primary/90 rounded-lg rounded-tr-sm px-3 py-2 max-w-[85%] whitespace-pre-wrap'
              }
            >
              {m.text}
            </div>
          </motion.div>
        ))}
        {loading && (
          <motion.div variants={staggerItem} className="flex gap-2">
            <div className="h-6 w-6 shrink-0 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-white" />
            </div>
            <div className="bg-white/[0.04] rounded-lg rounded-tl-sm px-3 py-2">
              <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />
            </div>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </motion.div>

      {suggestions.length > 0 && messages.length <= 2 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="btn-press flex items-center gap-1.5 text-[11px] text-zinc-400 border border-border rounded-full px-2.5 py-1 hover:border-border-strong hover:text-zinc-200 transition-colors"
            >
              <Wand2 className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate max-w-[200px]">{s}</span>
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2 border-t border-border px-3 py-2.5"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your data or models…"
          className="flex-1 bg-transparent text-[13px] text-zinc-100 placeholder:text-zinc-600 outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          className="btn-press flex items-center justify-center h-7 w-7 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40"
          disabled={!input.trim() || loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
        </button>
      </form>
    </div>
  );
}
