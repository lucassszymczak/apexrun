// ============================================================================
// SINCRONIZAÇÃO ENTRE APARELHOS — lógica pura de mesclagem (merge)
// A página embute a mesma lógica; aqui ficam as funções testáveis, sem rede.
//
// Modelo: o estado { athlete, workouts, daily, deleted, updatedAt } é guardado
// como um único JSON por "código de sincronização" (hash → sync_id no Supabase).
// Cada treino/dia carrega `updatedAt`; deletar gera um tombstone em `deleted`.
// A mesclagem é comutativa e "o mais novo vence", com união por id/data — então
// importar num aparelho e no outro faz os dois convergirem para a união.
// ============================================================================

export function ts(x) {
  if (x == null) return 0;
  if (typeof x === "number") return x;
  const t = Date.parse(x);
  return isNaN(t) ? 0 : t;
}

// remove campos vazios (null/undefined/"") para não sobrescrever com branco
function stripEmpty(o) {
  const out = {};
  for (const k in o) if (o[k] != null && o[k] !== "") out[k] = o[k];
  return out;
}

export function mergeDeleted(a = [], b = []) {
  const m = new Map();
  for (const d of [...(a || []), ...(b || [])]) {
    if (!d || !d.id) continue;
    const p = m.get(d.id);
    if (!p || ts(d.at) > ts(p.at)) m.set(d.id, { id: d.id, at: d.at });
  }
  return [...m.values()];
}

// União por id; em conflito, vence o `updatedAt` mais novo. Depois aplica
// tombstones: um treino some se foi deletado DEPOIS da sua última edição.
export function mergeWorkouts(aw = [], bw = [], deleted = []) {
  const byId = new Map();
  for (const w of [...(aw || []), ...(bw || [])]) {
    if (!w || !w.id) continue;
    const prev = byId.get(w.id);
    if (!prev || ts(w.updatedAt) >= ts(prev.updatedAt)) byId.set(w.id, w);
  }
  const tomb = new Map();
  for (const d of deleted || []) tomb.set(d.id, ts(d.at));
  const out = [];
  for (const w of byId.values()) {
    const tAt = tomb.get(w.id);
    if (tAt != null && tAt >= ts(w.updatedAt)) continue; // deletado depois da última edição
    out.push(w);
  }
  return out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

// União por data; o mais novo vence, mas mescla campos preenchidos do outro.
export function mergeDaily(ad = [], bd = []) {
  const byDate = new Map();
  for (const r of [...(ad || []), ...(bd || [])]) {
    if (!r || !r.date) continue;
    const prev = byDate.get(r.date);
    if (!prev) { byDate.set(r.date, r); continue; }
    const newer = ts(r.updatedAt) >= ts(prev.updatedAt) ? r : prev;
    const older = newer === r ? prev : r;
    byDate.set(r.date, Object.assign({}, stripEmpty(older), stripEmpty(newer)));
  }
  return [...byDate.values()].sort((x, y) => (x.date < y.date ? -1 : 1));
}

export function mergeStates(a, b) {
  a = a || {}; b = b || {};
  const deleted = mergeDeleted(a.deleted, b.deleted);
  const workouts = mergeWorkouts(a.workouts, b.workouts, deleted);
  const daily = mergeDaily(a.daily, b.daily);
  const aAthlete = a.athlete || {}, bAthlete = b.athlete || {};
  const athlete = ts(aAthlete.updatedAt) >= ts(bAthlete.updatedAt)
    ? (a.athlete || b.athlete || {})
    : (b.athlete || a.athlete || {});
  const updatedAt = new Date(Math.max(ts(a.updatedAt), ts(b.updatedAt))).toISOString();
  return { athlete, workouts, daily, deleted, updatedAt };
}

// Código de sincronização legível e de alta entropia (~65 bits): apex-XXXX-XXXX-XXXX.
// Sem caracteres ambíguos (0/O/1/I/L). rng() opcional para teste determinístico.
export function newSyncCode(rng = Math.random) {
  const alpha = "23456789abcdefghjkmnpqrstuvwxyz"; // 31 símbolos
  const group = () => {
    let s = "";
    for (let i = 0; i < 4; i++) s += alpha[Math.floor(rng() * alpha.length)];
    return s;
  };
  return `apex-${group()}-${group()}-${group()}`;
}

export function normalizeSyncCode(raw) {
  return (raw || "").toString().trim().toLowerCase().replace(/\s+/g, "");
}
