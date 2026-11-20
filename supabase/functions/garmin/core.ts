// Função "garmin" (Fase 2) — lógica pura, sem nada do Deno: o index.ts injeta banco,
// fetch, descompactador e segredos. Assim os testes (tests/garmin-fn.test.ts) rodam a
// mesma lógica com um Garmin simulado.
//
// Regras (CLAUDE.md · Garmin):
// - a chave chega uma vez (connect), é validada trocando por um token e guardada
//   cifrada (AES-GCM). Nunca volta em resposta e nunca vai para log;
// - só atende os sync_id da lista GARMIN_ALLOWED_SYNC_IDS e as origens permitidas;
// - endpoints da documentação oficial (docs/fase2-etapa0.md).

export const GARMIN_BASE = 'https://personal.connectapi.garmin.com';
export const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';
export const LIST_PATH = '/activitylist-service/activities/search/activities';
export const FILE_PATH = '/download-service/files/activity/';
export const DETAIL_PATH = '/activity-service/activity/';
export const TIMEOUT_MS = 20000;
export const MIN_LIST_GAP_S = 60;          // proteção do servidor (o app já espaça 15 min)
export const BACKOFF_MIN = [1, 5, 15, 60]; // espera depois de erro do Garmin (minutos)

export type Row = {
  sync_id: string; key_enc: string; key_expires_at: string | null;
  token_enc: string | null; token_expires_at: string | null;
  filtros: { corrida: boolean; bike: boolean }; since: string | null;
  last_list_at: string | null; status: string; retry_at: string | null; updated_at?: string;
  fails?: number;
};
export type Db = {
  get(syncId: string): Promise<Row | null>;
  upsert(row: Row): Promise<void>;
  remove(syncId: string): Promise<void>;
};
export type Deps = {
  encKeyB64: string;            // GARMIN_ENC_KEY (32 bytes, base64)
  allowed: string[];            // GARMIN_ALLOWED_SYNC_IDS
  origins: string[];            // origens aceitas no CORS
  db: Db;
  fetch: typeof fetch;          // fetch para o Garmin
  unzip: (zip: Uint8Array) => Uint8Array | null; // devolve o 1º .fit do ZIP
  now?: () => number;
  log?: (o: Record<string, unknown>) => void;
};

// ---------------- cifra (AES-GCM do WebCrypto) ----------------
const b64 = (u: Uint8Array) => { let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function aesKey(b: string) {
  const raw = unb64(b);
  if (raw.length !== 32) throw new Error('GARMIN_ENC_KEY precisa ter 32 bytes');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encrypt(plain: string, keyB64: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyB64), new TextEncoder().encode(plain)));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return b64(out);
}
export async function decrypt(enc: string, keyB64: string): Promise<string> {
  const u = unb64(enc);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, await aesKey(keyB64), u.slice(12));
  return new TextDecoder().decode(pt);
}
// vencimento do token (campo exp do JWT), sem verificar assinatura — só para saber quando pedir outro
export function jwtExp(tok: string): number | null {
  try {
    const p = tok.split('.')[1]; if (!p) return null;
    const j = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((p.length + 3) % 4)));
    return typeof j.exp === 'number' ? j.exp : null;
  } catch { return null; }
}

// ---------------- respostas ----------------
type Ctx = { origin: string | null; deps: Deps; t0: number; action: string; sid: string };
function cors(origin: string | null): Record<string, string> {
  return origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' } : {};
}
function json(ctx: Ctx, status: number, body: unknown): Response {
  ctx.deps.log?.({ action: ctx.action, sid: ctx.sid, status, ms: Date.now() - ctx.t0 });
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(ctx.origin) } });
}
const erro = (ctx: Ctx, status: number, codigo: string, mensagem: string, extra: Record<string, unknown> = {}) => json(ctx, status, { erro: codigo, mensagem, ...extra });

class GarminErr extends Error { constructor(public kind: 'chave' | 'limite' | 'fora', public status: number) { super(kind); } }
async function gfetch(deps: Deps, path: string, init: RequestInit): Promise<Response> {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), TIMEOUT_MS - 2000);
  let r: Response;
  try { r = await deps.fetch(GARMIN_BASE + path, { ...init, signal: ctl.signal }); }
  catch { throw new GarminErr('fora', 0); }
  finally { clearTimeout(tm); }
  if (r.status === 401 || r.status === 403) throw new GarminErr('chave', r.status);
  if (r.status === 429) throw new GarminErr('limite', 429);
  if (!r.ok) throw new GarminErr('fora', r.status);
  return r;
}
async function newToken(deps: Deps, apiKey: string): Promise<{ token: string; exp: number | null }> {
  const r = await gfetch(deps, TOKEN_PATH, { method: 'POST', headers: { Authorization: 'ApiKey ' + apiKey, Accept: '*/*' } });
  const token = (await r.text()).trim();
  if (!token) throw new GarminErr('fora', 502);
  return { token, exp: jwtExp(token) };
}

const iso = (ms: number) => new Date(ms).toISOString();
const SYNC_RE = /^[0-9a-f]{64}$/;
const DIAS = [30, 90, 180, 365];

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const now = deps.now || Date.now;
  const origin = req.headers.get('Origin');
  const ok = !!origin && deps.origins.includes(origin);
  const ctx: Ctx = { origin: ok ? origin : null, deps, t0: Date.now(), action: '-', sid: '-' };
  if (!ok) return erro(ctx, 403, 'origem', 'Origem não permitida.');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== 'POST') return erro(ctx, 405, 'entrada_invalida', 'Use POST.');
  let body: any;
  try { body = await req.json(); } catch { return erro(ctx, 400, 'entrada_invalida', 'Corpo inválido.'); }
  const syncId = String(body && body.syncId || '');
  ctx.action = String(body && body.action || '-').slice(0, 16); ctx.sid = syncId.slice(0, 8);
  if (!SYNC_RE.test(syncId) || !deps.allowed.includes(syncId)) return erro(ctx, 403, 'nao_autorizado', 'Este código de sincronização não pode usar o Garmin.');

  try {
    switch (ctx.action) {
      case 'connect': {
        const apiKey = String(body.apiKey || '').trim();
        if (apiKey.length < 16 || apiKey.length > 4096) return erro(ctx, 400, 'entrada_invalida', 'Cole a chave inteira, como o Garmin mostrou.');
        const dias = DIAS.includes(+body.validadeDias) ? +body.validadeDias : 365;
        let tk;
        try { tk = await newToken(deps, apiKey); }
        catch (e) {
          if (e instanceof GarminErr && e.kind === 'chave') return erro(ctx, 400, 'chave_invalida', 'O Garmin não aceitou esta chave. Confira se copiou inteira e se ela não foi apagada.');
          throw e;
        }
        let keyExp = now() + dias * 86400000;
        if (tk.exp && tk.exp * 1000 < now() + 23 * 3600000) keyExp = tk.exp * 1000; // token curto = chave nas últimas horas
        const row: Row = {
          sync_id: syncId, key_enc: await encrypt(apiKey, deps.encKeyB64), key_expires_at: iso(keyExp),
          token_enc: await encrypt(tk.token, deps.encKeyB64), token_expires_at: tk.exp ? iso(tk.exp * 1000) : iso(now() + 23 * 3600000),
          filtros: { corrida: true, bike: true }, since: validDate(body.since), last_list_at: null, status: 'ok', retry_at: null, fails: 0,
        };
        await deps.db.upsert(row);
        return json(ctx, 200, { ok: true, keyExpiresAt: row.key_expires_at });
      }
      case 'status': {
        const row = await deps.db.get(syncId);
        if (!row) return json(ctx, 200, { conectado: false });
        const st = row.key_expires_at && Date.parse(row.key_expires_at) < now() ? 'chave_vencida' : row.status;
        return json(ctx, 200, { conectado: true, keyExpiresAt: row.key_expires_at, status: st, since: row.since, filtros: row.filtros, lastListAt: row.last_list_at, retryAt: row.retry_at });
      }
      case 'settings': {
        const row = await deps.db.get(syncId);
        if (!row) return erro(ctx, 404, 'nao_conectado', 'O Garmin não está conectado.');
        if (body.filtros) row.filtros = { corrida: !!body.filtros.corrida, bike: !!body.filtros.bike };
        if (body.since !== undefined) row.since = validDate(body.since);
        await deps.db.upsert(row);
        return json(ctx, 200, { ok: true });
      }
      case 'disconnect': {
        await deps.db.remove(syncId);
        return json(ctx, 200, { ok: true });
      }
      case 'list':
      case 'rpe':
      case 'fit': {
        const row = await deps.db.get(syncId);
        if (!row) return erro(ctx, 404, 'nao_conectado', 'O Garmin não está conectado.');
        if (row.key_expires_at && Date.parse(row.key_expires_at) < now()) return erro(ctx, 409, 'chave_vencida', 'A chave do Garmin venceu. Gere outra e troque em Configurações.');
        if (row.retry_at && Date.parse(row.retry_at) > now()) return erro(ctx, 503, row.status === 'limite' ? 'limite' : 'garmin_fora', 'O Garmin não respondeu há pouco. O app tenta de novo mais tarde.', { retryAt: row.retry_at });
        if (ctx.action === 'list' && !body.force && row.last_list_at && now() - Date.parse(row.last_list_at) < MIN_LIST_GAP_S * 1000) return json(ctx, 200, { atividades: [], recente: true });
        try {
          const token = await tokenFor(row, deps, now);
          const r = ctx.action === 'list' ? await doList(row, body, token, deps, now, ctx) : ctx.action === 'rpe' ? await doRpe(body, token, deps, ctx) : await doFit(body, token, deps, ctx);
          if (row.status !== 'ok' || row.fails) { row.status = 'ok'; row.fails = 0; row.retry_at = null; }
          if (ctx.action === 'list') row.last_list_at = iso(now());
          await deps.db.upsert(row);
          return r;
        } catch (e) {
          if (!(e instanceof GarminErr)) throw e;
          if (e.kind === 'chave') { row.status = 'chave_invalida'; row.token_enc = null; await deps.db.upsert(row); return erro(ctx, 409, 'chave_invalida', 'O Garmin recusou a chave (apagada ou vencida). Gere outra e troque em Configurações.'); }
          const fails = (row.fails || 0) + 1;
          row.fails = fails; row.status = e.kind === 'limite' ? 'limite' : 'garmin_fora';
          row.retry_at = iso(now() + BACKOFF_MIN[Math.min(fails, BACKOFF_MIN.length) - 1] * 60000);
          await deps.db.upsert(row);
          return erro(ctx, 503, row.status, e.kind === 'limite' ? 'O Garmin pediu para esperar um pouco.' : 'O Garmin está fora do ar agora.', { retryAt: row.retry_at });
        }
      }
      default: return erro(ctx, 400, 'entrada_invalida', 'Ação desconhecida.');
    }
  } catch {
    return erro(ctx, 500, 'interno', 'Erro interno na função. Tente de novo.');
  }
}

function validDate(s: any): string | null { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }

async function tokenFor(row: Row, deps: Deps, now: () => number): Promise<string> {
  if (row.token_enc && row.token_expires_at && Date.parse(row.token_expires_at) - now() > 3600000) return decrypt(row.token_enc, deps.encKeyB64);
  const tk = await newToken(deps, await decrypt(row.key_enc, deps.encKeyB64));
  row.token_enc = await encrypt(tk.token, deps.encKeyB64);
  row.token_expires_at = tk.exp ? iso(tk.exp * 1000) : iso(now() + 23 * 3600000);
  if (tk.exp && tk.exp * 1000 < now() + 23 * 3600000) row.key_expires_at = iso(tk.exp * 1000);
  return tk.token;
}

// Lista corridas e pedais desde a data pedida, em páginas de 100 (até 10 páginas por tipo).
async function doList(row: Row, body: any, token: string, deps: Deps, now: () => number, ctx: Ctx) {
  const since = validDate(body.since) || row.since || new Date(now() - 30 * 86400000).toISOString().slice(0, 10);
  const until = new Date(now() + 86400000).toISOString().slice(0, 10);
  const tipos = [row.filtros.corrida !== false ? 'running' : null, row.filtros.bike !== false ? 'cycling' : null].filter(Boolean) as string[];
  const out: any[] = [];
  let mais = false;
  for (const tipo of tipos) {
    for (let page = 0; page < 10; page++) {
      const q = new URLSearchParams({ start: String(page * 100), limit: '100', startDate: since, endDate: until, activityType: tipo, sortOrder: 'asc' });
      const r = await gfetch(deps, LIST_PATH + '?' + q, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
      const arr = await r.json();
      if (!Array.isArray(arr)) break;
      for (const a of arr) out.push({
        id: String(a.activityId), nome: a.activityName || null, inicio: a.startTimeGMT || null, inicioLocal: a.startTimeLocal || null,
        tipo: tipo === 'running' ? 'corrida' : 'bike', subtipo: a.activityType && a.activityType.typeKey || null,
        duracaoS: a.duration ?? null, distanciaM: a.distance ?? null, fcMedia: a.averageHR ?? null,
      });
      if (arr.length < 100) break;
      if (page === 9) mais = true;
    }
  }
  return json(ctx, 200, { atividades: out, mais });
}

async function doFit(body: any, token: string, deps: Deps, ctx: Ctx) {
  const id = String(body.activityId || '');
  if (!/^\d{1,20}$/.test(id)) return erro(ctx, 400, 'entrada_invalida', 'Atividade inválida.');
  const r = await gfetch(deps, FILE_PATH + id, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/zip, application/x-zip-compressed, application/octet-stream' } });
  const zip = new Uint8Array(await r.arrayBuffer());
  const fit = zip[0] === 0x50 && zip[1] === 0x4b ? deps.unzip(zip) : zip; // ZIP ("PK") ou o .fit direto
  if (!fit || fit.length < 12) return erro(ctx, 502, 'garmin_fora', 'O arquivo do Garmin veio vazio.');
  ctx.deps.log?.({ action: ctx.action, sid: ctx.sid, status: 200, ms: Date.now() - ctx.t0, bytes: fit.length });
  return new Response(fit, { status: 200, headers: { 'Content-Type': 'application/octet-stream', ...cors(ctx.origin) } });
}


// Nota do treino que você dá no relógio/Garmin Connect: só os 3 campos de percepção do
// resumo da atividade (SummaryDTO: directWorkoutRpe, directWorkoutFeel, perceivedWorkoutEffort).
async function doRpe(body: any, token: string, deps: Deps, ctx: Ctx) {
  const ids: string[] = (Array.isArray(body.activityIds) ? body.activityIds : []).map(String).filter((x: string) => /^\d{1,20}$/.test(x)).slice(0, 10);
  if (!ids.length) return erro(ctx, 400, 'entrada_invalida', 'Informe as atividades.');
  const out: any[] = [];
  for (const [k, id] of ids.entries()) {
    if (k) await new Promise((res) => setTimeout(res, 400)); // sem rajada: o Garmin limita chamadas seguidas
    const r = await gfetch(deps, DETAIL_PATH + id, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } });
    const j = await r.json(); const sm = (j && j.summaryDTO) || {};
    out.push({ id, rpe: sm.directWorkoutRpe ?? null, feel: sm.directWorkoutFeel ?? null, esforco: sm.perceivedWorkoutEffort ?? null });
  }
  return json(ctx, 200, { notas: out });
}
