// Testes da leitura do treino (Fase 2 · Etapa 5). Roda com: node analise/leitura.test.mjs
// Casos sintéticos (sempre) + os .FIT reais do Lucas, se existirem em fixtures/privado/.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as E from './engine.mjs';
import { lapsFromMessages, tirosEstruturado, tirosDeVoltas, tirosAuto, tirosDoTreino } from './laps.mjs';
import { melhoresEsforcos, selos } from './efforts.mjs';
import { correcaoHadley, climaPadrao, inicioDeriva, custoSubida, computeLeitura, historia, curvaSubida, melhoresDoPeriodo, voltasParaLaps } from './leitura.mjs';
import { tirosPorOrigem } from './laps.mjs';
import { componente, classe, rumo, custoContraSkm, ventoDoTreino } from './wind.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;

// trajeto sintético: velocidade por segundo (m/s), opcional inclinação e GPS em linha reta
function track(vel, opt = {}) {
  const tr = { v: 1, start: 1.8e9, tzOffsetSec: -10800, hasGps: !!opt.gps, t: [], lat: [], lon: [], dist: [], hr: [], spd: [], alt: [], grade: [], draw: [] };
  let d = 0, t = 0;
  vel.forEach((v, i) => {
    if (opt.pausaEm && i === opt.pausaEm) t += opt.pausaS;
    tr.t.push(t); tr.dist.push(opt.semDist ? null : d); tr.spd.push(v); tr.hr.push(opt.semFC ? null : 140 + Math.round(v * 5));
    tr.grade.push(opt.grade ? opt.grade(i) : 0); tr.alt.push(0);
    const lat = opt.gps ? -25.4 + (d / 111320) : null; tr.lat.push(lat); tr.lon.push(opt.gps ? -51.4 : null);
    d += v; t += 1;
  });
  if (opt.gps) tr.draw = tr.t.map((_, i) => i).filter((i) => i % 10 === 0 || i === tr.t.length - 1);
  return tr;
}

console.log('\n== tiros (itens 4 e 5) ==');
{
  // treino estruturado: aquec · 6×(tiro 800 m ativo + rec 400 m) · desaq
  const laps = [{ n: 1, t: 600, d: 1600, intensidade: 'warmup' }];
  for (let k = 0; k < 6; k++) { laps.push({ n: laps.length + 1, t: 200 + k, d: 800, hr: 170, intensidade: 'active' }); laps.push({ n: laps.length + 1, t: 180, d: 400, intensidade: 'recovery' }); }
  laps.push({ n: laps.length + 1, t: 600, d: 1500, intensidade: 'cooldown' });
  const r = tirosEstruturado(laps);
  ok('estruturado: 6 tiros ativos, aquecimento e recuperação de fora', r && r.tiros.length === 6 && r.origem === 'estruturado', r && r.rotulo);
  ok('estruturado: rótulo por distância "6 × 800 m" e recuperação de cada tiro', r && r.rotulo === '6 × 800 m' && r.tiros[0].recT === 180);
  ok('a tabela bate com as voltas do relógio (tempo ±1 s, distância ±1 m)', r && r.tiros.every((x, k) => near(x.t, 200 + k, 1) && near(x.d, 800, 1)));
}
{
  // voltas por DISTÂNCIA apertadas no relógio: 5×400 m rápidos alternando 200 m lentos
  const laps = [{ n: 1, t: 900, d: 2000, gatilho: 'manual' }];
  for (let k = 0; k < 5; k++) { laps.push({ n: laps.length + 1, t: 100, d: 400, gatilho: 'distance' }); laps.push({ n: laps.length + 1, t: 90, d: 200, gatilho: 'distance' }); }
  const r = tirosDeVoltas(laps);
  ok('voltas por distância (decisão do Lucas): "5 × 400 m"', r && r.rotulo === '5 × 400 m', r && r.rotulo);
}
{
  // km automático: 21 voltas de 1 km parecidas + resto → não é tiro
  const laps = Array.from({ length: 21 }, (_, k) => ({ n: k + 1, t: 450 + (k % 3) * 5, d: 1000, gatilho: 'distance' }));
  laps.push({ n: 22, t: 60, d: 208, gatilho: 'session_end' });
  ok('km automático não vira tiro', tirosDeVoltas(laps) == null && tirosEstruturado(laps) == null);
}
{
  // detecção automática: 3 trechos de 120 s a 4,5 m/s num treino a 2,8 m/s
  const v = []; for (let k = 0; k < 4; k++) { for (let i = 0; i < 300; i++) v.push(2.8); if (k < 3) for (let i = 0; i < 120; i++) v.push(4.5); }
  const r = tirosAuto(track(v));
  ok('detecção automática: 3 tiros de ~120 s', r && r.tiros.length === 3 && r.tiros.every((x) => near(x.t, 120, 16)), r && r.tiros.map((x) => x.t).join(','));
  ok('treino contínuo: nenhum tiro detectado', tirosAuto(track(new Array(2400).fill(2.9))) == null);
}

console.log('\n== melhores esforços (item 6) ==');
{
  // 3 km a 3,0 m/s, um trecho de 1 km a 4,0 m/s no meio → melhor 1 km = 250 s
  const v = [...new Array(600).fill(3), ...new Array(250).fill(4), ...new Array(600).fill(3)];
  const e = melhoresEsforcos(track(v));
  ok('melhor 1 km conhecido (250 s)', e && near(e[1000].t, 250, 1), e && e[1000].t);
  ok('melhor 400 m dentro do trecho rápido (100 s)', e && near(e[400].t, 100, 1));
  ok('distância maior que o treino não aparece (5 km)', e && !e[5000]);
  const p = melhoresEsforcos(track(v, { pausaEm: 700, pausaS: 300 }));
  ok('janela com pausa > 60 s não vale (o melhor 1 km cai fora da pausa)', p && p[1000].t > 250, p && p[1000].t);
  ok('sem distância: nada', melhoresEsforcos(track(v, { semDist: true })) == null);
  const W = (id, t, date) => ({ id, date, leitura: { esforcos: { 1000: { t } } } });
  const todos = [W('a', 260, '2026-01-10'), W('b', 300, '2026-10-30'), W('c', 280, '2026-11-10')];
  ok('selo "Recorde pessoal" e "Melhor do ciclo"', selos(todos[0], todos, '2026-10-01')[1000] === 'pr' && selos(todos[2], todos, '2026-10-01')[1000] === 'ciclo' && !selos(todos[1], todos, '2026-10-01')[1000]);
}

console.log('\n== custo da subida (item 7) ==');
{
  const v = new Array(1800).fill(3);
  const tr = track(v, { grade: (i) => (i < 600 ? 0 : i < 1000 ? 6 : i < 1400 ? -3 : 3) });
  const s = custoSubida(tr);
  const soma = s.faixas.reduce((a, f) => a + f.tS, 0);
  ok('soma dos tempos das faixas = tempo total (±1 s)', near(soma, tr.t[tr.t.length - 1], 1), soma);
  const f5 = s.faixas[4];
  ok('GAP da faixa = o do motor (vGap) nas mesmas amostras', near(f5.gapSkm, Math.round(1000 / E.vGap(3, 6)), 1), f5.gapSkm + ' s/km');
  ok('título: a faixa de subida com ≥ 3 min e maior custo (> 5%)', s.titulo && s.titulo.faixa === '> 5%' && s.titulo.custoSkm > 0);
  ok('sem inclinação: nada', custoSubida({ ...tr, grade: tr.grade.map(() => null) }) == null);
}

console.log('\n== clima padrão (item 1), deriva (item 3), vento (item 2), história (item 8) ==');
{
  ok('regra temperatura + orvalho: 127 °F → 1,5%', correcaoHadley(17.7, 17.4).pct === 1.5);
  ok('acima de 180 °F: não aparece', correcaoHadley(35, 30).pct == null);
  const w = { type: 'facil', modal: 'corrida', distKm: 10, durationSec: 4580, weather: { tempC: 17.7, dewC: 17.4 } };
  const c = climaPadrao(w, {});
  ok('pace em clima padrão (7:38 → ~7:31)', c && near(c.paceSkm, 458 * 0.985, 1), c && c.paceSkm);
  ok('já em clima padrão: não aparece', climaPadrao({ ...w, weather: { tempC: 14, dewC: 10 } }, {}) == null);
  ok('sem clima: não aparece', climaPadrao({ ...w, weather: null }, {}) == null);
  ok('frio (< 8 °C): não aparece', climaPadrao({ ...w, weather: { tempC: 5, dewC: 3 } }, {}) == null);
  const sp = (efs) => efs.map((e) => ({ distKm: 1, timeSec: 420, hrAvg: Math.round((1000 / 420) / e), elevDeltaM: 0 }));
  const base = 0.0135;
  const dW = { type: 'longão', distKm: 15, durationSec: 6300, splits: sp([0.0145, 0.014, base, base, base, base, base, base, base, base, base * 0.93, base * 0.93, base * 0.92, base * 0.92, base * 0.92]) };
  const d = inicioDeriva(dW);
  ok('início da deriva no km 11', d && d.km === 11, d && d.km);
  ok('intervalado não tem início da deriva', inicioDeriva({ ...dW, type: 'intervalado' }) == null);
  ok('sem FC: não aparece', inicioDeriva({ ...dW, splits: dW.splits.map((s) => ({ ...s, hrAvg: null })) }) == null);
  ok('menos de 8 km: não aparece', inicioDeriva({ ...dW, distKm: 6, durationSec: 2400, splits: dW.splits.slice(0, 6) }) == null);
  ok('vento de norte (de 0°) a favor de quem corre para o sul', classe(componente(20, 0, 180), 20) === 1 && classe(componente(20, 0, 0), 20) === -1 && classe(componente(20, 0, 90), 20) === 0);
  ok('rumo para o norte = 0°', near(rumo(-25.4, -51.4, -25.3, -51.4), 0, 0.5));
  ok('custo do vento contra é positivo e cresce com o vento', custoContraSkm(3, 10, 333) > 0 && custoContraSkm(3, 20, 333) > custoContraSkm(3, 10, 333));
  const vt = ventoDoTreino(track(new Array(600).fill(3), { gps: true }), { kmh: 18, de: 0 });
  ok('treino para o norte com vento de norte: 100% contra', vt && vt.contraPct === 100 && vt.custoContraSkm > 0, vt && JSON.stringify(vt));
  ok('vento fraco (< 5 km/h): só o aviso', ventoDoTreino(track(new Array(60).fill(3), { gps: true }), { kmh: 3, de: 0 }).fraco === true);
  const h = historia({ ...dW, leitura: { deriva: { km: 11 } }, pain: false, rpe: 5, decouplingPct: 9.2 }, { recuperar: true });
  ok('história: 3 frases na ordem bem · observar · amanhã', h.length === 3 && h[0].tom === 'ok' && /km 11/.test(h[1].texto) && /descanso/.test(h[2].texto), h.map((x) => x.texto).join(' | '));
  const fx = (c, t = 300) => ({ leitura: { subida: { faixas: [0, 1, 2, 3, 4].map((k) => ({ tS: k === 4 ? t : 0, custoSkm: k === 4 ? c : null })) } } });
  const cv = curvaSubida([fx(40), fx(60), fx(50), fx(90, 100)]);
  ok('curva da subida: mediana com ≥ 3 treinos e ≥ 3 min na faixa', cv[4].custoSkm === 50 && cv[4].n === 3 && cv[3].custoSkm == null, JSON.stringify(cv[4]));
  ok('curva da subida: menos de 3 treinos não mostra', curvaSubida([fx(40), fx(60)])[4].custoSkm == null);
  const mp = melhoresDoPeriodo([{ id: 'a', date: '2026-01-01', leitura: { esforcos: { 1000: { t: 300 } } } }, { id: 'b', date: '2026-02-01', leitura: { esforcos: { 1000: { t: 280 }, 5000: { t: 1600 } } } }]);
  ok('melhores do período: o menor tempo de cada distância', mp[1000].id === 'b' && mp[5000].t === 1600);
  const lp = [{ n: 1, t: 600, d: 2000, hr: 140, gatilho: 'time', intensidade: null, inicio: 0 }];
  ok('voltas guardadas voltam ao formato de entrada', voltasParaLaps(computeLeitura({ w: dW, tr: null, laps: lp, wind: null }).voltas)[0].d === 2000);
  ok('trocar origem: "nenhum" tira os tiros', tirosPorOrigem('nenhum', lp, null) == null);
  ok('sem GPS (esteira): sem esforços nem vento', !computeLeitura({ w: { ...dW, indoor: true }, tr: null, laps: [], wind: null }).esforcos);
}

// ---------------- .FIT reais do Lucas (se existirem) ----------------
const req = createRequire(import.meta.url);
async function fit(p) { const { Decoder, Stream } = await import('@garmin/fitsdk'); return new Decoder(Stream.fromByteArray(new Uint8Array(readFileSync(p)))).read().messages; }
const MEIA = new URL('../fixtures/privado/24159622528.fit', import.meta.url), TIROS = new URL('../fixtures/privado/25128573610.fit', import.meta.url);
if (existsSync(TIROS)) {
  console.log('\n== .FIT reais ==');
  const m = await fit(TIROS);
  const laps = lapsFromMessages(m);
  const r = tirosDoTreino(laps, null);
  ok('19/11: "6 × 90 s" pelas voltas por tempo (decisão do Lucas)', r && r.rotulo === '6 × 90 s', r && r.rotulo);
  ok('19/11: tempos e distâncias batem com as voltas do relógio', r && r.tiros.every((x) => { const l = laps.find((q) => q.n === x.volta); return near(x.t, l.t, 1) && near(x.d, l.d, 1); }));
}
if (existsSync(MEIA)) {
  const m = await fit(MEIA);
  const w = E.fitMessagesToWorkout(m);
  ok('Meia: a deriva começa no km 14', inicioDeriva({ ...w, type: 'longão' })?.km === 14, inicioDeriva({ ...w, type: 'longão' })?.km);
  ok('Meia: km automático não vira tiro', tirosDeVoltas(lapsFromMessages(m)) == null);
}
void req;
console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
