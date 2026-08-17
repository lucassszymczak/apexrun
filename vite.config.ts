import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Resolve o diretório src sem depender de APIs do Node (funciona em ESM).
const srcDir = new URL('./src', import.meta.url).pathname;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  server: {
    port: 5173,
  },
});
