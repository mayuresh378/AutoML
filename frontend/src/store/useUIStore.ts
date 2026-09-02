import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  activePage: string;
  setActivePage: (page: string) => void;
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  settingsTab: string;
  setSettingsTab: (tab: string) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

const getInitialTheme = (): 'dark' | 'light' => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') return stored;
  }
  return 'dark';
};

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  activePage: 'Dashboard',
  setActivePage: (page) => set({ activePage: page }),
  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
  settingsTab: 'general',
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  theme: getInitialTheme(),
  toggleTheme: () => set((s) => {
    const next = s.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('light', next === 'light');
    return { theme: next };
  }),
}));
