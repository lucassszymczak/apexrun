// PERCURSO DA PROVA (Fase 4 · item 7 aprovado em 21/11, docs/fase4-formulas.md). Módulo puro.
// Lê GPX (texto) e partes já decodificadas (.FIT vira pontos no app), junta as partes na ordem,
// reamostra a cada 100 m, ajusta à distância oficial (até 2%, com aviso), calcula a inclinação
// de cada km (altitude suavizada em 500 m), D+ e D−, o "trecho mais duro" e a confiança.
// O perfil guardado (race.course) é leve: rota com até 400 pontos e altitude a cada 100 m.

export const COURSE_V = 1;
export const PASSO_M = 100;          // reamostragem
export const JANELA = 5;             // média de 5 pontos = 500 m
export const TOL_OFICIAL = 0.02;     // até 2%: ajusta e avisa; acima: pergunta
export const LIMIAR_SUBIDA = 2;      // km em subida: inclinação ≥ 2%
export const SALTO_AVISO_M = 200;    // buraco entre partes acima disso: aviso
export const MAX_PARTES = 4;
export const MAX_ROTA = 400;

const R = 6371000, rad = (x) => (x * Math.PI) / 180;
export function haversine(la1, lo1, la2, lo2) {
  const a = Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ---------------- leitura ----------------
// GPX: <trkpt>/<rtept> com lat e lon (em qualquer ordem), <ele> e <time> opcionais.
export function parseGpx(texto) {
  if (typeof texto !== 'string' || !/<gpx[\s>]/i.test(texto)) throw new Error('Não parece um arquivo GPX.');
  const lat = [], lon = [], ele = [];
  let inicio = null;
  const re = /<(trkpt|rtept)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/gi;
  let m;
  while ((m = re.exec(texto))) {
    const at = m[2], corpo = m[4] || '';
    const la = /\blat\s*=\s*["']([-\d.eE+]+)["']/.exec(at), lo = /\blon\s*=\s*["']([-\d.eE+]+)["']/.exec(at);
    if (!la || !lo) continue;
    const e = /<ele>\s*([-\d.eE+]+)\s*<\/ele>/i.exec(corpo);
    if (inicio == null) { const t = /<time>\s*([^<]+?)\s*<\/time>/i.exec(corpo); if (t && !isNaN(Date.parse(t[1]))) inicio = Date.parse(t[1]); }
    lat.push(+la[1]); lon.push(+lo[1]); ele.push(e ? +e[1] : null);
  }
  if (lat.length < 2) throw new Error('O GPX não tem pontos de trajeto.');
  const nome = (/<name>\s*([^<]{1,120}?)\s*<\/name>/i.exec(texto) || [])[1] || null;
  return { lat, lon, ele, d: null, inicio, nome, temAltitude: ele.some((x) => x != null) };
}

// ---------------- junção das partes ----------------
// partes: [{ lat[], lon[], ele[], d[]|null, inicio(ms)|null, esporte, baro }]
// ordem: índices na ordem escolhida (padrão: pelo horário de início)
export function ordemPadrao(partes) {
  return partes.map((p, i) => ({ i, t: p.inicio == null ? Infinity : p.inicio })).sort((a, b) => a.t - b.t || a.i - b.i).map((x) => x.i);
}
export function juntaPartes(partes, ordem = ordemPadrao(partes)) {
  if (!partes.length) throw new Error('Nenhuma parte.');
  if (partes.length > MAX_PARTES) throw new Error('No máximo ' + MAX_PARTES + ' partes.');
  const lat = [], lon = [], ele = [], d = [], saltos = [], kmPartes = [];
  let base = 0;
  ordem.forEach((pi, k) => {
    const p = partes[pi];
    // distância acumulada dentro da parte: a do relógio, se houver; senão, pelo GPS
    const dd = []; let acc = 0;
    for (let i = 0; i < p.lat.length; i++) {
      if (p.d && p.d[i] != null && p.d[0] != null) dd.push(p.d[i] - p.d[0]);
      else { if (i) acc += haversine(p.lat[i - 1], p.lon[i - 1], p.lat[i], p.lon[i]); dd.push(acc); }
    }
    if (k) {
      const s = haversine(lat[lat.length - 1], lon[lon.length - 1], p.lat[0], p.lon[0]);
      saltos.push({ entre: [k, k + 1], m: Math.round(s) });
      base += s; // o buraco entre as partes vira linha reta
    }
    for (let i = 0; i < p.lat.length; i++) { lat.push(p.lat[i]); lon.push(p.lon[i]); ele.push(p.ele[i]); d.push(base + dd[i]); }
    kmPartes.push(dd[dd.length - 1] / 1000);
    base += dd[dd.length - 1];
  });
  return { lat, lon, ele, d, saltos, avisoSalto: saltos.some((s) => s.m > SALTO_AVISO_M), kmPartes, kmTotal: base / 1000 };
}

// ---------------- reamostragem a cada 100 m ----------------
export function reamostra(tr, passo = PASSO_M) {
  const n = tr.d.length, total = tr.d[n - 1];
  // altitude: preenche buracos com o vizinho válido (sem inventar fora do trecho)
  const e = tr.ele.slice(); let last = e.find((x) => x != null) ?? null;
  for (let i = 0; i < n; i++) { if (e[i] == null) e[i] = last; else last = e[i]; }
  const out = { d: [], lat: [], lon: [], ele: [] };
  let j = 0;
  for (let x = 0; x <= total + 1e-6; x += passo) {
    while (j < n - 2 && tr.d[j + 1] < x) j++;
    const d0 = tr.d[j], d1 = tr.d[j + 1] ?? d0, f = d1 > d0 ? Math.min(1, Math.max(0, (x - d0) / (d1 - d0))) : 0;
    const lin = (a) => (a[j] == null || a[j + 1] == null ? a[j] : a[j] + f * (a[j + 1] - a[j]));
    out.d.push(x); out.lat.push(lin(tr.lat)); out.lon.push(lin(tr.lon)); out.ele.push(e[0] == null ? null : lin(e));
  }
  // último ponto exatamente no fim
  if (out.d[out.d.length - 1] < total - 1) { out.d.push(total); out.lat.push(tr.lat[n - 1]); out.lon.push(tr.lon[n - 1]); out.ele.push(e[n - 1]); }
  return out;
}

// ---------------- distância oficial ----------------
export function comparaOficial(kmGravados, kmOficiais) {
  if (!(kmOficiais > 0) || !(kmGravados > 0)) return { diffPct: null, ajusta: false, pergunta: false };
  const diff = (kmGravados - kmOficiais) / kmOficiais;
  return { diffPct: Math.round(diff * 1000) / 10, ajusta: true, pergunta: Math.abs(diff) > TOL_OFICIAL };
}
// Estica ou encolhe por igual até a distância oficial (o chamador decide se pergunta antes).
export function ajustaDistancia(perfil, kmOficiais) {
  const total = perfil.d[perfil.d.length - 1];
  if (!(total > 0) || !(kmOficiais > 0)) return perfil;
  const f = (kmOficiais * 1000) / total;
  return { ...perfil, d: perfil.d.map((x) => x * f), fator: f };
}

// ---------------- suavização, km a km, D+/D− ----------------
export function suaviza(ele, janela = JANELA) {
  const h = Math.floor(janela / 2);
  return ele.map((_, i) => { let s = 0, c = 0; for (let k = i - h; k <= i + h; k++) if (k >= 0 && k < ele.length && ele[k] != null) { s += ele[k]; c++; } return c ? s / c : null; });
}
// altitude (suavizada) na distância x, interpolada
function altEm(perfil, sm, x) {
  const d = perfil.d; let j = 0;
  while (j < d.length - 2 && d[j + 1] < x) j++;
  const f = d[j + 1] > d[j] ? Math.min(1, Math.max(0, (x - d[j]) / (d[j + 1] - d[j]))) : 0;
  return sm[j] == null || sm[j + 1] == null ? sm[j] : sm[j] + f * (sm[j + 1] - sm[j]);
}
// [{km, de, ate, distKm, inclinacao(%), sobe(m), desce(m)}]
export function kmAKm(perfil) {
  const sm = suaviza(perfil.ele), total = perfil.d[perfil.d.length - 1], out = [];
  if (sm.every((x) => x == null)) return [];
  for (let k = 0; k * 1000 < total - 1; k++) {
    const a = k * 1000, b = Math.min(total, (k + 1) * 1000), len = b - a;
    const ea = altEm(perfil, sm, a), eb = altEm(perfil, sm, b);
    let sobe = 0, desce = 0, prev = ea;
    for (let i = 0; i < perfil.d.length; i++) { if (perfil.d[i] <= a || perfil.d[i] >= b) continue; const v = sm[i]; if (v == null) continue; if (v > prev) sobe += v - prev; else desce += prev - v; prev = v; }
    if (eb > prev) sobe += eb - prev; else desce += prev - eb;
    out.push({ km: k + 1, de: a / 1000, ate: b / 1000, distKm: len / 1000, inclinacao: Math.round(((eb - ea) / len) * 1000) / 10, sobe: Math.round(sobe), desce: Math.round(desce) });
  }
  return out;
}
export function desnivel(perfil) {
  const sm = suaviza(perfil.ele); let up = 0, dn = 0;
  for (let i = 1; i < sm.length; i++) { if (sm[i] == null || sm[i - 1] == null) continue; const x = sm[i] - sm[i - 1]; if (x > 0) up += x; else dn -= x; }
  return { dMais: Math.round(up), dMenos: Math.round(dn) };
}
// Sequência de km seguidos em subida (≥ 2%) com mais metros de subida; empate: a mais perto do fim.
export function trechoMaisDuro(kms) {
  let best = null, cur = null;
  const fecha = () => { if (cur && (!best || cur.m > best.m || (cur.m === best.m && cur.de >= best.de))) best = cur; cur = null; };
  for (const k of kms) {
    if (k.inclinacao >= LIMIAR_SUBIDA) { if (!cur) cur = { de: k.km, ate: k.km, m: 0 }; cur.ate = k.km; cur.m += k.sobe; }
    else fecha();
  }
  fecha();
  return best ? { de: best.de, ate: best.ate, metros: Math.round(best.m) } : null;
}

// ---------------- confiança ----------------
export function confianca(fonte, baro) {
  if (fonte === 'gpx') return 'Alta';
  if (fonte === 'gravacao') return baro ? 'Moderada' : 'Baixa';
  return 'Baixa';
}

// ---------------- digitada ----------------
// kms: [{ sobe, desce }] (metros) para cada km; o último pode ser parcial (distância oficial)
export function perfilDigitado(kms, kmOficiais, fonteTexto) {
  if (!fonteTexto || !String(fonteTexto).trim()) throw new Error('Informe a fonte da altimetria (link ou nome do site oficial).');
  if (!kms.length) throw new Error('Digite ao menos um km.');
  const total = kmOficiais > 0 ? kmOficiais * 1000 : kms.length * 1000;
  const d = [0], ele = [0]; let alt = 0;
  kms.forEach((k, i) => {
    const fim = Math.min(total, (i + 1) * 1000), ini = i * 1000; if (fim <= ini) return;
    const net = (+k.sobe || 0) - (+k.desce || 0);
    // 10 pontos por km, com a variação líquida distribuída por igual
    for (let s = 1; s <= 10; s++) { const x = ini + ((fim - ini) * s) / 10; if (x > d[d.length - 1]) { d.push(x); ele.push(alt + (net * s) / 10); } }
    alt += net;
  });
  return { d, lat: d.map(() => null), lon: d.map(() => null), ele };
}

// ---------------- perfil leve (o que vai para race.course) ----------------
const E5 = (x) => Math.round(x * 1e5);
const delta = (a) => a.map((v, k) => (k ? v - a[k - 1] : v));
const undelta = (a) => { const o = []; a.forEach((v, k) => o.push(k ? o[k - 1] + v : v)); return o; };
export function paraLeve(perfil) {
  const n = perfil.d.length, comGps = perfil.lat.some((x) => x != null);
  const passo = Math.max(1, Math.ceil(n / MAX_ROTA));
  const idx = []; for (let i = 0; i < n; i += passo) idx.push(i); if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
  return {
    passo: Math.round((perfil.d[1] - perfil.d[0]) || PASSO_M),
    totalM: Math.round(perfil.d[n - 1]),
    alt: delta(perfil.ele.map((x) => (x == null ? 0 : Math.round(x * 10)))),   // decímetros
    rota: comGps ? { lat: delta(idx.map((i) => E5(perfil.lat[i]))), lon: delta(idx.map((i) => E5(perfil.lon[i]))), d: delta(idx.map((i) => Math.round(perfil.d[i]))) } : null,
  };
}
export function deLeve(L) {
  const alt = undelta(L.alt).map((x) => x / 10), n = alt.length;
  const d = alt.map((_, i) => (i === n - 1 ? L.totalM : i * L.passo));
  const rota = L.rota ? { lat: undelta(L.rota.lat).map((x) => x / 1e5), lon: undelta(L.rota.lon).map((x) => x / 1e5), d: undelta(L.rota.d) } : null;
  return { d, ele: alt, lat: d.map(() => null), lon: d.map(() => null), rota };
}

// ---------------- tudo junto ----------------
// fonte: 'gpx' | 'gravacao' | 'digitada'. Devolve o course pronto para race.course + o resumo.
export function montaCourse({ fonte, perfilBruto, partesInfo = [], kmOficiais, ajustar = true, fonteTexto = null, baro = false, digitados = null, agora = new Date() }) {
  const kmGravados = perfilBruto.d[perfilBruto.d.length - 1] / 1000;
  const cmp = fonte === 'digitada' ? { diffPct: null, ajusta: false, pergunta: false } : comparaOficial(kmGravados, kmOficiais);
  const perfil = fonte !== 'digitada' && ajustar && kmOficiais > 0 ? ajustaDistancia(perfilBruto, kmOficiais) : perfilBruto;
  const course = {
    v: COURSE_V, fonte, confianca: confianca(fonte, baro), partes: partesInfo,
    kmGravados: Math.round(kmGravados * 100) / 100, kmOficiais: kmOficiais || null,
    diffPct: cmp.diffPct, ajustado: fonte !== 'digitada' && ajustar && kmOficiais > 0,
    fonteTexto: fonteTexto || null, updatedAt: agora.toISOString(),
    perfil: paraLeve(perfil),
  };
  if (fonte === 'digitada' && digitados) course.digitados = digitados.map((k) => ({ sobe: Math.round(+k.sobe || 0), desce: Math.round(+k.desce || 0) }));
  return { course, resumo: resumoCourse(course), comparacao: cmp };
}
export function resumoCourse(course) {
  const p = deLeve(course.perfil);
  let kms = kmAKm(p), dv = desnivel(p);
  if (course.digitados) { // digitada: vale o que você digitou, km a km
    kms = kms.map((k, i) => { const t = course.digitados[i]; return t ? { ...k, sobe: t.sobe, desce: t.desce, inclinacao: Math.round(((t.sobe - t.desce) / (k.distKm * 1000)) * 1000) / 10 } : k; });
    dv = { dMais: course.digitados.reduce((s, t) => s + t.sobe, 0), dMenos: course.digitados.reduce((s, t) => s + t.desce, 0) };
  }
  return { km: p.d[p.d.length - 1] / 1000, ...dv, kms, duro: trechoMaisDuro(kms), comGps: !!course.perfil.rota };
}
