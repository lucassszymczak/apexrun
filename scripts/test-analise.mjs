// Roda todos os testes do motor da análise (analise/*.test.mjs), um processo por
// arquivo, como `node analise/x.test.mjs`. Sai com erro se algum falhar.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = readdirSync(resolve(root, 'analise')).filter((f) => f.endsWith('.test.mjs')).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['analise/' + f], { cwd: root, encoding: 'utf8' });
  const last = ((r.stdout || '').match(/=== RESULTADO:.*===/g) || ['(sem resumo)']).pop();
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log((ok ? '✓ ' : '✗ ') + f.padEnd(28) + last);
  if (!ok) console.log((r.stdout || '').split('\n').filter((l) => /✗|Error|error/.test(l)).slice(0, 15).join('\n') + (r.stderr ? '\n' + r.stderr.slice(0, 1500) : ''));
}
console.log(failed ? `\n${failed} arquivo(s) com falha` : `\n${files.length} arquivos, todos verdes`);
process.exit(failed ? 1 : 0);
