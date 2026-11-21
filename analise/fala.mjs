// "DIGA COMO FOI" (Fase 5 · item 1 aprovado em 21/11, docs/fase5-formulas.md). Módulo puro.
// Lê a frase ditada pelo microfone do teclado e devolve os campos entendidos. Nada é salvo aqui:
// o Completar mostra o resultado para o Lucas conferir. Regras:
// - RPE (0–10, inteiro), sono (0–14 h), as 19 regiões com lado e intensidade (0–10), o
//   equipamento citado pelo nome;
// - região sem lado ou sem intensidade fica PENDENTE (não chuta);
// - "dor articular", "lesão", "machuquei" nunca ligam o interruptor: só geram um aviso;
// - o resto é ignorado.
export const FALA_V = 1;

export const REGIOES = [
  ['quadril', 'Quadril', true], ['coxa', 'Coxa (frente)', true], ['joelho', 'Joelho', true], ['canela', 'Canela', true],
  ['pe', 'Tornozelo e pé', true], ['lombar', 'Lombar', false], ['gluteo', 'Glúteo', true], ['posterior', 'Posterior da coxa', true],
  ['panturrilha', 'Panturrilha', true], ['aquiles', 'Tendão de Aquiles', true],
];
// nome por extenso com o lado (o mesmo das telas)
const NOME_LADO = {
  quadril: ['Quadril direito', 'Quadril esquerdo'], coxa: ['Coxa direita (frente)', 'Coxa esquerda (frente)'], joelho: ['Joelho direito', 'Joelho esquerdo'],
  canela: ['Canela direita', 'Canela esquerda'], pe: ['Tornozelo e pé direito', 'Tornozelo e pé esquerdo'], gluteo: ['Glúteo direito', 'Glúteo esquerdo'],
  posterior: ['Posterior da coxa direita', 'Posterior da coxa esquerda'], panturrilha: ['Panturrilha direita', 'Panturrilha esquerda'],
  aquiles: ['Tendão de Aquiles direito', 'Tendão de Aquiles esquerdo'],
};
export function nomeRegiao(id, lado) {
  if (id === 'lombar') return 'Lombar';
  const n = NOME_LADO[id]; if (!n) return id;
  return lado === 'd' ? n[0] : lado === 'e' ? n[1] : (REGIOES.find((r) => r[0] === id) || [id, id])[1];
}
// chave da região no mapa (a mesma do design): "canela_e", "lombar"
export const chave = (id, lado) => (id === 'lombar' ? 'lombar' : id + '_' + lado);

// sinônimos (já sem acento), do mais longo para o mais curto
const SIN = [
  ['frente da coxa', 'coxa'], ['posterior da coxa', 'posterior'], ['batata da perna', 'panturrilha'], ['tendao de aquiles', 'aquiles'],
  ['planta do pe', 'pe'], ['sola do pe', 'pe'], ['coluna lombar', 'lombar'],
  ['quadriceps', 'coxa'], ['isquiotibiais', 'posterior'], ['panturrilhas', 'panturrilha'], ['panturrilha', 'panturrilha'], ['tornozelos', 'pe'], ['tornozelo', 'pe'],
  ['calcanhar', 'pe'], ['sola', 'pe'], ['quadris', 'quadril'], ['quadril', 'quadril'], ['coxas', 'coxa'], ['coxa', 'coxa'], ['joelhos', 'joelho'], ['joelho', 'joelho'],
  ['canelas', 'canela'], ['canela', 'canela'], ['tibia', 'canela'], ['pes', 'pe'], ['pe', 'pe'], ['lombar', 'lombar'], ['costas', 'lombar'], ['coluna', 'lombar'],
  ['gluteos', 'gluteo'], ['gluteo', 'gluteo'], ['bumbum', 'gluteo'], ['posteriores', 'posterior'], ['posterior', 'posterior'], ['aquiles', 'aquiles'], ['tendao', 'aquiles'],
];
const NUM = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// texto → fichas: { t: 'w'|'n'|'sep', v }
function fichas(frase) {
  let s = semAcento(String(frase || '').toLowerCase());
  s = s.replace(/(\d)\s*[,.]\s*(\d)/g, '$1.$2'); // 7,5 → 7.5
  s = s.replace(/(\d+)\s*(?:h|:)\s*(\d{1,2})\b/g, (_, h, m) => ' ' + (+h + +m / 60) + ' '); // 7h30, 7:30
  s = s.replace(/(\d+)\s*h\b/g, '$1 horas');
  s = s.replace(/(\d)\.(\d)/g, '$1~$2').replace(/[,;.!?]+/g, ' | ').replace(/~/g, '.'); // o ponto decimal não é separador
  const out = [];
  for (const p of s.split(/\s+/).filter(Boolean)) {
    if (p === '|') out.push({ t: 'sep' });
    else if (/^\d+(\.\d+)?$/.test(p)) out.push({ t: 'n', v: +p });
    else if (p in NUM) out.push({ t: 'n', v: NUM[p], palavra: true });
    else out.push({ t: 'w', v: p });
  }
  // "N e meia" → N + 0,5; "N horas e M (minutos)" → N + M/60
  for (let i = 0; i < out.length; i++) {
    const a = out[i]; if (a.t !== 'n') continue;
    let j = i + 1; if (out[j] && out[j].t === 'w' && /^horas?$/.test(out[j].v)) j++;
    if (out[j] && out[j].t === 'w' && out[j].v === 'e' && out[j + 1] && out[j + 1].t === 'w' && out[j + 1].v === 'meia') { a.v += 0.5; out.splice(i + 1, j + 2 - (i + 1)); continue; }
    if (j > i + 1 && out[j] && out[j].v === 'e' && out[j + 1] && out[j + 1].t === 'n' && out[j + 1].v < 60) { a.v += out[j + 1].v / 60; a.horas = true; out.splice(i + 1, j + 2 - (i + 1)); if (out[i + 1] && out[i + 1].t === 'w' && /^minutos?$/.test(out[i + 1].v)) out.splice(i + 1, 1); }
  }
  return out;
}
const fmt1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

export function lerFrase(frase, { equipamentos = [] } = {}) {
  const F = fichas(frase);
  const usado = new Array(F.length).fill(false);
  const r = { rpe: null, sono: null, regioes: [], pendentes: [], gearId: null, avisos: [], entendi: [], articular: false };
  const prox = (i, max = 3) => { for (let k = i + 1; k < F.length && k <= i + max; k++) { if (F[k].t === 'sep') return -1; if (F[k].t === 'n' && !usado[k]) return k; } return -1; };
  const w = (i) => (F[i] && F[i].t === 'w' ? F[i].v : null);

  // RPE: "rpe", "rp", "erre pe e", "esforco (percebido)"
  for (let i = 0; i < F.length; i++) {
    let fim = -1;
    if (w(i) === 'rpe' || w(i) === 'rp') fim = i;
    else if (w(i) === 'erre' && w(i + 1) === 'pe' && w(i + 2) === 'e') fim = i + 2;
    else if (w(i) === 'esforco') fim = w(i + 1) === 'percebido' ? i + 1 : i;
    if (fim < 0) continue;
    for (let k = i; k <= fim; k++) usado[k] = true;
    const n = prox(fim);
    if (n < 0) { r.avisos.push('RPE sem número'); continue; }
    usado[n] = true;
    const v = F[n].v;
    if (Number.isInteger(v) && v >= 0 && v <= 10) { r.rpe = v; } else r.avisos.push('RPE fora de 0 a 10');
    break;
  }
  // sono: "dormi", "sono", "dormido"
  for (let i = 0; i < F.length; i++) {
    if (!['dormi', 'sono', 'dormido'].includes(w(i))) continue;
    usado[i] = true;
    const n = prox(i, 2);
    if (n < 0) { r.avisos.push('sono sem número de horas'); break; }
    usado[n] = true; if (w(n + 1) && /^horas?$/.test(w(n + 1))) usado[n + 1] = true;
    const v = Math.round(F[n].v * 10) / 10;
    if (v >= 0 && v <= 14) r.sono = v; else r.avisos.push('sono fora de 0 a 14 h');
    break;
  }
  // regiões
  const lado = (v) => (/^(esquerd[ao]s?|esq)$/.test(v) ? 'e' : /^(direit[ao]s?|dir)$/.test(v) ? 'd' : null);
  const dois2 = (k) => F[k] && F[k].t === 'n' && F[k].palavra && F[k].v === 2;
  const ambos = (i) => { const a = w(i), c = w(i + 2); return (a === 'ambas' || a === 'ambos') ? 1 : (a === 'dos' && dois2(i + 1) && c === 'lados') ? 3 : ((a === 'nas' || a === 'as' || a === 'nos' || a === 'os') && dois2(i + 1)) ? 2 : 0; };
  for (let i = 0; i < F.length; i++) {
    if (usado[i] || F[i].t !== 'w') continue;
    let id = null, len = 0;
    for (const [s, rid] of SIN) { const ps = s.split(' '); if (ps.every((p, k) => w(i + k) === p)) { id = rid; len = ps.length; break; } }
    if (!id) continue;
    // "pe" logo depois de "do/da" já foi pego pelos sinônimos compostos; "e" isolado não é região
    for (let k = i; k < i + len; k++) usado[k] = true;
    let ld = null, dois = false, int = null;
    // antes da região: "nos dois", "dor N", lado
    for (let k = i - 1; k >= 0 && k >= i - 3 && F[k].t !== 'sep'; k--) {
      if (dois2(k) && ['nos', 'nas', 'os', 'as'].includes(w(k - 1))) { dois = true; usado[k] = true; continue; }
      if (F[k].t === 'w' && lado(F[k].v) && !usado[k]) { ld = lado(F[k].v); usado[k] = true; }
      if (F[k].t === 'n' && !usado[k] && w(k - 1) === 'dor') { int = F[k].v; usado[k] = true; }
    }
    // depois: lado, "nas duas", número
    for (let k = i + len; k < F.length && k <= i + len + 5; k++) {
      if (F[k].t === 'sep') break;
      if (F[k].t === 'w' && SIN.some(([s]) => s.split(' ')[0] === F[k].v) && !['do', 'da'].includes(w(k - 1))) break; // outra região
      if (F[k].t === 'w' && lado(F[k].v) && !ld) { ld = lado(F[k].v); usado[k] = true; continue; }
      const a = ambos(k); if (a) { dois = true; for (let q = k; q < k + a; q++) usado[q] = true; k += a - 1; continue; }
      if (F[k].t === 'n' && !usado[k] && int == null) { int = F[k].v; usado[k] = true; break; }
    }
    const temLado = id !== 'lombar';
    const lados = !temLado ? [null] : dois ? ['d', 'e'] : ld ? [ld] : [];
    const intOk = int != null && Number.isInteger(int) && int >= 0 && int <= 10;
    if (int != null && !intOk) { r.avisos.push(nomeRegiao(id, ld) + ': dor fora de 0 a 10'); }
    if (temLado && !lados.length) { r.pendentes.push({ id, lado: null, int: intOk ? int : null, falta: 'lado' }); continue; }
    for (const l of lados) {
      if (!intOk) r.pendentes.push({ id, lado: l, int: null, falta: 'intensidade' });
      else r.regioes.push({ id, lado: l, int });
    }
  }
  // dor articular / lesão: só aviso
  const sem = semAcento(String(frase || '').toLowerCase());
  if (/\b(articular|articulacao|lesao|machuquei|machucou|torci)\b/.test(sem)) { r.articular = true; r.avisos.push('Se for dor articular, ligue o interruptor abaixo'); }
  // equipamento citado pelo nome (ativo)
  for (const e of equipamentos || []) {
    if (!e || e.aposentado || !e.nome) continue;
    const n = semAcento(String(e.nome).toLowerCase()).replace(/\s+/g, ' ').trim();
    if (n.length >= 2 && (' ' + sem.replace(/[,;.!?]/g, ' ').replace(/\s+/g, ' ') + ' ').includes(' ' + n + ' ')) { r.gearId = e.id; r.gearNome = e.nome; break; }
  }
  // "Entendi: …"
  if (r.rpe != null) r.entendi.push('RPE ' + r.rpe);
  if (r.sono != null) r.entendi.push('sono ' + fmt1(r.sono) + ' h');
  for (const g of r.regioes) r.entendi.push(nomeRegiao(g.id, g.lado).toLowerCase() + ' ' + g.int);
  if (r.gearId) r.entendi.push((equipamentos.find((e) => e.id === r.gearId).tipo === 'bike' ? 'bike ' : 'tênis ') + r.gearNome);
  return r;
}
// as frases da linha "Entendi" e as pendências, prontas para a tela
export function textoEntendi(r) {
  if (!r.entendi.length && !r.pendentes.length) return 'Não entendi nenhum campo; preencha abaixo.';
  return r.entendi.length ? 'Entendi: ' + r.entendi.join(', ') + '.' : '';
}
export function textoPendente(p) {
  return p.falta === 'lado' ? 'Falta o lado: ' + nomeRegiao(p.id, null).toLowerCase() + (p.int != null ? ' ' + p.int : '') : nomeRegiao(p.id, p.lado) + ': qual a dor de 0 a 10?';
}
