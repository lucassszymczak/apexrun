// EQUIPAMENTOS (Fase 5 · item 5 aprovado em 21/11, docs/fase5-formulas.md). Módulo puro.
// - Tênis: km = km atuais (informados no cadastro) + a distância das corridas salvas com ele
//   depois do cadastro. Esteira conta. Aviso a partir de 90% do limite; no limite, card no Hoje.
// - Bike: pneus e corrente com os km dos pedais salvos com a bike desde a última troca. Sem limite
//   e sem aviso (decisão do Lucas). "Troquei" guarda a data.
// - Treinos sem distância somam 0. Treinos sem equipamento não contam. Nada de km é guardado:
//   tudo é somado na hora a partir dos treinos.
import { isBike } from './engine.mjs';
export const EQUIP_V = 1;
export const LIMITE_PADRAO = 600;
export const PCT_AVISO = 0.9;
export const PECAS = ['pneus', 'corrente'];

const km = (w) => (w && w.distKm > 0 ? +w.distKm : 0);
export const ativos = (lista, tipo) => (lista || []).filter((e) => e && e.tipo === tipo && !e.aposentado);

export function kmTenis(t, workouts) {
  let s = +t.kmInicial || 0, n = 0;
  for (const w of workouts || []) if (w && w.gearId === t.id && !isBike(w) && (!t.criadoEm || w.date >= t.criadoEm)) { s += km(w); n++; }
  return { km: s, corridas: n };
}
// data da última troca da peça (ou o cadastro da bike, sem troca)
export function desdeDe(bike, peca) {
  const p = bike.pecas && bike.pecas[peca]; const tr = (p && p.trocas) || [];
  return tr.length ? tr.slice().sort().slice(-1)[0] : bike.criadoEm || null;
}
// o dia da troca fica com a peça antiga (a troca costuma ser registrada depois do pedal do dia)
export function kmPeca(bike, peca, workouts) {
  const desde = desdeDe(bike, peca);
  const trocou = !!(bike.pecas && bike.pecas[peca] && (bike.pecas[peca].trocas || []).length);
  let s = 0, n = 0;
  for (const w of workouts || []) if (w && w.gearId === bike.id && isBike(w) && (!desde || (trocou ? w.date > desde : w.date >= desde))) { s += km(w); n++; }
  return { km: s, pedais: n, desde };
}
// estado em relação ao limite: null (sem limite), 'ok', 'atencao' (≥ 90%), 'limite' (≥ 100%)
export function estado(kmAtual, limite) {
  if (!(limite > 0)) return null;
  const p = kmAtual / limite;
  return p >= 1 ? 'limite' : p >= PCT_AVISO ? 'atencao' : 'ok';
}
// o equipamento que vem escolhido no Completar: com um ativo, ele; com mais, o último usado na
// modalidade (ou o cadastrado mais recente); sem nenhum, nada
export function padraoPara(modal, lista, workouts) {
  const tipo = modal === 'bike' ? 'bike' : 'tenis';
  const at = ativos(lista, tipo); if (!at.length) return null;
  if (at.length === 1) return at[0].id;
  const ids = new Set(at.map((e) => e.id));
  const usados = (workouts || []).filter((w) => w && w.gearId && ids.has(w.gearId) && (tipo === 'bike') === isBike(w)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (usados.length) return usados[0].gearId;
  return at.slice().sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')))[0].id;
}
// cards do Hoje: tênis ativos no limite ou acima
export function avisosHoje(lista, workouts) {
  return ativos(lista, 'tenis').map((t) => ({ t, ...kmTenis(t, workouts) })).filter((x) => estado(x.km, x.t.limiteKm) === 'limite');
}
// a linha do Completar: os km do tênis contando o treino que está sendo completado
export function comEsteTreino(t, workouts, distKm, wid = null) {
  const outros = (workouts || []).filter((w) => w.id !== wid);
  const k = kmTenis(t, outros).km + (distKm > 0 ? +distKm : 0);
  return { km: k, estado: estado(k, t.limiteKm) };
}
// cadastro e ações (devolvem uma lista nova; quem chama grava em athlete.equipamentos)
let seq = 0;
const novoId = (p) => p + Date.now().toString(36) + (seq++).toString(36);
export function novoTenis(lista, { nome, kmInicial = 0, limiteKm = LIMITE_PADRAO, hoje }) {
  return [...(lista || []), { id: novoId('t'), tipo: 'tenis', nome: String(nome).trim(), kmInicial: Math.max(0, +kmInicial || 0), limiteKm: limiteKm > 0 ? +limiteKm : null, criadoEm: hoje, v: EQUIP_V }];
}
export function novaBike(lista, { nome = 'Bike', hoje }) {
  return [...(lista || []), { id: novoId('b'), tipo: 'bike', nome: String(nome).trim() || 'Bike', criadoEm: hoje, pecas: { pneus: { trocas: [] }, corrente: { trocas: [] } }, v: EQUIP_V }];
}
export function editar(lista, id, campos) { return (lista || []).map((e) => (e.id === id ? { ...e, ...campos } : e)); }
export function aposentar(lista, id, hoje) { return editar(lista, id, { aposentado: true, aposentadoEm: hoje }); }
export function troquei(lista, bikeId, peca, hoje) {
  return (lista || []).map((e) => {
    if (e.id !== bikeId) return e;
    const pecas = { ...(e.pecas || {}) }; const p = pecas[peca] || { trocas: [] };
    pecas[peca] = { ...p, trocas: [...(p.trocas || []), hoje] };
    return { ...e, pecas };
  });
}
