// RESUMO PÓS-TREINO (Fase 5 · itens 3 e 4 aprovados em 21/11, docs/fase5-formulas.md). Módulo puro.
// "O que mudou", nesta ordem e só o que mudou com este treino:
//   1. recorde pessoal ou melhor do ciclo (selos da Fase 2), numa linha só;
//   2. lugar no top 3 de um segmento (passagens até a data do treino, com 3 ou mais), até 2 linhas;
//   3. semana que ficou consistente com este treino (regra da Fase 3);
//   4. forma (TSB do motor) que entrou ou saiu de "muito carregado" ou de "fresco";
//   5. equipamento do treino (km do tênis; pneus e corrente na bike).
// Título: o primeiro que existir — recorde, seu melhor num segmento, melhor do ciclo, semana
// consistente, forma, a frase do check da história, "<Tipo> de X km registrado".
// Importa do motor e dos módulos das fases anteriores; não copia nem muda fórmulas.
import * as E from './engine.mjs';
import { selos, ROTULO, DISTANCIAS } from './efforts.mjs';
import { semanas, sequencias, PCT_META } from './consistencia.mjs';
import { ranking } from './segmentos.mjs';
import { kmTenis, kmPeca, estado, PECAS } from './equipamentos.mjs';

export const RESUMO_V = 1;
const lista = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]);
const hTxt = (h) => { const m = Math.round(h * 60); return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); };
const kmTxt = (k) => Math.round(k).toLocaleString('pt-BR');
const ord = (n) => n + 'º';
const extremo = (s) => s === 'muito carregado' || /^fresco/.test(s || '');

export function oQueMudou({ w, workouts, athlete = {}, race = null, segmentos = [], metaH = null }) {
  const itens = [];
  const todos = workouts || [];
  // 1. recordes e melhores do ciclo
  const s = selos(w, todos, race && race.startDate ? race.startDate : null);
  const ord_ = (ks) => ks.map(Number).sort((a, b) => a - b).map((k) => DISTANCIAS.find((d) => d === k) ?? k);
  const prs = ord_(Object.keys(s).filter((k) => s[k] === 'pr')), cis = ord_(Object.keys(s).filter((k) => s[k] === 'ciclo'));
  if (prs.length) itens.push({ tipo: 'recorde', texto: prs.length === 1 ? 'Recorde pessoal nos ' + ROTULO[prs[0]] : 'Recorde pessoal em ' + prs.length + ' distâncias: ' + lista(prs.map((k) => ROTULO[k])), maior: ROTULO[prs[prs.length - 1]] });
  else if (cis.length) itens.push({ tipo: 'ciclo', texto: cis.length === 1 ? 'Melhor do ciclo nos ' + ROTULO[cis[0]] : 'Melhor do ciclo em ' + cis.length + ' distâncias: ' + lista(cis.map((k) => ROTULO[k])), maior: ROTULO[cis[cis.length - 1]] });
  // 2. segmentos: top 3, até 2 linhas
  const minhas = (w.leitura && w.leitura.segmentos) || [];
  const seg = [];
  for (const p of minhas) {
    const cat = segmentos.find((x) => x.id === p.id); if (!cat) continue;
    const corrida = cat.modal !== 'pedal';
    const ps = [];
    for (const o of todos) { if (!o || o.date > w.date) continue; for (const q of (o.leitura && o.leitura.segmentos) || []) if (q.id === p.id) ps.push({ ...q, date: o.date, wid: o.id }); }
    if (ps.length < 3) continue;
    const pos = ranking(ps, corrida).findIndex((q) => q.wid === w.id) + 1;
    if (pos >= 1 && pos <= 3) seg.push({ pos, n: ps.length, nome: cat.nome, id: cat.id });
  }
  seg.sort((a, b) => a.pos - b.pos || b.n - a.n).slice(0, 2).forEach((x) => itens.push({ tipo: x.pos === 1 ? 'seg-melhor' : 'seg', texto: x.pos === 1 ? 'Seu melhor no ' + x.nome : ord(x.pos) + ' de ' + x.n + ' no ' + x.nome, segId: x.id, nome: x.nome }));
  // 3. semana consistente com este treino
  const antes = semanas(todos.filter((o) => o.id !== w.id), { hoje: w.date, n: 2, metaH })[1];
  const depois = semanas(todos, { hoje: w.date, n: 2, metaH });
  const sem = depois[1];
  if (antes && sem && antes.pct < PCT_META && sem.pct >= PCT_META && sem.descansos >= 1) {
    const ant = semanas(todos, { hoje: w.date, n: 60, metaH }); const seq = sequencias(ant).atual;
    itens.push({ tipo: 'semana', texto: 'Semana consistente: ' + hTxt(sem.horas) + ' de ' + hTxt(sem.meta) + ' de meta' + (seq >= 1 ? ' · ' + (seq + 1) + ' seguidas se fechar assim' : ''), seguidas: seq + 1 });
  }
  // 4. forma: só ao entrar ou sair dos extremos
  try {
    const fit = E.fitnessSeries(todos, athlete) || [];
    const i = fit.findIndex((f) => f.date === w.date);
    if (i > 0) {
      const a = E.tsbState(fit[i - 1].tsb), b = E.tsbState(fit[i].tsb);
      if (a !== b && (extremo(a) || extremo(b))) itens.push({ tipo: 'forma', texto: 'Forma: de ' + a.replace(/ \(.*\)$/, '') + ' para ' + b.replace(/ \(.*\)$/, ''), para: b });
    }
  } catch { /* sem série de forma */ }
  // 5. equipamento
  const eq = w.gearId ? ((athlete && athlete.equipamentos) || []).find((e) => e.id === w.gearId) : null;
  if (eq && eq.tipo === 'tenis') {
    const k = kmTenis(eq, todos).km, est = estado(k, eq.limiteKm);
    itens.push({ tipo: 'equip', texto: eq.nome + ': ' + kmTxt(k) + (eq.limiteKm ? ' de ' + kmTxt(eq.limiteKm) + ' km' : ' km'), tom: est === 'atencao' || est === 'limite' ? 'atencao' : null });
  } else if (eq && eq.tipo === 'bike') {
    itens.push({ tipo: 'equip', texto: eq.nome + ': ' + PECAS.map((p) => (p === 'pneus' ? 'pneus ' : 'corrente ') + kmTxt(kmPeca(eq, p, todos).km) + ' km').join(' · ') + ' desde a troca', tom: null });
  }
  return itens;
}

export function titulo(itens, { tipoNome, distKm, historiaOk = null }) {
  const T = tipoNome || 'Treino';
  const by = (t) => itens.find((x) => x.tipo === t);
  const pr = by('recorde'); if (pr) return T + ' com recorde pessoal nos ' + pr.maior;
  const sm = by('seg-melhor'); if (sm) return T + ' com o seu melhor no ' + sm.nome;
  const ci = by('ciclo'); if (ci) return T + ' com o melhor do ciclo nos ' + ci.maior;
  const se = by('semana'); if (se) return T + ' que fechou a semana consistente' + (se.seguidas >= 2 ? ' · ' + se.seguidas + ' seguidas' : '');
  const fo = by('forma'); if (fo) return T + (/^fresco/.test(fo.para) ? ' que te deixou fresco para testar' : fo.para === 'muito carregado' ? ' que te deixou muito carregado' : ' que tirou você do extremo da forma');
  if (historiaOk) return historiaOk.replace(/\.$/, '');
  return T + (distKm > 0 ? ' de ' + String(Math.round(distKm * 100) / 100).replace('.', ',') + ' km' : '') + ' registrado';
}
