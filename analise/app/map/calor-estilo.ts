// Cores e espessuras das 5 faixas do mapa de calor (CLAUDE.md, "Componentes da Fase 3")
export const COR_FAIXA = ['var(--ciano)', 'var(--ciano)', 'var(--zona-3)', 'var(--zona-4)', 'var(--zona-5)'];
export const OPAC_FAIXA = [0.35, 1, 1, 1, 1];
export const LARG_FAIXA = [2.5, 3, 3.5, 4.5, 5.5];
export const ROT_FAIXA = ['1 a 2 vezes', '3 a 5 vezes', '6 a 10 vezes', '11 a 19 vezes', '20 vezes ou mais'];
// partes de uma linha que estão dentro da seleção (para o contorno da rua tocada)
export function dentro(cells: string[], sel: Set<string>): string[][] {
  const out: string[][] = []; let cur: string[] = [];
  for (const c of cells) { if (sel.has(c)) cur.push(c); else { if (cur.length) out.push(cur); cur = []; } }
  if (cur.length) out.push(cur);
  return out;
}
