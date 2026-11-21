// FANTASMA no app (Fase 3 · Etapa 5): candidatos do treino aberto (mesma modalidade, com trajeto
// neste aparelho) e o trajeto do fantasma escolhido. Nada é gravado: a escolha vale só para a tela.
import { useEffect, useState } from 'react';
import { getState } from './store';
import { getTrack, trackIds } from './db';
import { celulasDe } from './calor-app';
import { ehPedal, ehEsteira } from '../calor.mjs';
import { candidatos, ordena, type Cand } from '../fantasma.mjs';
import { type Track } from './track';

export function useCandidatos(w: any, ativo: boolean): Cand[] | null {
  const [c, setC] = useState<Cand[] | null>(null);
  useEffect(() => {
    if (!w || !ativo) return;
    let vivo = true;
    (async () => {
      const ids = await trackIds();
      if (!ids.has(w.id) || ehEsteira(w)) { if (vivo) setC([]); return; }
      const pedal = ehPedal(w);
      const outros = [];
      for (const o of getState().workouts) {
        if (o.id === w.id || ehPedal(o) !== pedal || ehEsteira(o) || !ids.has(o.id)) continue;
        if (!(w.distKm > 0) || !(o.distKm > 0) || Math.abs(o.distKm - w.distKm) / w.distKm > 0.1) continue; // corte barato antes das quadrículas
        outros.push({ w: o, cells: await celulasDe(o.id) });
      }
      const eu = await celulasDe(w.id);
      if (vivo) setC(eu ? ordena(w, candidatos({ w, cells: eu }, outros)) : []);
    })().catch(() => { if (vivo) setC([]); });
    return () => { vivo = false; };
  }, [w && w.id, ativo]);
  return c;
}
export function useTrackFantasma(id: string | null): Track | null {
  const [tr, setTr] = useState<Track | null>(null);
  useEffect(() => { let vivo = true; setTr(null); if (id) getTrack(id).then((t) => { if (vivo) setTr(t); }).catch(() => {}); return () => { vivo = false; }; }, [id]);
  return tr;
}
// parâmetros da URL do treino: #/treino/<id>?fantasma=<id>&v0=<s>&f0=<s>&v1=<s>&f1=<s>
export function paramsFantasma(): { id: string | null; v0: number; f0: number; v1: number | null; f1: number | null } {
  const q = new URLSearchParams((location.hash.split('?')[1]) || '');
  const n = (k: string) => (q.get(k) != null && isFinite(+q.get(k)!) ? +q.get(k)! : null);
  return { id: q.get('fantasma'), v0: n('v0') || 0, f0: n('f0') || 0, v1: n('v1'), f1: n('f1') };
}
