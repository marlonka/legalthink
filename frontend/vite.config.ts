import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
    proxy: { '/api': loadEnv(mode, '.', 'VITE_').VITE_API_PROXY || 'http://127.0.0.1:8000' },
  },
}));
