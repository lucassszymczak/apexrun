// PLANO DE PROVA (Fase 4 · itens 1, 2, 3, 4 e 5 aprovados em 21/11, docs/fase4-formulas.md).
// Módulo puro. Importa do motor (gradeCostMult, riegel) e da leitura (correcaoHadley); não copia
// nem muda fórmulas existentes.
import * as E from './engine.mjs';
import { correcaoHadley } from './leitura.mjs';

export const PLANO_V = 1;
export const NEGATIVA_PCT = 1;            // item 2 (decisão do Lucas: ±1%)
export const DIAS_PREVISAO = 16;          // Open-Meteo: até 16 dias
export const MARATONA_MIN_KM = 30;        // item 4: faixa da maratona a partir de 30 km
export const MARATONA_EXTRA_S = 20 * 60;  // item 4: Riegel + 20 min (Vickers e Vertosick, 2016)
export const FAIXA_CURTA_PCT = 2.5;       // item 4: ±2,5% abaixo de 30 km (convenção aprovada)
export const LIMIAR_SUBIDA = 2;           // km em subida: ≥ 2% (item 7)

// ---------------- os km da prova ----------------
// Com percurso: os km do resumo do percurso (inclinação suavizada). Sem: km planos.
export function kmsDaProva(distKm, kmsPercurso) {
  if (kmsPercurso && kmsPercurso.length) return kmsPercurso.map((k) => ({ km: k.km, distKm: k.distKm, inclinacao: k.inclinacao, sobe: k.sobe, desce: k.desce }));
  const n = Math.ceil(distKm - 1e-9), out = [];
  for (let i = 0; i < n; i++) out.push({ km: i + 1, distKm: Math.min(1, distKm - i), inclinacao: 0, sobe: 0, desce: 0 });
  return out;
}

// ---------------- itens 1 e 2: pace por km ----------------
// pace_k = P × gradeCostMult(inclinação) × fator da estratégia; P é escolhido para a soma dar o alvo.
export function fatorEstrategia(kms, strategy) {
  const total = kms.reduce((s, k) => s + k.distKm, 0), meio = total / 2;
  let acc = 0;
  return kms.map((k) => { const m = acc + k.distKm / 2; acc += k.distKm; return strategy === 'negativa' ? (m < meio ? 1 + NEGATIVA_PCT / 100 : 1 - NEGATIVA_PCT / 100) : 1; });
}
export function paceAlvo(kms, alvoSec, strategy = 'constante') {
  const f = fatorEstrategia(kms, strategy);
  const peso = kms.map((k, i) => E.gradeCostMult(k.inclinacao) * f[i]);
  const P = alvoSec / kms.reduce((s, k, i) => s + k.distKm * peso[i], 0);
  return { P, paces: peso.map((w) => P * w) };
}

// ---------------- item 3: clima ----------------
// Correção (%) de uma hora: 0 em clima padrão (definição do motor); senão a regra temperatura + orvalho.
export function correcaoDaHora(h, athlete) {
  if (!h || h.tempC == null) return null;
  const tags = E.climateTags({ tempC: h.tempC, dewC: h.dewC }, E.climateOpts(athlete || {}));
  if (tags.inStandard) return 0;
  const c = correcaoHadley(h.tempC, h.dewC);
  return c && c.pct != null ? c.pct : null; // calor extremo (> 180 °F): sem número
}
export function diasAte(dataProva, hoje) {
  const a = Date.parse(dataProva + 'T12:00:00Z'), b = Date.parse(hoje.toISOString().slice(0, 10) + 'T12:00:00Z');
  return Math.round((a - b) / 86400000);
}
export function aberturaPrevisao(dataProva) {
  const d = new Date(dataProva + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - DIAS_PREVISAO); return d.toISOString().slice(0, 10);
}
// modo: 'padrao' (fora dos 16 dias, sem previsão ou sem local) ou 'previsao'
export function modoClima(dataProva, hoje, horas) {
  const dias = diasAte(dataProva, hoje);
  if (dias > DIAS_PREVISAO) return { modo: 'padrao', motivo: 'longe', abre: aberturaPrevisao(dataProva) };
  if (dias < 0) return { modo: 'padrao', motivo: 'passou' };
  if (!horas || !horas.length) return { modo: 'padrao', motivo: 'sem-previsao' };
  return { modo: 'previsao' };
}

// ---------------- o plano inteiro ----------------
// horas: [{ hora: 'HH:MM' local, tempC, dewC }] do dia da prova (previsão), ou null.
export function montaPlano({ distKm, kmsPercurso = null, alvoSec, strategy = 'constante', startTime = '06:00', horas = null, athlete = null, clima = { modo: 'padrao' } }) {
  const kms = kmsDaProva(distKm, kmsPercurso);
  const { P, paces } = paceAlvo(kms, alvoSec, strategy);
  // clima hora a hora: cada km recebe a correção da hora em que você estará nele
  const [hh, mm] = String(startTime || '06:00').split(':').map(Number);
  const largadaMin = hh * 60 + (mm || 0);
  let acc = 0;
  const linhas = kms.map((k, i) => {
    const meioS = acc + (paces[i] * k.distKm) / 2;
    let corr = 0;
    if (clima.modo === 'previsao' && horas && horas.length) {
      const minDoDia = largadaMin + meioS / 60, hora = Math.floor(minDoDia / 60) % 24;
      const h = horas.find((x) => +String(x.hora).slice(0, 2) === hora);
      const c = h ? correcaoDaHora(h, athlete) : null;
      corr = c == null ? 0 : c;
    }
    const pace = paces[i] * (1 + corr / 100);
    acc += pace * k.distKm;
    return { ...k, paceSkm: pace, climaPct: corr, acumS: acc, subida: k.inclinacao >= LIMIAR_SUBIDA };
  });
  const total = acc;
  return { v: PLANO_V, P, linhas, totalS: total, alvoS: alvoSec, climaExtraS: total - alvoSec, passagens: passagens(linhas, distKm), blocos: blocos(linhas) };
}

// tempo acumulado numa distância (interpolado dentro do km)
export function tempoEm(linhas, dKm) {
  let ini = 0, t0 = 0;
  for (const l of linhas) { const fim = ini + l.distKm; if (dKm <= fim + 1e-9) return t0 + (dKm - ini) * l.paceSkm; ini = fim; t0 = l.acumS; }
  return t0;
}
export function passagens(linhas, distKm) {
  const out = [{ rotulo: distKm > 25 ? 'Meia' : 'Metade', km: distKm > 25 ? 21.0975 : distKm / 2 }];
  if (distKm > MARATONA_MIN_KM + 2) out.push({ rotulo: 'km 30', km: 30 });
  out.push({ rotulo: 'Chegada', km: distKm });
  return out.map((p) => ({ ...p, tS: tempoEm(linhas, p.km) }));
}
// blocos de 5 km: trecho, terreno (pela regra de 2%), pace médio, acumulado
export function terreno(ls) {
  const sobe = ls.some((l) => l.inclinacao >= LIMIAR_SUBIDA), desce = ls.some((l) => l.inclinacao <= -LIMIAR_SUBIDA);
  return sobe && desce ? 'sobe e desce' : sobe ? 'subida' : desce ? 'descida' : 'plano';
}
export function blocos(linhas) {
  const out = [];
  for (let i = 0; i < linhas.length; i += 5) {
    const ls = linhas.slice(i, i + 5), d = ls.reduce((s, l) => s + l.distKm, 0), t = ls.reduce((s, l) => s + l.paceSkm * l.distKm, 0);
    const de = ls[0].km, ate = ls[ls.length - 1].km, fimKm = i + d;
    out.push({ de, ate, rotulo: 'km ' + de + '–' + (Math.abs(fimKm - Math.round(fimKm)) < 0.01 ? ate : String(Math.round(fimKm * 10) / 10).replace('.', ',')), terreno: terreno(ls), paceSkm: t / d, acumS: ls[ls.length - 1].acumS, kms: ls });
  }
  return out;
}
// título-conclusão
export function tituloPlano(plano, duro) {
  const P = E.paceStr(plano.P);
  if (!duro) return 'Mire ' + P + '/km do início ao fim';
  const ls = plano.linhas.filter((l) => l.km >= duro.de && l.km <= duro.ate);
  const d = ls.reduce((s, l) => s + l.distKm, 0), t = ls.reduce((s, l) => s + l.paceSkm * l.distKm, 0);
  return 'Mire ' + P + '/km no plano; do km ' + duro.de + ' ao ' + duro.ate + ', cerca de ' + E.paceStr(t / d) + '/km';
}

// ---------------- itens 4 e 5: tempo realista e "terminar bem" ----------------
// âncora: a mesma do card "Estimativa de prova" (bestAnchor do ciclo, senão de todas as corridas)
// percursoExtraPct: quanto o percurso pesa a mais que o plano (Σ d·gradeCostMult / Σ d − 1)
export function percursoExtraPct(kms) {
  const d = kms.reduce((s, k) => s + k.distKm, 0);
  return d ? (kms.reduce((s, k) => s + k.distKm * E.gradeCostMult(k.inclinacao), 0) / d - 1) * 100 : 0;
}
export function tempoRealista({ anchor, distKm, kmsPercurso = null, climaPct = 0 }) {
  if (!anchor || !(anchor.distKm > 0) || !(anchor.durationSec > 0) || !(distKm > 0)) return null;
  const R = E.riegel(anchor.distKm, anchor.durationSec, distKm);
  const pPct = percursoExtraPct(kmsDaProva(distKm, kmsPercurso));
  const maratona = distKm >= MARATONA_MIN_KM;
  const base = maratona ? [R, R + MARATONA_EXTRA_S] : [R * (1 - FAIXA_CURTA_PCT / 100), R * (1 + FAIXA_CURTA_PCT / 100)];
  const mult = (1 + pPct / 100) * (1 + (climaPct || 0) / 100);
  const prova = anchor.type === 'prova' || anchor.type === 'teste';
  return {
    v: PLANO_V, riegelS: R, percursoPct: pPct, climaPct: climaPct || 0, maratona,
    correcaoS: maratona ? MARATONA_EXTRA_S : null,
    rapidoS: base[0] * mult, lentoS: base[1] * mult,
    confianca: prova ? 'Moderada' : 'Baixa',
    ancora: { id: anchor.id, date: anchor.date, distKm: anchor.distKm, durationSec: anchor.durationSec, type: anchor.type },
  };
}
// meta do plano: tempo-alvo, ou a ponta lenta da faixa em "terminar bem"
export function metaDoPlano(race, realista) {
  if (race && race.goal === 'time' && race.targetSec > 0) return { alvoS: race.targetSec, origem: 'alvo' };
  if (realista) return { alvoS: Math.round(realista.lentoS), origem: 'terminar-bem' };
  return null;
}
