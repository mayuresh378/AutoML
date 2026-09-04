import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { initAuth } from './hooks/useAuth';
import './styles/globals.css';

const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const theme = savedTheme || (prefersDark ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', theme);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 300_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

/**
 * Fires Firebase auth wiring + HTTP token configuration after the first paint
 * so that auth initialization does not block the initial render of the shell.
 * ConfigureHttp only needs to be ready before the first API call (React Query),
 * which happens in effects after mount — not during the initial render.
 */
function InitAuth() {
  useEffect(() => {
    initAuth();
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <InitAuth />
      <App />
    </QueryClientProvider>
  </StrictMode>
);
