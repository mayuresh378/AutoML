import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // Pin the API base so tests are deterministic regardless of the
    // developer's local frontend/.env (which points at a live backend).
    env: { VITE_API_URL: '/api/v1' },
  },
});
