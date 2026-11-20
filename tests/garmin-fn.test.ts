// Função "garmin" com um Garmin SIMULADO (respostas sintéticas em tests/fixtures/garmin).
// Critérios 2, 3, 4 e 8 da Fase 2: conectar, chave nunca exposta, 403 fora da lista/origem,
// avisos de chave vencida e Garmin fora do ar sem repetir tentativas sem parar.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { zipSync, unzipSync } from 'fflate';
import { handle, decrypt, jwtExp, type Row, type Deps } from '../supabase/functions/garmin/core';

const SYNC = 'a'.repeat(64), OUTRO = 'b'.repeat(64);
const ORIGIN = 'https://lucassszymczak.github.io';
const KEY = 'chave-sintetica-' + 'x'.repeat(40);
const ENC = Buffer.from(new Uint8Array(32).map((_, i) => i * 7)).toString('base64');
const NOW = Date.parse('2026-11-20T12:00:00Z');
const jwt = (expS: number) => 'h.' + Buffer.from(JSON.stringify({ exp: expS })).toString('base64url') + '.s';
const LIST: Record<string, any[]> = {
  running: JSON.parse(readFileSync('tests/fixtures/garmin/activities-running.json', 'utf8')),
  cycling: JSON.parse(readFileSync('tests/fixtures/garmin/activities-cycling.json', 'utf8')),
};
const FIT = new Uint8Array([14, 16, 0x6c, 0x08, 1, 2, 3, 4, 0x2e, 0x46, 0x49, 0x54, 9, 9]);

let rows: Map<string, Row>, calls: string[], garmin: { mode: 'ok' | 'chave' | 'fora' | 'limite'; tokenExp: number };
const all: string[] = []; // tudo o que a função devolveu, para procurar a chave
function deps(): Deps {
  return {
    encKeyB64: ENC, allowed: [SYNC], origins: [ORIGIN], now: () => NOW,
    db: { get: async (id) => (rows.get(id) ? structuredClone(rows.get(id)!) : null), upsert: async (r) => { rows.set(r.sync_id, structuredClone(r)); }, remove: async (id) => { rows.delete(id); } },
    unzip: (z) => { const f = unzipSync(z); const n = Object.keys(f).find((x) => /\.fit$/i.test(x)); return n ? f[n] : null; },
    log: (o) => all.push('LOG ' + JSON.stringify(o)),
    fetch: (async (url: string, init: any) => {
      calls.push(String(url).replace(/^https:\/\/[^/]+/, ''));
      const auth = new Headers(init && init.headers).get('Authorization') || '';
      if (garmin.mode === 'fora') return new Response('x', { status: 503 });
      if (garmin.mode === 'limite') return new Response('x', { status: 429 });
      if (String(url).includes('/token')) return auth === 'ApiKey ' + KEY && garmin.mode === 'ok' ? new Response(jwt(garmin.tokenExp)) : new Response('', { status: 401 });
      if (!auth.startsWith('Bearer h.')) return new Response('', { status: 401 });
      if (String(url).includes('/activitylist-service/')) { const t = new URL(url).searchParams.get('activityType')!; return new Response(JSON.stringify(LIST[t] || [])); }
      if (String(url).includes('/activity-service/activity/')) return new Response(JSON.stringify({ activityId: 1, summaryDTO: { directWorkoutRpe: 60, directWorkoutFeel: 75, distance: 1 } }));
      if (String(url).includes('/download-service/')) return new Response(zipSync({ '90000000001_ACTIVITY.fit': FIT }));
      return new Response('', { status: 404 });
    }) as any,
  };
}
async function call(body: any, origin: string | null = ORIGIN) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }; if (origin) h.Origin = origin;
  const r = await handle(new Request('https://x.supabase.co/functions/v1/garmin', { method: 'POST', headers: h, body: JSON.stringify(body) }), deps());
  const ct = r.headers.get('Content-Type') || '';
  const out = ct.includes('json') ? await r.json() : new Uint8Array(await r.arrayBuffer());
  all.push(JSON.stringify(Object.fromEntries(r.headers)) + ' ' + (out instanceof Uint8Array ? Buffer.from(out).toString('latin1') : JSON.stringify(out)));
  return { status: r.status, body: out as any, headers: r.headers };
}
beforeEach(() => { rows = new Map(); calls = []; garmin = { mode: 'ok', tokenExp: NOW / 1000 + 86400 }; });

describe('conectar (critério 2)', () => {
  it('chave válida: grava cifrado e responde Conectado com a validade escolhida', async () => {
    const r = await call({ action: 'connect', syncId: SYNC, apiKey: KEY, since: '2026-06-01', validadeDias: 365 });
    expect(r.status).toBe(200); expect(r.body.ok).toBe(true);
    expect(r.body.keyExpiresAt).toBe(new Date(NOW + 365 * 86400000).toISOString());
    const row = rows.get(SYNC)!;
    expect(row.key_enc).not.toContain(KEY);
    expect(await decrypt(row.key_enc, ENC)).toBe(KEY);
    expect((await call({ action: 'status', syncId: SYNC })).body).toMatchObject({ conectado: true, status: 'ok', since: '2026-06-01' });
  });
  it('chave inválida: erro claro e nada gravado', async () => {
    const r = await call({ action: 'connect', syncId: SYNC, apiKey: 'outra-chave-qualquer-123456' });
    expect(r.status).toBe(400); expect(r.body.erro).toBe('chave_invalida'); expect(r.body.mensagem).toMatch(/não aceitou/);
    expect(rows.size).toBe(0);
  });
  it('token que vence antes de 23 h revela a data exata de vencimento da chave', async () => {
    garmin.tokenExp = NOW / 1000 + 5 * 3600;
    const r = await call({ action: 'connect', syncId: SYNC, apiKey: KEY, validadeDias: 365 });
    expect(r.body.keyExpiresAt).toBe(new Date(NOW + 5 * 3600000).toISOString());
  });
});

describe('listar e baixar', () => {
  it('lista corridas e pedais com id, início, tipo, duração e distância', async () => {
    await call({ action: 'connect', syncId: SYNC, apiKey: KEY, since: '2026-11-01' });
    const r = await call({ action: 'list', syncId: SYNC, force: true });
    expect(r.body.atividades.map((a: any) => [a.id, a.tipo])).toEqual([['90000000001', 'corrida'], ['90000000002', 'corrida'], ['90000000003', 'bike']]);
    expect(r.body.atividades[0]).toMatchObject({ inicio: '2026-11-10 09:10:00', duracaoS: 2700.5, distanciaM: 8012.4, subtipo: 'running' });
    const q = calls.find((c) => c.includes('activityType=running'))!;
    expect(q).toContain('startDate=2026-11-01'); expect(q).toContain('limit=100');
    expect(calls.filter((c) => c.includes('/token')).length).toBe(1); // reaproveita o token do connect
  });
  it('"O que trazer": sem pedais, a lista não pede cycling', async () => {
    await call({ action: 'connect', syncId: SYNC, apiKey: KEY });
    await call({ action: 'settings', syncId: SYNC, filtros: { corrida: true, bike: false } });
    const r = await call({ action: 'list', syncId: SYNC, force: true });
    expect(r.body.atividades.every((a: any) => a.tipo === 'corrida')).toBe(true);
    expect(calls.some((c) => c.includes('activityType=cycling'))).toBe(false);
  });
  it('baixa o ZIP e devolve só o .fit de dentro', async () => {
    await call({ action: 'connect', syncId: SYNC, apiKey: KEY });
    const r = await call({ action: 'fit', syncId: SYNC, activityId: '90000000001' });
    expect(r.status).toBe(200); expect(Array.from(r.body)).toEqual(Array.from(FIT));
  });
  it('nota do treino (RPE do relógio): só os campos de percepção', async () => {
    await call({ action: 'connect', syncId: SYNC, apiKey: KEY });
    const r = await call({ action: 'rpe', syncId: SYNC, activityIds: ['90000000001', 'x'] });
    expect(r.body.notas).toEqual([{ id: '90000000001', rpe: 60, feel: 75, esforco: null }]);
  });
  it('token vencido: pede outro com a chave guardada', async () => {
    await call({ action: 'connect', syncId: SYNC, apiKey: KEY });
    const row = rows.get(SYNC)!; row.token_expires_at = new Date(NOW + 10 * 60000).toISOString(); rows.set(SYNC, row);
    await call({ action: 'list', syncId: SYNC, force: true });
    expect(calls.filter((c) => c.includes('/token')).length).toBe(2);
  });
  it('duas listagens em menos de 1 min: a segunda não chama o Garmin', async () => {
    await call({ action: 'connect', syncId: SYNC, apiKey: KEY });
    await call({ action: 'list', syncId: SYNC }); const n = calls.length;
    expect((await call({ action: 'list', syncId: SYNC })).body.recente).toBe(true);
    expect(calls.length).toBe(n);
  });
});

describe('segurança (critérios 3 e 4)', () => {
  it('sync_id fora da lista: 403, sem chamar o Garmin', async () => {
    const r = await call({ action: 'connect', syncId: OUTRO, apiKey: KEY });
    expect(r.status).toBe(403); expect(r.body.erro).toBe('nao_autorizado'); expect(calls.length).toBe(0);
  });
  it('origem fora do CORS (ou sem origem): 403, sem cabeçalho CORS', async () => {
    for (const o of ['https://evil.example', null]) {
      const r = await call({ action: 'status', syncId: SYNC }, o);
      expect(r.status).toBe(403); expect(r.headers.get('Access-Control-Allow-Origin')).toBeNull();
    }
  });
  it('a chave nunca aparece em nenhuma resposta nem log, e o log não tem corpo', async () => {
    all.length = 0;
    await call({ action: 'connect', syncId: SYNC, apiKey: KEY, validadeDias: 90 });
    await call({ action: 'status', syncId: SYNC }); await call({ action: 'list', syncId: SYNC, force: true });
    await call({ action: 'fit', syncId: SYNC, activityId: '90000000001' });
    await call({ action: 'connect', syncId: SYNC, apiKey: KEY + 'errada' });
    garmin.mode = 'chave'; await call({ action: 'list', syncId: SYNC, force: true });
    expect(all.length).toBeGreaterThan(8);
    for (const s of all) { expect(s).not.toContain(KEY); expect(s).not.toContain('chave-sintetica'); }
    for (const s of all.filter((x) => x.startsWith('LOG'))) expect(Object.keys(JSON.parse(s.slice(4))).sort().join()).toMatch(/^(action,ms,sid,status|action,bytes,ms,sid,status)$/);
  });
  it('desconectar apaga chave e token', async () => {
    await call({ action: 'connect', syncId: SYNC, apiKey: KEY });
    await call({ action: 'disconnect', syncId: SYNC });
    expect(rows.size).toBe(0);
    expect((await call({ action: 'status', syncId: SYNC })).body.conectado).toBe(false);
  });
});

describe('avisos sem travar (critério 8)', () => {
  it('Garmin fora do ar: avisa e espera 1, 5, 15… min antes de tentar de novo', async () => {
    await call({ action: 'connect', syncId: SYNC, apiKey: KEY });
    garmin.mode = 'fora';
    const r = await call({ action: 'list', syncId: SYNC, force: true });
    expect(r.status).toBe(503); expect(r.body.erro).toBe('garmin_fora');
    expect(r.body.retryAt).toBe(new Date(NOW + 60000).toISOString());
    const n = calls.length;
    const r2 = await call({ action: 'list', syncId: SYNC, force: true });
    expect(r2.body.erro).toBe('garmin_fora'); expect(calls.length).toBe(n); // não insiste antes da hora
  });
  it('429 do Garmin vira "limite", com espera', async () => {
    await call({ action: 'connect', syncId: SYNC, apiKey: KEY });
    garmin.mode = 'limite';
    expect((await call({ action: 'list', syncId: SYNC, force: true })).body.erro).toBe('limite');
  });
  it('chave vencida (pela data) ou recusada pelo Garmin: aviso para renovar', async () => {
    await call({ action: 'connect', syncId: SYNC, apiKey: KEY, validadeDias: 30 });
    const row = rows.get(SYNC)!; row.key_expires_at = new Date(NOW - 1000).toISOString(); rows.set(SYNC, row);
    expect((await call({ action: 'list', syncId: SYNC, force: true })).body.erro).toBe('chave_vencida');
    expect((await call({ action: 'status', syncId: SYNC })).body.status).toBe('chave_vencida');
    rows.clear(); await call({ action: 'connect', syncId: SYNC, apiKey: KEY });
    const r = rows.get(SYNC)!; r.token_enc = null; rows.set(SYNC, r);
    garmin.mode = 'chave';
    expect((await call({ action: 'list', syncId: SYNC, force: true })).body.erro).toBe('chave_invalida');
  });
  it('lê o vencimento do token (JWT exp)', () => { expect(jwtExp(jwt(123))).toBe(123); expect(jwtExp('lixo')).toBeNull(); });
});
