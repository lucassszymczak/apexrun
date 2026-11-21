// PLANO DE PROVA no app (Fase 4 · Etapa 3): junta o ciclo, o percurso, a âncora do tempo
// realista e a previsão do dia da prova. A previsão fica só neste aparelho (localStorage
// próprio, fora de apex.analise.v1 e da sincronização): o plano abre sem internet.
import { useEffect, useMemo, useState } from 'react';
import * as E from '../engine.mjs';
import { montaPlano, modoClima, tempoRealista, metaDoPlano, correcaoDaHora, DIAS_PREVISAO, diasAte } from '../plano.mjs';
import { fetchPrevisao } from '../previsao.mjs';
import { resumoCourse, deLeve } from '../percurso.mjs';

const KEY = 'apex.previsao.prova';
// uma busca por vez: se a tela abrir de novo enquanto a busca corre, usa a mesma
const emVoo = new Map<string, Promise<any>>();
function buscar(geo: { lat: number; lon: number }, data: string) {
  const k = data + '|' + geo.lat.toFixed(4) + '|' + geo.lon.toFixed(4);
  let p = emVoo.get(k);
  if (!p) { p = fetchPrevisao(geo, data).finally(() => setTimeout(() => emVoo.delete(k), 0)); emVoo.set(k, p); }
  return p;
}
const TRES_H = 3 * 3600 * 1000;
type Cache = { data: string; lat: number; lon: number; buscadaEm: string; horas: any[] };
function lerCache(): Cache | null { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
function gravarCache(c: Cache) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* sem storage */ } }

// local de largada: o primeiro ponto do percurso (sem percurso, sem local: clima padrão)
export function localDaLargada(race: any): { lat: number; lon: number } | null {
  if (!race || !race.course || !race.course.perfil || !race.course.perfil.rota) return null;
  const L = deLeve(race.course.perfil);
  return L.rota && L.rota.lat.length ? { lat: L.rota.lat[0], lon: L.rota.lon[0] } : null;
}

// a mesma âncora do card "Estimativa de prova" (ciclo de prova)
export function ancoraDoCiclo(race: any): any {
  const runs = E.runsOnly(E.sortedWorkouts());
  return E.bestAnchor(race ? E.cycleRunsInRange(race) : []) || E.bestAnchor(runs);
}

// Previsão do dia da prova: uma busca por abertura, no máximo, com cache de 3 h.
export function usePrevisaoProva(race: any): { horas: any[] | null; buscadaEm: string | null; carregando: boolean } {
  const geo = localDaLargada(race);
  const data = race && race.date;
  const dentro = !!(data && geo && diasAte(data, new Date()) >= 0 && diasAte(data, new Date()) <= DIAS_PREVISAO);
  const c0 = lerCache();
  const valido = (c: Cache | null) => !!(c && geo && c.data === data && Math.abs(c.lat - geo.lat) < 1e-3 && Math.abs(c.lon - geo.lon) < 1e-3);
  const [st, setSt] = useState<{ horas: any[] | null; buscadaEm: string | null; carregando: boolean }>(() => valido(c0) ? { horas: c0!.horas, buscadaEm: c0!.buscadaEm, carregando: false } : { horas: null, buscadaEm: null, carregando: dentro });
  useEffect(() => {
    if (!dentro || !geo) return;
    const c = lerCache();
    if (valido(c) && Date.now() - Date.parse(c!.buscadaEm) < TRES_H) return; // cache novo: não busca
    let vivo = true;
    buscar(geo, data).then((p) => {
      if (!vivo) return;
      if (p) { gravarCache({ data, lat: geo.lat, lon: geo.lon, buscadaEm: p.buscadaEm, horas: p.horas }); setSt({ horas: p.horas, buscadaEm: p.buscadaEm, carregando: false }); }
      else setSt((s) => ({ ...s, carregando: false })); // sem internet: fica a última guardada (ou o clima padrão)
    });
    return () => { vivo = false; };
  }, [data, geo && geo.lat, geo && geo.lon, dentro]);
  return st;
}

export function usePlano(st: any) {
  const race = st.race;
  const prev = usePrevisaoProva(race);
  return useMemo(() => {
    if (!race || !(race.distKm > 0)) return null;
    const res = race.course ? resumoCourse(race.course) : null;
    const kmsPercurso = res ? res.kms : null;
    const clima = modoClima(race.date, new Date(), prev.horas);
    // clima médio das horas da prova, para a faixa do tempo realista
    const anchor = ancoraDoCiclo(race);
    const real0 = tempoRealista({ anchor, distKm: race.distKm, kmsPercurso });
    const meta = metaDoPlano(race, real0);
    if (!meta) return { race, res, clima, realista: real0, meta: null, plano: null, prev };
    const t0 = performance.now();
    const plano = montaPlano({ distKm: race.distKm, kmsPercurso, alvoSec: meta.alvoS, strategy: race.strategy || 'constante', startTime: race.startTime || '06:00', horas: prev.horas, athlete: st.athlete, clima });
    const ms = performance.now() - t0;
    const climaPct = clima.modo === 'previsao' ? (plano.totalS / meta.alvoS - 1) * 100 : 0;
    const realista = climaPct ? tempoRealista({ anchor, distKm: race.distKm, kmsPercurso, climaPct }) : real0;
    const horaLargada = prev.horas ? prev.horas.find((h: any) => h.hora === (race.startTime || '06:00').slice(0, 2) + ':00') : null;
    return { race, res, clima, realista, meta, plano, ms, prev, horaLargada, corrLargada: horaLargada ? correcaoDaHora(horaLargada, st.athlete) : null };
  }, [race, st.workouts, st.athlete, prev.horas]);
}
