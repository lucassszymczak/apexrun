// Copia a página de análise autônoma para dentro do build do Vite (dist/),
// para que o mesmo deploy do GitHub Pages a sirva em /apexrun/analise/.
// Roda como "postbuild" (npm executa após "build").
//
// Também injeta as chaves PÚBLICAS do Supabase (do ambiente, como no build do
// Vite) para habilitar a sincronização opcional entre aparelhos. A chave anon é
// pública por design (o RLS/RPC protege os dados); a service_role NUNCA entra.
// Sem as variáveis (build local), os placeholders ficam e a sync fica desligada.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
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

let html = readFileSync(src, 'utf8');
const url = process.env.VITE_SUPABASE_URL || '';
const anon = process.env.VITE_SUPABASE_ANON_KEY || '';
if (url && anon) {
  html = html.replace('__SUPABASE_URL__', url).replace('__SUPABASE_ANON_KEY__', anon);
  console.log('[copy-analise] chaves do Supabase injetadas (sincronização ligada)');
} else {
  console.log('[copy-analise] sem VITE_SUPABASE_* — sincronização desligada nesta cópia');
}

mkdirSync(destDir, { recursive: true });
writeFileSync(dest, html);
console.log('[copy-analise] copiado →', dest.replace(root + '/', ''));
