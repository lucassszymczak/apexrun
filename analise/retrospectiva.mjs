// RETROSPECTIVA DO CICLO (Fase 5 · item 6 aprovado em 21/11, docs/fase5-formulas.md). Módulo puro.
// Blocos, nesta ordem (sem dado, o bloco não existe):
//   capa · volume · consistência · recordes e longão · a prova (plano × real) · segmentos · tênis
// Ciclo: do início do ciclo à data da prova; a versão "até agora" usa hoje como fim.
// Reaproveita por importação: consistência e segmentos (Fase 3), selos de esforço (Fase 2),
// passagens do plano (Fase 4) e equipamentos (Fase 5). Nada é gravado.
import * as E from './engine.mjs';
import { selos, ROTULO, DISTANCIAS } from './efforts.mjs';
import { semanas, segundaDe, addDias } from './consistencia.mjs';
import { tendencia } from './segmentos.mjs';
import { kmTenis, estado as estadoEquip } from './equipamentos.mjs';

export const RETRO_V = 1;
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const ddmmm = (iso) => +iso.slice(8) + ' ' + MES[+iso.slice(5, 7) - 1];
export const hms = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0') : m + ':' + String(x).padStart(2, '0'); };
export const hCurto = (s) => { const m = Math.round(s / 60); return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); };
const kmTxt = (k) => (k >= 100 ? String(Math.round(k)) : String(Math.round(k * 10) / 10).replace('.', ','));
const dias = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);

// tempo no km X pelos splits do treino (acumulado, com interpolação no km)
export function tempoNoKm(w, km) {
  const sp = (w && w.splits) || []; let d = 0, t = 0;
  for (const s of sp) {
    const dk = s.distKm || 1, ts = s.timeSec || 0;
    if (d + dk >= km - 1e-9) return t + ts * ((km - d) / dk);
    d += dk; t += ts;
  }
  return km <= d + 1e-6 ? t : (w && w.distKm && Math.abs(km - w.distKm) < 0.3 ? w.durationSec : null);
}
export function provaDoCiclo(race, workouts) {
  if (!race || !race.date) return null;
  return (workouts || []).filter((w) => w && !E.isBike(w) && w.type === 'prova' && Math.abs(dias(race.date, w.date)) <= 1)
    .sort((a, b) => (b.distKm || 0) - (a.distKm || 0))[0] || null;
}

// planoPassagens (opcional): [{ rotulo, km, tS }] do plano da Fase 4, quando há tempo-alvo
// realNoKm (opcional): tempo no km X lido do trajeto da prova (1 Hz); sem trajeto, usa os splits
export function retrospectiva({ workouts, athlete = {}, race, hoje, segmentos = [], planoPassagens = null, metaH = null, realNoKm = null }) {
  if (!race || !race.startDate) return null;
  const ini = String(race.startDate).slice(0, 10), dataProva = race.date ? String(race.date).slice(0, 10) : null;
  const terminou = !!(dataProva && hoje > dataProva);
  const fim = terminou ? dataProva : hoje;
  const ws = (workouts || []).filter((w) => w && w.date >= ini && w.date <= fim);
  const runs = ws.filter((w) => !E.isBike(w));
  const nSem = Math.max(1, Math.ceil((dias(ini, fim) + 1) / 7));
  const blocos = [];
  const prova = terminou ? provaDoCiclo(race, workouts) : null;
  const nome = race.name || 'Ciclo';

  // capa
  let capaTit = nSem + (nSem === 1 ? ' semana' : ' semanas') + ' até agora';
  if (prova) {
    capaTit = 'Você terminou a ' + nome + ' em ' + hCurto(prova.durationSec);
    if (race.goal === 'time' && race.targetSec > 0) { const d = Math.round((prova.durationSec - race.targetSec) / 60); capaTit += d < 0 ? ', ' + -d + ' min abaixo do plano' : d > 0 ? ', ' + d + ' min acima do plano' : ', no tempo do plano'; }
  } else if (terminou) capaTit = nSem + ' semanas de ciclo';
  blocos.push({ tipo: 'capa', rotulo: nome, titulo: capaTit + '.', ini, fim, semanas: nSem, parcial: !terminou, numero: prova ? hCurto(prova.durationSec) : String(nSem), unidade: prova ? 'na prova' : nSem === 1 ? 'semana' : 'semanas' });

  // volume
  if (ws.length) {
    const km = runs.reduce((s, w) => s + (w.distKm || 0), 0), seg = ws.reduce((s, w) => s + (w.durationSec || 0), 0);
    const s0 = segundaDe(ini); const barras = [];
    for (let k = s0, i = 1; k <= fim; k = addDias(k, 7), i++) barras.push({ seg: k, n: i, km: runs.filter((w) => w.date >= k && w.date <= addDias(k, 6)).reduce((s, w) => s + (w.distKm || 0), 0) });
    const pico = barras.reduce((a, b) => (b.km > a.km ? b : a), barras[0]);
    blocos.push({ tipo: 'volume', rotulo: 'Volume', titulo: kmTxt(km) + ' km em ' + Math.round(seg / 3600) + ' h' + (pico && pico.km > 0 ? ', com pico de ' + kmTxt(pico.km) + ' km na semana ' + pico.n : '') + '.', km, horas: seg / 3600, barras, pico: pico ? pico.n : null, numero: kmTxt(km), unidade: 'km' });
  }

  // consistência (regra da Fase 3)
  const todas = semanas(workouts || [], { hoje, n: 120, metaH }).filter((s) => s.dom >= ini && s.seg <= fim && s.estado !== 'andamento');
  if (todas.length) {
    const c = todas.filter((s) => s.estado === 'consistente').length;
    let maior = 0, run = 0; for (const s of todas) { run = s.estado === 'consistente' ? run + 1 : 0; maior = Math.max(maior, run); }
    blocos.push({ tipo: 'consistencia', rotulo: 'Consistência', titulo: c + ' de ' + todas.length + ' semanas consistentes. Maior sequência: ' + maior + '.', consistentes: c, total: todas.length, maior, estados: todas.map((s) => s.estado), numero: c + ' de ' + todas.length, unidade: 'semanas consistentes' });
  }

  // recordes e longão
  const recs = [];
  for (const k of DISTANCIAS) {
    const no = runs.filter((w) => w.leitura && w.leitura.esforcos && w.leitura.esforcos[k] && selos(w, workouts || [], ini)[k] === 'pr');
    if (no.length) { const w = no.sort((a, b) => a.leitura.esforcos[k].t - b.leitura.esforcos[k].t)[0]; recs.push({ dist: ROTULO[k], t: w.leitura.esforcos[k].t, date: w.date, wid: w.id }); }
  }
  const longao = runs.slice().sort((a, b) => (b.distKm || 0) - (a.distKm || 0))[0] || null;
  if (recs.length || longao) {
    blocos.push({ tipo: 'recordes', rotulo: 'Recordes', titulo: recs.length ? (recs.length === 1 ? '1 recorde pessoal no ciclo.' : recs.length + ' recordes pessoais no ciclo.') : 'Longão mais longo: ' + kmTxt(longao.distKm || 0) + ' km.', recordes: recs, longao: longao ? { km: longao.distKm || 0, date: longao.date, wid: longao.id } : null, numero: recs.length ? String(recs.length) : kmTxt(longao.distKm || 0), unidade: recs.length ? (recs.length === 1 ? 'recorde pessoal' : 'recordes pessoais') : 'km no longão' });
  }

  // a prova: plano × real
  if (prova) {
    const linhas = (planoPassagens || []).map((p) => ({ rotulo: p.rotulo, plano: p.tS, real: p.rotulo === 'Chegada' ? prova.durationSec : (realNoKm ? realNoKm(p.km) : null) ?? tempoNoKm(prova, p.km) })).filter((l) => l.real != null);
    let tit = 'Você terminou em ' + hms(prova.durationSec) + '.';
    if (linhas.length) {
      const dentro = linhas.every((l) => l.real <= l.plano + 1);
      const dF = prova.durationSec - linhas[linhas.length - 1].plano;
      tit = dentro ? 'Você ficou dentro do plano em todas as passagens.' : 'Você terminou ' + Math.abs(Math.round(dF / 60)) + ' min ' + (dF > 0 ? 'acima' : 'abaixo') + ' do plano.';
    }
    blocos.push({ tipo: 'prova', rotulo: 'A prova', titulo: tit, tempo: prova.durationSec, linhas, wid: prova.id, numero: hms(prova.durationSec), unidade: race.name || 'prova' });
  }

  // segmentos que mais melhoraram no ciclo
  const melhoras = [];
  for (const s of segmentos || []) {
    const ps = []; for (const w of ws) for (const p of (w.leitura && w.leitura.segmentos) || []) if (p.id === s.id) ps.push({ ...p, date: w.date });
    const td = tendencia(ps, s.modal !== 'pedal');
    if (td.estado === 'rapido') melhoras.push({ id: s.id, nome: s.nome, difS: td.difS, pct: td.pct });
  }
  melhoras.sort((a, b) => b.difS - a.difS);
  if (melhoras.length) blocos.push({ tipo: 'segmentos', rotulo: 'Segmentos', titulo: 'No ' + melhoras[0].nome + ', ' + melhoras[0].difS + ' s mais rápido.', lista: melhoras.slice(0, 2), numero: melhoras[0].difS + ' s', unidade: 'mais rápido no ' + melhoras[0].nome });

  // tênis do ciclo
  // (estado: o do par hoje, pela regra de equipamentos, para "Hora de trocar o par")
  const tenis = ((athlete && athlete.equipamentos) || []).filter((e) => e.tipo === 'tenis').map((t) => ({ id: t.id, nome: t.nome, km: runs.filter((w) => w.gearId === t.id).reduce((s, w) => s + (w.distKm || 0), 0), estado: t.aposentado ? null : estadoEquip(kmTenis(t, workouts || []).km, t.limiteKm) })).filter((t) => t.km > 0).sort((a, b) => b.km - a.km);
  if (tenis.length) blocos.push({ tipo: 'tenis', rotulo: 'Tênis', titulo: tenis[0].nome + ': ' + kmTxt(tenis[0].km) + ' km no ciclo.', lista: tenis, numero: kmTxt(tenis[0].km), unidade: 'km no ciclo com ' + tenis[0].nome + (tenis[0].estado === 'limite' ? '. Hora de trocar o par.' : '') });

  return { ini, fim, parcial: !terminou, nome, blocos };
}
// Stories: um card por bloco, na ordem, no máximo 6. Os segmentos NUNCA entram (regra do projeto:
// segmentos não vão para card nem compartilhamento, revelam onde você mora); por isso, com os
// outros 6 blocos, cabe 1 por card e nada precisa ser dividido.
export function cardsStories(R) {
  if (!R) return [];
  return R.blocos.filter((x) => x.tipo !== 'segmentos').slice(0, 6).map((x) => [x]);
}
// janela do card no Hoje: do dia seguinte à prova até 14 dias depois
export function mostraCardHoje(race, hoje) {
  if (!race || !race.date || !race.startDate) return false;
  const d = dias(String(race.date).slice(0, 10), hoje);
  return d >= 1 && d <= 15;
}
