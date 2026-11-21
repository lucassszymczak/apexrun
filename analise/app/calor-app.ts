// MAPA DE CALOR no app (Fase 3 · Etapa 3). Lê os trajetos DESTE aparelho (IndexedDB), marca as
// quadrículas de cada treino (guardadas em memória, por treino) e junta. Nada é gravado em
// apex.analise.v1 nem sincronizado: o mapa revela onde o Lucas mora.
import { useEffect, useState } from 'react';
import { getTrack, trackIds, onTrackChange } from './db';
import { doTreino, agrega, resumo, linhas, ehPedal, ehEsteira, type Agregado, type PorTreino } from '../calor.mjs';
import { intervalo } from './periodo';

export type Modal = 'corrida' | 'pedal';
export type PerCalor = '12m' | 'ciclo' | 'tudo';
export type Calor = { chave?: string; ag: Agregado; resumo: ReturnType<typeof resumo>; linhas: ReturnType<typeof linhas>; semTrajeto: any[]; ms: number };

// quadrículas por treino, em memória (o trajeto não muda depois de gravado; se mudar, o
// onTrackChange limpa a entrada)
const cache = new Map<string, PorTreino | null>();
onTrackChange((id) => cache.delete(id));
async function doId(id: string): Promise<PorTreino | null> {
  if (cache.has(id)) return cache.get(id)!;
  const tr = await getTrack(id);
  let r: PorTreino | null = null;
  if (tr && tr.hasGps !== false && tr.draw && tr.draw.length > 1) {
    const lat = tr.draw.map((i) => tr.lat[i]), lon = tr.draw.map((i) => tr.lon[i]);
    const x = doTreino(lat, lon); if (x.cells.length) r = { id, ...x };
  }
  cache.set(id, r);
  return r;
}

export function treinosDoRecorte(ws: any[], modal: Modal, per: PerCalor, st: any) {
  const r = intervalo(per, st);
  return ws.filter((w) => (modal === 'pedal') === ehPedal(w) && !ehEsteira(w) && (!r || (w.date >= r[0] && w.date <= r[1])));
}

export async function calcCalor(ws: any[]): Promise<Calor> {
  const t0 = performance.now();
  const ids = await trackIds();
  const pt: PorTreino[] = []; const sem: any[] = [];
  for (const w of ws) {
    const x = ids.has(w.id) ? await doId(w.id) : null;
    if (x) pt.push(x); else sem.push(w);
  }
  const ag = agrega(pt);
  return { ag, resumo: resumo(ag), linhas: linhas(ag), semTrajeto: sem, ms: performance.now() - t0 };
}

export function useCalor(ws: any[], chave: string): Calor | null {
  const [c, setC] = useState<Calor | null>(null);
  const [v, setV] = useState(0);
  // vários trajetos chegando de uma vez (download): recalcula uma vez só, no fim
  useEffect(() => { let t: any; const off = onTrackChange(() => { clearTimeout(t); t = setTimeout(() => setV((x) => x + 1), 500); }); return () => { clearTimeout(t); off(); }; }, []);
  useEffect(() => {
    let vivo = true;
    calcCalor(ws).then((r) => { if (vivo) setC({ ...r, chave }); }).catch(() => { if (vivo) setC(null); });
    return () => { vivo = false; };
  }, [chave, v]);
  return c && c.chave === chave ? c : null;
}
