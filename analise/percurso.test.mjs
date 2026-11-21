// Testes do percurso da prova (Fase 4 · Etapa 2). Roda com: node analise/percurso.test.mjs
// Percursos sintéticos (nenhum valor das telas de design). Critérios 3 a 6 do roteiro.
import { parseGpx, juntaPartes, ordemPadrao, reamostra, comparaOficial, ajustaDistancia, kmAKm, desnivel, trechoMaisDuro, confianca, perfilDigitado, paraLeve, deLeve, montaCourse, resumoCourse, haversine, suaviza } from './percurso.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const near = (a, b, t) => a != null && b != null && Math.abs(a - b) <= t;

// linha reta para o norte, 1 ponto a cada ~10 m, com altitude dada por uma função da distância
const M_POR_GRAU = 111195;
function linha(km, altFn, lat0 = -27.5, lon0 = -48.5, passo = 10) {
  const lat = [], lon = [], ele = [];
  for (let x = 0; x <= km * 1000 + 1e-6; x += passo) { lat.push(lat0 + x / M_POR_GRAU); lon.push(lon0); ele.push(altFn(x)); }
  return { lat, lon, ele };
}
const gpx = (p, comHora = true) => '<?xml version="1.0"?><gpx version="1.1" creator="teste"><trk><name>Teste</name><trkseg>' +
  p.lat.map((la, i) => `<trkpt lat="${la.toFixed(7)}" lon="${p.lon[i].toFixed(7)}"><ele>${p.ele[i].toFixed(2)}</ele>${comHora && i === 0 ? '<time>2026-12-12T08:00:00Z</time>' : ''}</trkpt>`).join('') + '</trkseg></trk></gpx>';

// altitude: plano a 20 m, sobe 3% do km 25 ao 28, desce 2% do km 33 ao 35
const alt = (x) => { const k = x / 1000; let a = 20; a += Math.min(Math.max(k - 25, 0), 3) * 30; a -= Math.min(Math.max(k - 33, 0), 2) * 20; return a; };

console.log('\n== GPX (critério 3) ==');
{
  const src = linha(42.195, alt);
  const g = parseGpx(gpx(src));
  ok('lê todos os pontos, a altitude e o nome', g.lat.length === src.lat.length && g.temAltitude && g.nome === 'Teste', g.lat.length + ' pontos');
  const tr = juntaPartes([{ ...g, d: null }]);
  ok('distância pelo GPS bate com 42,195 km (±0,1%)', near(tr.kmTotal, 42.195, 0.042), tr.kmTotal.toFixed(3));
  const r = reamostra(tr);
  let maxErr = 0; r.d.forEach((x, i) => { maxErr = Math.max(maxErr, Math.abs(r.ele[i] - alt(x * (42195 / (tr.kmTotal * 1000))))); });
  ok('critério 3 · perfil reamostrado = o do arquivo (até 1 m por ponto)', maxErr <= 1, maxErr.toFixed(2) + ' m');
  ok('um ponto a cada 100 m', r.d.length >= 422 && near(r.d[1] - r.d[0], 100, 0.001), r.d.length + ' pontos');
  const kms = kmAKm(r);
  ok('inclinação do km 26 ≈ +3% e do km 34 ≈ −2%', near(kms[25].inclinacao, 3, 0.3) && near(kms[33].inclinacao, -2, 0.3), kms[25].inclinacao + ' · ' + kms[33].inclinacao);
  ok('km plano ≈ 0%', near(kms[10].inclinacao, 0, 0.05));
  const dv = desnivel(r);
  ok('D+ ≈ 90 m e D− ≈ 40 m', near(dv.dMais, 90, 3) && near(dv.dMenos, 40, 3), dv.dMais + ' · ' + dv.dMenos);
  const duro = trechoMaisDuro(kms);
  ok('trecho mais duro: do km 26 ao 28 (a média de 500 m deixa a borda do km 25 abaixo de 2%)', duro && duro.de >= 25 && duro.de <= 26 && duro.ate === 28, JSON.stringify(duro));
  ok('percurso plano: sem trecho mais duro', trechoMaisDuro(kmAKm(reamostra(juntaPartes([{ ...linha(10, () => 5), d: null, inicio: null }])))) == null);
  ok('GPX inválido: erro claro', (() => { try { parseGpx('<html></html>'); return false; } catch (e) { return /GPX/.test(e.message); } })());
  ok('GPX com rtept e lon antes de lat', parseGpx('<gpx><rte><rtept lon="-48.5" lat="-27.5"/><rtept lon="-48.5" lat="-27.49"/></rte></gpx>').lat.length === 2);
}

console.log('\n== gravação em partes (critério 4) ==');
{
  const p1 = { ...linha(20, alt), d: null, inicio: Date.parse('2026-12-12T08:00:00Z'), esporte: 'bike', baro: true };
  const p2full = linha(42.195, alt);
  const off = p1.lat.length - 1;
  const p2 = { lat: p2full.lat.slice(off), lon: p2full.lon.slice(off), ele: p2full.ele.slice(off), d: null, inicio: Date.parse('2026-12-14T08:00:00Z'), esporte: 'bike', baro: true };
  ok('ordem pelo horário de início, mesmo com os arquivos trocados', ordemPadrao([p2, p1]).join(',') === '1,0');
  const j = juntaPartes([p2, p1]);
  ok('critério 4 · total = soma das partes', near(j.kmTotal, j.kmPartes[0] + j.kmPartes[1], 0.001), j.kmPartes.map((x) => x.toFixed(2)).join(' + ') + ' = ' + j.kmTotal.toFixed(2));
  ok('a junção começa na 1ª parte (mais cedo)', j.lat[0] === p1.lat[0]);
  ok('partes encostadas: sem aviso de buraco', !j.avisoSalto, j.saltos.map((s) => s.m + ' m').join(','));
  const p2longe = { ...p2, lat: p2.lat.map((x) => x + 0.01) };
  ok('buraco de mais de 200 m entre as partes: avisa', juntaPartes([p1, p2longe]).avisoSalto);
  ok('ordem manual é respeitada', juntaPartes([p1, p2], [1, 0]).lat[0] === p2.lat[0]);
  ok('mais de 4 partes: recusa', (() => { try { juntaPartes([p1, p1, p1, p1, p1]); return false; } catch { return true; } })());
  ok('distância do relógio (d) tem preferência sobre o GPS', near(juntaPartes([{ ...p1, d: p1.lat.map((_, i) => i * 10.5) }]).kmTotal, (p1.lat.length - 1) * 10.5 / 1000, 1e-9));
}

console.log('\n== distância oficial (critério 5) ==');
{
  const c1 = comparaOficial(42.195 * (1 - 0.014), 42.195), c3 = comparaOficial(42.195 * 1.03, 42.195);
  ok('critério 5 · 1,4% de diferença: ajusta e avisa, sem perguntar', c1.ajusta && !c1.pergunta && c1.diffPct === -1.4, c1.diffPct + '%');
  ok('critério 5 · 3% de diferença: pergunta antes', c3.pergunta && c3.diffPct === 3, c3.diffPct + '%');
  const r = reamostra(juntaPartes([{ ...linha(41.6, alt), d: null }]));
  const aj = ajustaDistancia(r, 42.195);
  ok('ajuste estica por igual até a oficial', near(aj.d[aj.d.length - 1], 42195, 0.5) && near(aj.fator, 42195 / r.d[r.d.length - 1], 1e-9));
  const { course } = montaCourse({ fonte: 'gravacao', perfilBruto: r, kmOficiais: 42.195, baro: true, partesInfo: [{ data: '2026-12-12', esporte: 'bike', km: 41.6 }] });
  ok('o course guarda gravado × oficial e a diferença', course.kmGravados === Math.round(r.d[r.d.length - 1] / 10) / 100 && course.kmOficiais === 42.195 && course.ajustado && course.diffPct < 0, course.kmGravados + ' × ' + course.kmOficiais + ' (' + course.diffPct + '%)');
}

console.log('\n== digitada (critério 6) ==');
{
  const kms = Array.from({ length: 15 }, (_, i) => ({ sobe: i === 7 ? 30 : 2, desce: i === 9 ? 25 : 2 }));
  ok('critério 6 · sem fonte: não salva', (() => { try { perfilDigitado(kms, 15, '  '); return false; } catch (e) { return /fonte/.test(e.message); } })());
  const p = perfilDigitado(kms, 15, 'site oficial da prova');
  const { course } = montaCourse({ fonte: 'digitada', perfilBruto: p, kmOficiais: 15, fonteTexto: 'site oficial da prova', digitados: kms });
  ok('critério 6 · com fonte: confiança Baixa e a fonte guardada', course.confianca === 'Baixa' && course.fonteTexto === 'site oficial da prova');
  const res = resumoCourse(course);
  ok('digitada: 15 km, o km 8 com os 30 m digitados e D+ = soma digitada', near(res.km, 15, 0.001) && res.kms.length === 15 && res.kms[7].sobe === 30 && res.dMais === 58, res.kms[7].sobe + ' m · D+ ' + res.dMais);
  ok('digitada: sem mapa (só perfil)', res.comGps === false);
}

console.log('\n== confiança e perfil leve ==');
{
  ok('GPX = Alta; gravação com barômetro = Moderada; sem = Baixa; digitada = Baixa', confianca('gpx') === 'Alta' && confianca('gravacao', true) === 'Moderada' && confianca('gravacao', false) === 'Baixa' && confianca('digitada') === 'Baixa');
  const r = reamostra(juntaPartes([{ ...linha(42.195, alt), d: null }]));
  const { course } = montaCourse({ fonte: 'gpx', perfilBruto: r, kmOficiais: 42.195 });
  const kb = Buffer.byteLength(JSON.stringify(course)) / 1024;
  ok('course de uma maratona com até 30 KB', kb <= 30, kb.toFixed(1) + ' KB');
  ok('rota com até 400 pontos', course.perfil.rota.lat.length <= 401, course.perfil.rota.lat.length + ' pontos');
  const back = deLeve(course.perfil);
  let maxErr = 0; back.ele.forEach((e, i) => { maxErr = Math.max(maxErr, Math.abs(e - r.ele[i])); });
  ok('ida e volta do perfil leve: altitude igual (até 0,05 m)', maxErr <= 0.05, maxErr.toFixed(3));
  ok('suavização de 5 pontos', JSON.stringify(suaviza([0, 0, 10, 0, 0]).map((x) => +x.toFixed(2))) === JSON.stringify([3.33, 2.5, 2, 2.5, 3.33]));
  ok('haversine: 1° de latitude ≈ 111 km', near(haversine(0, 0, 1, 0), 111195, 5));
}
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
