// CONSISTÊNCIA POR SEMANAS (Fase 3 · item 6 aprovado em 21/11, docs/fase3-formulas.md).
// Módulo puro. Semana de segunda a domingo no horário de Brasília (as datas dos treinos já são
// locais, "AAAA-MM-DD"). Consistente = pelo menos 80% das horas da meta e pelo menos 1 dia de
// descanso. Meta: a do Lucas, se preenchida; senão, a média das 4 semanas anteriores com treino,
// arredondada a 0,5 h, com mínimo de 1 h. A semana em andamento não quebra a sequência.
export const CONSIST_V = 1;
export const PCT_META = 0.8;
export const DESCANSOS_MIN = 1;
export const SEMANAS_META = 4;
export const META_MIN_H = 1;
export const FUSO = 'America/Sao_Paulo';

const pad = (n) => String(n).padStart(2, '0');
const isoUTC = (d) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
export function addDias(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return isoUTC(d); }
export function segundaDe(iso) { const d = new Date(iso + 'T12:00:00Z'); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return isoUTC(d); }
// "hoje" no fuso do Lucas
export function hojeEm(agora = new Date(), fuso = FUSO) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
  return p; // en-CA dá AAAA-MM-DD
}
// o que conta como treino: corrida, pedal e força (quando houver registro de força)
export function tipoDoTreino(w) {
  if (!w) return null;
  if (w.modal === 'forca' || w.type === 'forca') return 'forca';
  if (w.modal === 'bike' || w.type === 'bike' || w.type === 'bike_int') return 'pedal';
  return 'corrida';
}
const arred05 = (h) => Math.round(h * 2) / 2;

// semanas: da mais antiga à atual (n semanas, a última é a em andamento)
export function semanas(workouts, { hoje, n = 26, metaH = null } = {}) {
  const atual = segundaDe(hoje);
  const porSemana = new Map();
  for (const w of workouts || []) {
    if (!w || !w.date) continue;
    const t = tipoDoTreino(w); if (!t) continue;
    const k = segundaDe(w.date);
    let s = porSemana.get(k); if (!s) { s = { horas: 0, dias: new Map() }; porSemana.set(k, s); }
    s.horas += (w.durationSec || 0) / 3600;
    const d = s.dias.get(w.date) || new Set(); d.add(t); s.dias.set(w.date, d);
  }
  const horasDe = (k) => (porSemana.has(k) ? porSemana.get(k).horas : 0);
  // meta padrão móvel: média das 4 semanas anteriores com treino (olhando até 52 semanas para trás)
  const metaPara = (k) => {
    if (metaH > 0) return { h: metaH, origem: 'sua' };
    const prev = []; for (let i = 1; i <= 52 && prev.length < SEMANAS_META; i++) { const h = horasDe(addDias(k, -7 * i)); if (h > 0) prev.push(h); }
    const media = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
    return { h: Math.max(META_MIN_H, arred05(media)), origem: 'padrao' };
  };
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = addDias(atual, -7 * i);
    const s = porSemana.get(k);
    const dias = Array.from({ length: 7 }, (_, j) => { const iso = addDias(k, j); const ts = s && s.dias.get(iso); return { iso, tipos: ts ? [...ts] : [], descanso: !ts, futuro: iso > hoje }; });
    const horas = s ? s.horas : 0;
    const meta = metaPara(k);
    const descansos = dias.filter((d) => d.descanso && !d.futuro).length;
    const pct = meta.h ? horas / meta.h : 0;
    let estado;
    if (k === atual) estado = 'andamento';
    else if (pct >= PCT_META && descansos >= DESCANSOS_MIN) estado = 'consistente';
    else if (horas > 0) estado = 'parcial';
    else estado = 'sem';
    out.push({ seg: k, dom: addDias(k, 6), horas, meta: meta.h, metaOrigem: meta.origem, pct, descansos, dias, estado });
  }
  return out;
}
// sequência: semanas consistentes seguidas até a última encerrada (a em andamento não quebra)
export function sequencias(lista) {
  const fechadas = lista.filter((s) => s.estado !== 'andamento');
  let atual = 0; for (let i = fechadas.length - 1; i >= 0 && fechadas[i].estado === 'consistente'; i--) atual++;
  let maior = 0, run = 0; for (const s of fechadas) { run = s.estado === 'consistente' ? run + 1 : 0; maior = Math.max(maior, run); }
  return { atual, maior };
}
export function resumo(lista, ultimas = 12) {
  const fechadas = lista.filter((s) => s.estado !== 'andamento').slice(-ultimas);
  const n = fechadas.filter((s) => s.estado === 'consistente').length;
  return { consistentes: n, de: fechadas.length, ...sequencias(lista) };
}
