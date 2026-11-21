// "AMANHÃ CEDO" no app (Fase 4 · Etapa 5). Preferências em athlete (janela, mostrar o card, modo
// do local), que sincronizam; o PONTO escolhido à mão fica só neste aparelho (localStorage
// próprio, fora de apex.analise.v1). Previsão com cache de 3 h, no máximo uma busca por abertura.
import { useEffect, useState } from 'react';
import { fetchPrevisao } from '../previsao.mjs';
import { melhorHorario, mostraAgora, amanhaIso, pontoAutomatico, JANELA_PADRAO } from '../amanha.mjs';

const K_PONTO = 'apex.previsao.ponto', K_CACHE = 'apex.previsao.amanha', TRES_H = 3 * 3600 * 1000;
const ler = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const gravar = (k: string, v: any) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } };

export type PrefTreino = { janela: { de: string; ate: string }; mostrar: boolean; local: 'auto' | 'mapa' };
export function prefsTreino(athlete: any): PrefTreino {
  const t = (athlete && athlete.treino) || {};
  return { janela: t.janela && t.janela.de && t.janela.ate ? t.janela : JANELA_PADRAO, mostrar: t.mostrarAmanha !== false, local: t.local === 'mapa' ? 'mapa' : 'auto' };
}
export const pontoManual = (): { lat: number; lon: number } | null => ler(K_PONTO);
export const salvarPontoManual = (p: { lat: number; lon: number } | null) => gravar(K_PONTO, p ? { lat: Math.round(p.lat * 1e4) / 1e4, lon: Math.round(p.lon * 1e4) / 1e4 } : null);
export function pontoDaPrevisao(st: any): { lat: number; lon: number } | null {
  const pr = prefsTreino(st.athlete);
  if (pr.local === 'mapa') return pontoManual();
  return pontoAutomatico(st.workouts);
}

const emVoo = new Map<string, Promise<any>>();
export function useAmanha(st: any, agora = new Date()) {
  const pr = prefsTreino(st.athlete);
  const ponto = pontoDaPrevisao(st);
  const data = amanhaIso(agora);
  const ativo = pr.mostrar && mostraAgora(agora) && !!ponto;
  const valido = (c: any) => !!(c && ponto && c.data === data && Math.abs(c.lat - ponto.lat) < 1e-3 && Math.abs(c.lon - ponto.lon) < 1e-3);
  const [horas, setHoras] = useState<any[] | null>(() => { const c = ler(K_CACHE); return valido(c) ? c.horas : null; });
  useEffect(() => {
    if (!ativo || !ponto) return;
    const c = ler(K_CACHE);
    if (valido(c)) { setHoras(c.horas); if (Date.now() - Date.parse(c.buscadaEm) < TRES_H) return; }
    let vivo = true;
    const k = data + '|' + ponto.lat.toFixed(3) + '|' + ponto.lon.toFixed(3);
    let p = emVoo.get(k); if (!p) { p = fetchPrevisao(ponto, data).finally(() => setTimeout(() => emVoo.delete(k), 0)); emVoo.set(k, p); }
    p.then((r: any) => { if (!vivo || !r) return; gravar(K_CACHE, { data, lat: ponto.lat, lon: ponto.lon, buscadaEm: r.buscadaEm, horas: r.horas }); setHoras(r.horas); });
    return () => { vivo = false; };
  }, [ativo, data, ponto && ponto.lat, ponto && ponto.lon]);
  if (!ativo || !horas) return null; // sem internet, sem ponto ou fora do horário: o card some
  return { prefs: pr, data, ...melhorHorario(horas, pr.janela, st.athlete) };
}
