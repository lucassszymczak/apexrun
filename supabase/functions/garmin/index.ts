// Edge Function "garmin" (Supabase, Deno). Só liga as peças: segredos, banco (tabela
// analise_garmin pela API REST com a service role), fetch e o descompactador do ZIP.
// A lógica fica em core.ts (testada em tests/garmin-fn.test.ts).
// Publicada com verify_jwt = false: a proteção é a lista de sync_id + a origem (CORS).
import { unzipSync } from 'npm:fflate@0.8.2';
import { handle, type Db, type Row } from './core.ts';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H = { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json' };
const T = URL_ + '/rest/v1/analise_garmin';

const db: Db = {
  async get(id) {
    const r = await fetch(T + '?sync_id=eq.' + encodeURIComponent(id) + '&select=*', { headers: H });
    if (!r.ok) throw new Error('db ' + r.status);
    const a = await r.json();
    return (a[0] as Row) || null;
  },
  async upsert(row) {
    const r = await fetch(T + '?on_conflict=sync_id', { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }) });
    if (!r.ok) throw new Error('db ' + r.status);
  },
  async remove(id) {
    const r = await fetch(T + '?sync_id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: H });
    if (!r.ok) throw new Error('db ' + r.status);
  },
};

function unzip(zip: Uint8Array): Uint8Array | null {
  const files = unzipSync(zip);
  const name = Object.keys(files).find((n) => /\.fit$/i.test(n)) || Object.keys(files)[0];
  return name ? files[name] : null;
}

const allowed = (Deno.env.get('GARMIN_ALLOWED_SYNC_IDS') || '').split(/[\s,]+/).filter(Boolean);
const origins = ['https://lucassszymczak.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173'];

Deno.serve((req) => handle(req, {
  encKeyB64: Deno.env.get('GARMIN_ENC_KEY') || '',
  allowed, origins, db, unzip,
  fetch: (u, i) => fetch(u, i),
  // log mínimo: ação, 8 primeiros caracteres do sync_id, status e tempo. Nunca corpo nem cabeçalho.
  log: (o) => console.log(JSON.stringify(o)),
}));
