// PROGRESSO › CORPO (Fase 5 · Etapa 4). Módulo puro: só conta os registros do mapa do corpo
// (dorRegioes) dos treinos no período. Sem diagnóstico e sem alerta.
// - treinos registrados: os do período que têm o campo dorRegioes (lista, mesmo vazia);
// - vezes da região: treinos em que ela foi marcada com dor acima de 0;
// - faixas de frequência: 1–2, 3–5, 6 ou mais.
export const FAIXAS_CORPO = [[1, 2], [3, 5], [6, Infinity]];
export const faixaCorpo = (n) => (!n ? -1 : n <= 2 ? 0 : n <= 5 ? 1 : 2);
const chave = (r) => (r.regiao === 'lombar' || !r.lado ? r.regiao : r.regiao + '_' + r.lado);
export function contagem(workouts, { de = null, ate = null } = {}) {
  const ws = (workouts || []).filter((w) => w && Array.isArray(w.dorRegioes) && (!de || w.date >= de) && (!ate || w.date <= ate)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const vezes = {}, linhas = {};
  for (const w of ws) for (const r of w.dorRegioes) {
    if (!r || !(r.int > 0)) continue;
    const k = chave(r); vezes[k] = (vezes[k] || 0) + 1; (linhas[k] = linhas[k] || []).push({ date: w.date, int: r.int, wid: w.id });
  }
  const top = Object.entries(vezes).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] || null;
  return { treinos: ws.length, vezes, linhas, top: top ? { k: top[0], n: top[1] } : null };
}
