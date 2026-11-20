// Rotas por hash (#/hoje, #/treino/<id> …): funcionam no GitHub Pages sem servidor
// e mantêm a URL /apexrun/analise/ dos atalhos já instalados.
import { useSyncExternalStore } from 'react';

export type Route = { name: string; arg: string | null; parts: string[] };

function parse(): Route {
  const h = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
  const parts = h.split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] || 'hoje', arg: parts[1] || null, parts };
}
let cur = parse();
const ls = new Set<() => void>();
window.addEventListener('hashchange', () => {
  cur = parse();
  ls.forEach((l) => l());
  window.scrollTo(0, 0);
});
export function useRoute(): Route {
  return useSyncExternalStore((cb) => { ls.add(cb); return () => ls.delete(cb); }, () => cur);
}
export function href(...parts: (string | number)[]): string {
  return '#/' + parts.map((p) => encodeURIComponent(String(p))).join('/');
}
export function go(...parts: (string | number)[]) { location.hash = href(...parts); }
