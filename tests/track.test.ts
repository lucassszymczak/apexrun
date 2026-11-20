import { describe, it, expect } from 'vitest';
// @ts-expect-error módulo JS sem tipos (gerador de .FIT sintético do golden master)
import { fitMessages } from '../analise/golden/synthetic.mjs';
// @ts-expect-error módulo JS sem tipos
import { rng } from '../analise/golden/env.mjs';
import * as E from '../analise/engine.mjs';
import { buildTrack, simplify, haversine, kmMarks, idxAtTime, colorer, coloredRuns, totalDist, duration } from '../analise/app/track';

function msgs(opt: Record<string, unknown> = {}) {
  return fitMessages(rng(42), Object.assign({ date: '2026-10-01', min: 40, speed: 2.8, seed: 3, hilly: true, pause: true }, opt));
}

// distância (m) de um ponto ao segmento a–b, em projeção local
function distToSeg(p: [number, number], a: [number, number], b: [number, number]) {
  const lat0 = (a[0] * Math.PI) / 180, R = 6371000;
  const P = (q: [number, number]) => [((q[1] * Math.PI) / 180) * Math.cos(lat0) * R, ((q[0] * Math.PI) / 180) * R];
  const [px, py] = P(p), [ax, ay] = P(a), [bx, by] = P(b);
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const u = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

describe('trajeto (buildTrack)', () => {
  const m = msgs();
  const tr = buildTrack(m)!;

  it('converte a posição para graus e marca que tem GPS', () => {
    expect(tr.hasGps).toBe(true);
    const lat = tr.lat.find((x) => x != null)!;
    expect(lat).toBeGreaterThan(-26); expect(lat).toBeLessThan(-25);
  });

  it('o tempo é o real do treino (inclui a pausa de 90 s)', () => {
    for (let i = 1; i < tr.t.length; i++) expect(tr.t[i]).toBeGreaterThan(tr.t[i - 1]);
    expect(duration(tr)).toBeCloseTo(40 * 60 + 90, 0);
  });

  it('usa a inclinação suavizada do próprio motor (gradeSeries)', () => {
    const recs = E.fitNormRecords(m.recordMesgs);
    const g = E.gradeSeries(recs, 50);
    tr.grade.forEach((x, i) => expect(x).toBe(g[i] == null ? null : Math.round(g[i] * 10) / 10));
  });

  it('o traçado simplificado fica a no máximo ~3 m de todos os pontos originais', () => {
    expect(tr.draw.length).toBeLessThan(tr.t.length);
    let worst = 0;
    for (let k = 0; k < tr.draw.length - 1; k++) {
      const a = tr.draw[k], b = tr.draw[k + 1];
      for (let i = a; i <= b; i++) {
        if (tr.lat[i] == null) continue;
        const d = distToSeg([tr.lat[i]!, tr.lon[i]!], [tr.lat[a]!, tr.lon[a]!], [tr.lat[b]!, tr.lon[b]!]);
        worst = Math.max(worst, d);
      }
    }
    expect(worst).toBeLessThanOrEqual(3.05);
  });

  it('marcos de km: um por km completo, no ponto em que a distância passa do km', () => {
    const marks = kmMarks(tr, 1);
    expect(marks.length).toBe(Math.floor(totalDist(tr) / 1000));
    marks.forEach((mk) => { expect(tr.dist[mk.i]!).toBeGreaterThanOrEqual(mk.km * 1000); expect(tr.dist[mk.i - 1]!).toBeLessThan(mk.km * 1000); });
    expect(kmMarks(tr, 5).length).toBe(Math.floor(totalDist(tr) / 5000));
  });

  it('índice pelo tempo (replay e gráfico ligado)', () => {
    expect(idxAtTime(tr, 0)).toBe(0);
    expect(idxAtTime(tr, 1e9)).toBe(tr.t.length - 1);
    const i = idxAtTime(tr, 600); expect(Math.abs(tr.t[i] - 600)).toBeLessThanOrEqual(1);
  });

  it('fuso do treino vem de local_timestamp − timestamp', () => {
    const ts = new Date('2026-10-01T10:00:00Z');
    const local = ts.getTime() / 1000 - 631065600 - 3 * 3600; // Brasília, UTC−3
    const t2 = buildTrack({ ...m, activityMesgs: [{ timestamp: ts, localTimestamp: local }] })!;
    expect(t2.tzOffsetSec).toBe(-10800);
    expect(tr.tzOffsetSec).toBeNull();
  });

  it('sem GPS (esteira / bike indoor): guarda as séries, sem traçado', () => {
    const noGps = { ...m, recordMesgs: m.recordMesgs.map((r: Record<string, unknown>) => ({ ...r, positionLat: undefined, positionLong: undefined })) };
    const t3 = buildTrack(noGps)!;
    expect(t3.hasGps).toBe(false); expect(t3.draw.length).toBe(0); expect(t3.hr.some((x) => x != null)).toBe(true);
  });
});

describe('cores do trajeto', () => {
  const tr = buildTrack(msgs())!;
  const a = { ...E.DEFAULT_ATHLETE };
  const w = { modal: 'corrida', type: 'facil' };
  it('inclinação usa as 5 faixas do motor (gradeBandIdx)', () => {
    const c = colorer(tr, 'grade', w, a);
    tr.grade.forEach((g, i) => { if (g != null) expect(c.band(i)).toBe(E.gradeBandIdx(g)); });
    expect(c.legend).toEqual(['< −5%', '−5 a −2%', '±2%', '2 a 5%', '> 5%']);
  });
  it('zona usa as zonas do atleta (Karvonen na corrida)', () => {
    const c = colorer(tr, 'zona', w, a);
    tr.hr.forEach((h, i) => { if (h != null) expect(c.band(i)).toBe(E.hrZone(h, a.fcRep, a.fcMax) - 1); });
  });
  it('bike usa as zonas da bike', () => {
    const wb = { modal: 'bike', type: 'bike' };
    const c = colorer(tr, 'zona', wb, a);
    const b = E.zoneBoundsFor(wb, a);
    tr.hr.forEach((h, i) => { if (h != null) expect(c.band(i)).toBe(E.hrZoneBounds(h, b) - 1); });
  });
  it('pace: 5 faixas pelos quintis do próprio treino', () => {
    const c = colorer(tr, 'pace', w, a);
    const cnt = [0, 0, 0, 0, 0]; tr.spd.forEach((_, i) => { const z = c.band(i); if (z != null) cnt[z]++; });
    const tot = cnt.reduce((s, x) => s + x, 0);
    cnt.forEach((x) => expect(x / tot).toBeGreaterThan(0.1));
  });
  it('trechos agrupados por cor cobrem o traçado inteiro', () => {
    const runs = coloredRuns(tr, colorer(tr, 'zona', w, a).band);
    expect(runs[0].idx[0]).toBe(tr.draw[0]);
    expect(runs[runs.length - 1].idx.slice(-1)[0]).toBe(tr.draw[tr.draw.length - 1]);
  });
  it('haversine: 1 grau de latitude ≈ 111 km', () => {
    expect(haversine(0, 0, 1, 0)).toBeCloseTo(111195, -2);
    expect(simplify([0], [0], [0])).toEqual([0]);
  });
});
