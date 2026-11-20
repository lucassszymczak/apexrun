import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

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
    generateBundle(_opts, bundle) {
      for (const f of ANALISE_ASSETS) {
        this.emitFile({ type: 'asset', fileName: 'analise/' + f, source: readFileSync(marcaDir + f) });
      }
      // service worker (offline): tudo o que o app de análise carrega, inclusive os
      // pedaços carregados sob demanda (mapa, leitor de .FIT, EXIF) e as fontes
      const entry = Object.values(bundle).find((c: any) => c.type === 'chunk' && c.isEntry && c.name === 'analise') as any;
      if (!entry) return;
      const files = new Set<string>();
      const walk = (name: string) => {
        const c: any = bundle[name];
        if (!c || files.has(name)) return;
        files.add(name);
        if (c.type !== 'chunk') return;
        for (const n of [...c.imports, ...c.dynamicImports]) walk(n);
        for (const n of c.viteMetadata?.importedCss || []) files.add(n);
        for (const n of c.viteMetadata?.importedAssets || []) files.add(n);
      };
      walk(entry.fileName);
      for (const n of Object.keys(bundle)) if (/^assets\/outfit-.*\.woff2$/.test(n)) files.add(n);
      const list = ['./', ...ANALISE_ASSETS.map((f) => './' + f), ...[...files].sort().map((f) => '../' + f)];
      const version = createHash('sha256').update(list.join('\n') + readFileSync(new URL('./analise/pwa/sw-template.js', import.meta.url).pathname, 'utf8')).digest('hex').slice(0, 12);
      const sw = readFileSync(new URL('./analise/pwa/sw-template.js', import.meta.url).pathname, 'utf8')
        .replace('__VERSION__', version).replace('__FILES__', JSON.stringify(list, null, 0));
      this.emitFile({ type: 'asset', fileName: 'analise/sw.js', source: sw });
    },
  };
}

// Depois que o Vite gera o HTML: pré-carrega as fontes do app de análise.
function analiseFontPreload(): Plugin {
  return {
    name: 'apex-analise-font-preload',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      // fontes pré-carregadas (evita o texto "pular" quando a Outfit chega)
      const html: any = bundle['analise/index.html'];
      if (html && typeof html.source === 'string') {
        const m = /href="([^"]*)assets\/analise-[^"]+\.css"/.exec(html.source);
        const fonts = Object.keys(bundle).filter((n) => /^assets\/outfit-latin-(400|500)-normal-.*\.woff2$/.test(n));
        if (m && fonts.length) html.source = html.source.replace('</head>', fonts.map((f) => `  <link rel="preload" as="font" type="font/woff2" crossorigin href="${m[1]}${f}">\n`).join('') + '</head>');
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
  plugins: [react(), analiseAssets(), analiseFontPreload()],
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
