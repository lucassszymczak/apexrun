import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';

// Resolve o diretório src sem depender de APIs do Node (funciona em ESM).
const srcDir = new URL('./src', import.meta.url).pathname;
const marcaDir = new URL('./design/marca/', import.meta.url).pathname;

// Ícones e manifest do app de análise (Apex Performance) vêm de design/marca/ e são
// servidos/publicados em /analise/<arquivo>, com os mesmos nomes de antes — assim os
// atalhos já instalados na tela inicial continuam achando os ícones.
const ANALISE_ASSETS = [
  'manifest.webmanifest',
  'favicon.svg',
  'apex-icon-32.png',
  'apex-icon-180.png',
  'apex-icon-192.png',
  'apex-icon-512.png',
  'apex-icon-maskable-512.png',
];
function analiseAssets(): Plugin {
  const type = (f: string) =>
    f.endsWith('.png') ? 'image/png' : f.endsWith('.svg') ? 'image/svg+xml' : 'application/manifest+json';
  return {
    name: 'apex-analise-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /\/analise\/([^/?#]+)$/.exec((req.url || '').split('?')[0]);
        if (m && ANALISE_ASSETS.includes(m[1]) && existsSync(marcaDir + m[1])) {
          res.setHeader('Content-Type', type(m[1]));
          res.end(readFileSync(marcaDir + m[1]));
          return;
        }
        next();
      });
    },
    generateBundle() {
      for (const f of ANALISE_ASSETS) {
        this.emitFile({ type: 'asset', fileName: 'analise/' + f, source: readFileSync(marcaDir + f) });
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  // Caminho base do site. Em produção no GitHub Pages o app fica em
  // usuario.github.io/apexrun/, então o build define VITE_BASE=/apexrun/.
  // Local e em hosts que servem na raiz (Vercel/Netlify): '/'.
  base: process.env.VITE_BASE || '/',
  plugins: [react(), analiseAssets()],
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
  build: {
    rollupOptions: {
      // Duas páginas: o app da raiz (/apexrun/) e o app de análise (/apexrun/analise/).
      input: {
        main: new URL('./index.html', import.meta.url).pathname,
        analise: new URL('./analise/index.html', import.meta.url).pathname,
      },
    },
  },
  server: {
    port: 5173,
  },
});
