import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@framework': fileURLToPath(new URL('./framework', import.meta.url)),
      '@infra': fileURLToPath(new URL('./infra', import.meta.url)),
      '@native': fileURLToPath(new URL('./native', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
