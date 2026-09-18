// Copia a página de análise autônoma para dentro do build do Vite (dist/),
// para que o mesmo deploy do GitHub Pages a sirva em /apexrun/analise/.
// Roda como "postbuild" (npm executa após "build").
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'analise/index.html');
const destDir = resolve(root, 'dist/analise');
const dest = resolve(destDir, 'index.html');

if (!existsSync(src)) {
  console.error('[copy-analise] fonte não encontrada:', src);
  process.exit(1);
}
if (!existsSync(resolve(root, 'dist'))) {
  console.error('[copy-analise] dist/ não existe — rode "vite build" antes.');
  process.exit(1);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log('[copy-analise] copiado →', dest.replace(root + '/', ''));
