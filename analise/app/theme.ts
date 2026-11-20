// Aparência: escuro (padrão), claro ou automático. Mesma chave do app antigo
// (apex.theme), que guardava "dark"/"light"; "auto" é um valor novo e aditivo.
export type ThemePref = 'dark' | 'light' | 'auto';
const KEY = 'apex.theme';

export function themePref(): ThemePref {
  let t: string | null = null;
  try { t = localStorage.getItem(KEY); } catch { /* sem storage */ }
  return t === 'light' || t === 'auto' ? t : 'dark';
}
function resolved(p: ThemePref): 'dark' | 'light' {
  if (p === 'auto') return typeof window.matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  return p;
}
export function applyTheme(p: ThemePref = themePref()) {
  const t = resolved(p);
  document.documentElement.setAttribute('data-theme', t);
  // barra de status/navegador: as metas com media (escuro/claro) recebem a cor do tema
  // escolhido; no automático, cada uma volta à sua cor e o sistema decide
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute('media') || '';
    const own = /light/.test(media) ? '#F6F7FB' : '#0D0F1A';
    m.setAttribute('content', p === 'auto' ? own : t === 'light' ? '#F6F7FB' : '#0D0F1A');
  });
}
export function setThemePref(p: ThemePref) {
  try { localStorage.setItem(KEY, p); } catch { /* sem storage */ }
  applyTheme(p);
}
if (typeof window.matchMedia === 'function') {
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (themePref() === 'auto') applyTheme('auto'); });
}
