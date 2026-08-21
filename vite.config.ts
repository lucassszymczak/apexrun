import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Resolve o diretório src sem depender de APIs do Node (funciona em ESM).
const srcDir = new URL('./src', import.meta.url).pathname;

// https://vitejs.dev/config/
export default defineConfig({
  // Caminho base do site. Em produção no GitHub Pages o app fica em
  // usuario.github.io/apexrun/, então o build define VITE_BASE=/apexrun/.
  // Local e em hosts que servem na raiz (Vercel/Netlify): '/'.
  base: process.env.VITE_BASE || '/',
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
