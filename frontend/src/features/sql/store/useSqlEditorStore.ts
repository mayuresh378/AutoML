import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { QueryTab, QueryResult } from '../types';

interface SqlEditorState {
  tabs: QueryTab[];
  activeTabId: string;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  bottomPanelOpen: boolean;
  bottomPanelTab: string;
  leftPanelWidth: number;
  rightPanelWidth: number;
  bottomPanelHeight: number;

  addTab: () => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabQuery: (id: string, query: string) => void;
  updateTabResult: (id: string, result: QueryResult | null) => void;
  updateTabError: (id: string, error: string | null) => void;
  updateTabRunning: (id: string, isRunning: boolean) => void;
  renameTab: (id: string, name: string) => void;
  duplicateTab: (id: string) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  setBottomPanelOpen: (open: boolean) => void;
  setBottomPanelTab: (tab: string) => void;
  setLeftPanelWidth: (w: number) => void;
  setRightPanelWidth: (w: number) => void;
  setBottomPanelHeight: (h: number) => void;
}

let _tabCounter = 1;

export const useSqlEditorStore = create<SqlEditorState>()(
  persist(
    (set, get) => ({
      tabs: [{ id: 'tab-1', name: 'query.sql', query: '', isDirty: false, result: null, error: null, isRunning: false, createdAt: Date.now(), updatedAt: Date.now() }],
      activeTabId: 'tab-1',
      leftPanelOpen: true,
      rightPanelOpen: false,
      bottomPanelOpen: false,
      bottomPanelTab: 'results',
      leftPanelWidth: 280,
      rightPanelWidth: 320,
      bottomPanelHeight: 300,

      addTab: () => {
        _tabCounter++;
        const id = `tab-${_tabCounter}`;
        const tab: QueryTab = { id, name: `query-${_tabCounter}.sql`, query: '', isDirty: false, result: null, error: null, isRunning: false, createdAt: Date.now(), updatedAt: Date.now() };
        set((s) => ({ tabs: [...s.tabs, tab], activeTabId: id }));
      },

      closeTab: (id) => set((s) => {
        if (s.tabs.length <= 1) return s;
        const idx = s.tabs.findIndex((t) => t.id === id);
        const newTabs = s.tabs.filter((t) => t.id !== id);
        const newActive = s.activeTabId === id
          ? newTabs[Math.min(idx, newTabs.length - 1)]?.id || newTabs[0].id
          : s.activeTabId;
        return { tabs: newTabs, activeTabId: newActive };
      }),

      setActiveTab: (id) => set({ activeTabId: id }),
      updateTabQuery: (id, query) => set((s) => ({ tabs: s.tabs.map((t) => t.id === id ? { ...t, query, isDirty: true, updatedAt: Date.now() } : t) })),
      updateTabResult: (id, result) => set((s) => ({ tabs: s.tabs.map((t) => t.id === id ? { ...t, result, error: null, isRunning: false } : t) })),
      updateTabError: (id, error) => set((s) => ({ tabs: s.tabs.map((t) => t.id === id ? { ...t, error, isRunning: false } : t) })),
      updateTabRunning: (id, isRunning) => set((s) => ({ tabs: s.tabs.map((t) => t.id === id ? { ...t, isRunning } : t) })),
      renameTab: (id, name) => set((s) => ({ tabs: s.tabs.map((t) => t.id === id ? { ...t, name } : t) })),

      duplicateTab: (id) => set((s) => {
        const src = s.tabs.find((t) => t.id === id);
        if (!src) return s;
        _tabCounter++;
        const newId = `tab-${_tabCounter}`;
        const tab: QueryTab = { ...src, id: newId, name: `${src.name.replace(/\.sql$/, '')} (copy).sql`, createdAt: Date.now(), updatedAt: Date.now() };
        return { tabs: [...s.tabs, tab], activeTabId: newId };
      }),

      toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
      toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
      toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
      setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
      setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),
      setLeftPanelWidth: (w) => set({ leftPanelWidth: w }),
      setRightPanelWidth: (w) => set({ rightPanelWidth: w }),
      setBottomPanelHeight: (h) => set({ bottomPanelHeight: h }),
    }),
    {
      name: 'sql-editor-state',
      partialize: (state) => ({ tabs: state.tabs, activeTabId: state.activeTabId, leftPanelWidth: state.leftPanelWidth, rightPanelWidth: state.rightPanelWidth, bottomPanelHeight: state.bottomPanelHeight }),
    },
  ),
);
