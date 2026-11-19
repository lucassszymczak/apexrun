// ============================================================================
// Ambiente determinístico do golden master: fuso e "hoje" fixos.
// Importe ANTES de qualquer outro módulo que use datas.
//   - Fuso: America/Sao_Paulo (o do Lucas; a página usa datas locais).
//   - Hoje: GOLDEN_NOW (fitnessSeries, A:C, semana do plano, dias até a prova
//     dependem de "hoje"; congelar torna os números comparáveis).
// ============================================================================
export const GOLDEN_TZ = 'America/Sao_Paulo';
export const GOLDEN_NOW = '2026-11-19T12:00:00-03:00';

process.env.TZ = GOLDEN_TZ;

const RealDate = Date;
let restore = null;

// Substitui o Date global por um que devolve GOLDEN_NOW em `new Date()` e `Date.now()`.
// Datas explícitas (`new Date(iso)`) seguem normais. `instanceof Date` continua valendo
// para objetos criados por qualquer uma das duas classes.
export function freezeDate(iso = GOLDEN_NOW) {
  if (restore) return restore;
  const T = RealDate.parse(iso);
  class FrozenDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(T);
      else super(...args);
    }
    static now() { return T; }
    static [Symbol.hasInstance](x) { return x instanceof RealDate; }
  }
  FrozenDate.parse = RealDate.parse;
  FrozenDate.UTC = RealDate.UTC;
  globalThis.Date = FrozenDate;
  restore = () => { globalThis.Date = RealDate; restore = null; };
  return restore;
}

// RNG determinístico (mulberry32) — para dados sintéticos reprodutíveis.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Comparação profunda exata (NaN == NaN, -0 == 0 como no JSON). Devolve as diferenças.
// opts.ulp > 0 aceita números que diferem só nas últimas casas binárias (≤ ulp ULPs) —
// usado SÓ entre motores JS diferentes (Node × Chromium × Safari), onde Math.pow/exp/log
// podem divergir em 1 ULP com o mesmo código. Cada aceitação é registrada em opts.hits.
export function deepDiff(a, b, path = '$', out = [], max = 40, opts = null) {
  if (out.length >= max) return out;
  if (Object.is(a, b) || (a === b)) return out;
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return out;
    if (opts && opts.ulp > 0 && Math.abs(a - b) <= opts.ulp * Number.EPSILON * Math.max(Math.abs(a), Math.abs(b))) {
      if (opts.hits) opts.hits.push(path + ': ' + a + ' ~ ' + b);
      return out;
    }
    out.push(path + ': ' + a + ' ≠ ' + b);
    return out;
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    out.push(path + ': ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b));
    return out;
  }
  if (Array.isArray(a) !== Array.isArray(b)) { out.push(path + ': array × objeto'); return out; }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (a[k] === undefined && b[k] === undefined) continue;
    deepDiff(a[k], b[k], path + (Array.isArray(a) ? '[' + k + ']' : '.' + k), out, max, opts);
  }
  return out;
}
