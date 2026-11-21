// LEITURA DO TREINO (Fase 2 · Etapa 5): história, tiros, melhores esforços, custo da subida.
// Só exibe o que está em w.leitura (calculado uma vez, com o trajeto completo). Sem dado, o
// item não aparece ou mostra "—" com o motivo. Nada aqui calcula fórmula nova.
import { useState, useEffect } from 'react';
import { IconCircleCheck, IconAlertTriangle, IconArrowRight, IconRepeat, IconTrophy, IconMountain } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { historia, melhoresDoPeriodo, curvaSubida } from '../../leitura.mjs';
import { selos, ROTULO, DISTANCIAS } from '../../efforts.mjs';
import { ORIGENS } from '../../laps.mjs';
import { Card, Kpi, Sheet, Conf, IC } from '../ui';
import { dec, dayMon } from '../fmt';
import { comTreinos } from '../periodo';
import { opcoesOrigem, trocarOrigem, recalcularLeitura } from '../actions';
import { buscarTrajetos, useGarminSync } from '../garmin-sync';
import { garminReady } from '../garmin';
import { href } from '../route';
import { trackIds } from '../db';
import { getState, toast } from '../store';
import type { Track } from '../track';

const pc = (s: number | null | undefined) => (s == null || !isFinite(s) ? '—' : E.paceStr(s));
const tempo = (s: number) => E.hms(Math.round(s)).replace(/^0:/, '');
const kmTxt = (x: number) => dec(x, 1).replace(',0', '');

// ---------------- contexto da história (regras do item 8) ----------------
export function proximoPlano(st: any, dateIso: string): string | null {
  try {
    const d = new Date(dateIso + 'T12:00:00'); d.setDate(d.getDate() + 1);
    const key = E.isoWeekKey(E.mIsoLocal(E.mMonday(d)));
    const wk = st.planWeeks && st.planWeeks[key];
    const dow = ((d.getDay() + 6) % 7) + 1;
    const s = wk && wk.sessions ? wk.sessions.find((x: any) => (x.dow || 0) === dow) : null;
    if (!s) return null;
    const t = E.mType(s.type);
    return t.rest ? 'descanso (plano da semana)' : String(t.label).toLowerCase();
  } catch { return null; }
}
export function seloTexto(w: any, st: any): string | null {
  const e = w.leitura && w.leitura.esforcos; if (!e) return null;
  const s = selos(w, st.workouts, st.race && st.race.startDate ? st.race.startDate : null);
  const ks = Object.keys(s).sort((a, b) => +b - +a); // a maior distância primeiro
  const pr = ks.find((k) => s[k] === 'pr'), ci = ks.find((k) => s[k] === 'ciclo');
  if (pr) return 'Recorde pessoal nos ' + ROTULO[pr] + ': ' + tempo(e[pr].t) + '.';
  if (ci) return 'Melhor do ciclo nos ' + ROTULO[ci] + ': ' + tempo(e[ci].t) + '.';
  return null;
}
export function ctxHistoria(w: any, st: any) {
  const a = st.athlete;
  const bk = E.isBike(w);
  const pac = bk ? null : (() => { try { return E.computePacing(w); } catch { return null; } })();
  // EF acima da mediana dos 30 dias anteriores
  let efVs: number | null = null;
  if (!bk) {
    const ef = E.computeEF(w);
    const d0 = new Date(w.date + 'T12:00:00'); d0.setDate(d0.getDate() - 30);
    const ini = d0.toISOString().slice(0, 10);
    const efs = st.workouts.filter((o: any) => o.id !== w.id && E.isRun(o) && o.date >= ini && o.date <= w.date).map((o: any) => E.computeEF(o)).filter((x: any) => x != null).sort((x: number, y: number) => x - y);
    if (ef != null && efs.length >= 3) { const m = efs[efs.length >> 1]; efVs = ((ef - m) / m) * 100; }
  }
  // prontidão e forma até o dia do treino
  let recuperar = false, tsb: number | null = null;
  try {
    const ws = E.sortedWorkouts().filter((o: any) => o.date <= w.date);
    const cx = comTreinos(ws, () => E.coachContext(ws, a));
    recuperar = cx && cx.rd && E.readyBand(cx.rd.score)[0] === 'Recovery';
    tsb = cx ? cx.tsb : null;
  } catch { /* sem contexto */ }
  return { selo: seloTexto(w, st), negativeSplit: !!(pac && pac.label === 'negative split'), efVsNormalPct: efVs, recuperar, tsb, proximoPlano: proximoPlano(st, w.date) };
}

// ---------------- 8. história ----------------
export function HistoriaCard({ w, st, titulo }: { w: any; st: any; titulo?: string }) {
  if (E.isBike(w)) return null;
  const linhas = historia(w, ctxHistoria(w, st));
  const ic = { ok: <IconCircleCheck {...IC} color="var(--ok)" aria-hidden="true" />, atencao: <IconAlertTriangle {...IC} color="var(--atencao)" aria-hidden="true" />, ciano: <IconArrowRight {...IC} color="var(--ciano)" aria-hidden="true" /> };
  const nome = { ok: 'O que foi bem', atencao: 'O que observar', ciano: 'Amanhã' };
  return (
    <section className="card historia" aria-label={titulo || 'História do treino'}>
      {titulo ? <h2 className="cap">{titulo}</h2> : null}
      <ul className="insights">
        {linhas.map((l, i) => <li key={i}>{ic[l.tom]}<span><span className="sr-only">{nome[l.tom]}: </span>{l.texto}</span></li>)}
      </ul>
      <Kpi doc="historia" className="link-kpi" label="Como a história é escrita">Como a história é escrita</Kpi>
    </section>
  );
}

// ---------------- título de seção da leitura ----------------
function SecH({ tema, titulo, icon }: { tema: string; titulo: string; icon?: any }) {
  return (<div className="stack" style={{ gap: 2 }}>
    <span className="cap row" style={{ gap: 6 }}>{icon}{tema}</span>
    <h2 className="lead">{titulo}</h2>
  </div>);
}

// índice do trajeto no instante t (segundos desde a largada)
function idxT(tr: Track, t: number): number | null { for (let i = 0; i < tr.t.length; i++) if (tr.t[i] >= t) return i; return tr.t.length ? tr.t.length - 1 : null; }

// ---------------- 4 e 5. tiros ----------------
const CONF_ORIGEM: Record<string, string> = { estruturado: 'Alta', 'voltas manuais': 'Moderada', 'voltas do relógio': 'Moderada', 'detecção automática': 'Baixa' };
function alvoPace(t: any): [number, number] | null { return t.alvo ? [1000 / t.alvo.vMax, 1000 / t.alvo.vMin] : null; }
function foraDoAlvo(t: any): boolean { const r = alvoPace(t); return !!(r && t.paceSkm != null && (t.paceSkm < r[0] - 0.5 || t.paceSkm > r[1] + 0.5)); }

export function TirosCard({ w, tr, onPick }: { w: any; tr: Track | null; onPick?: (i: number, fim?: number) => void }) {
  const T = w.leitura && w.leitura.tiros;
  const [trocar, setTrocar] = useState<{ k: string; rotulo: string | null }[] | null>(null);
  const escolhida = w.leitura && w.leitura.origem;
  if (!T) {
    if (escolhida === 'nenhum') return (
      <Card><SecH tema="Tiros" titulo="Sem tiros neste treino" icon={<IconRepeat size={14} stroke={1.75} aria-hidden="true" />} />
        <p className="apoio muted">Origem: você marcou que não são tiros. <button type="button" className="link" onClick={() => trocarOrigem(w.id, null)}>Voltar ao automático</button></p></Card>);
    return null;
  }
  const tiros: any[] = T.tiros;
  const comAlvo = tiros.some((t) => t.alvo);
  const fora = tiros.map(foraDoAlvo);
  const k0 = fora.indexOf(true);
  let titulo: string;
  if (comAlvo) titulo = k0 < 0 ? 'Todos os tiros no alvo' : k0 >= 2 && fora.slice(k0).every(Boolean) ? 'Regulares até o ' + k0 + 'º tiro' : (fora.filter((x) => !x).length + ' de ' + tiros.length + ' tiros no alvo');
  else titulo = T.regularidadePct == null ? T.rotulo : T.regularidadePct < 3 ? 'Regulares: variação de ' + dec(T.regularidadePct, 1) + '%' : 'Variação de ' + dec(T.regularidadePct, 1) + '% entre os tiros';
  // gráfico de pontos: mais alto = mais rápido
  const ps = tiros.map((t) => t.paceSkm).filter((x) => x != null) as number[];
  const alvos = tiros.map(alvoPace).filter(Boolean) as [number, number][];
  const lo = Math.min(...ps, ...alvos.map((x) => x[0])), hi = Math.max(...ps, ...alvos.map((x) => x[1]));
  const pad = Math.max(3, (hi - lo) * 0.15), y0 = lo - pad, y1 = hi + pad;
  const W = 320, H = 120, L = 40, R = 8, Tp = 8, B = 20;
  const X = (k: number) => L + ((k + 0.5) / tiros.length) * (W - L - R);
  const Y = (p: number) => Tp + ((p - y0) / (y1 - y0 || 1)) * (H - Tp - B); // pace menor (mais rápido) fica em cima
  const faixa = alvos.length ? [Math.min(...alvos.map((x) => x[0])), Math.max(...alvos.map((x) => x[1]))] : null;
  const ticks = [lo, (lo + hi) / 2, hi];
  const idxDe = (t: any) => (tr && t.inicio != null ? idxT(tr, t.inicio - tr.start) : null);
  const fimDe = (t: any) => (tr && t.inicio != null ? idxT(tr, t.inicio - tr.start + t.t) : undefined);
  const origem = T.origem as string;
  const abrirTrocar = async () => setTrocar(await opcoesOrigem(w));
  return (
    <Card>
      <SecH tema={'Tiros · ' + T.rotulo} titulo={titulo} icon={<IconRepeat size={14} stroke={1.75} aria-hidden="true" />} />
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={'Pace de cada tiro: ' + tiros.map((t, k) => (k + 1) + 'º ' + pc(t.paceSkm) + (fora[k] ? ' (fora do alvo)' : '')).join(', ')}>
        {faixa ? <rect x={L} y={Y(faixa[0])} width={W - L - R} height={Math.max(1, Y(faixa[1]) - Y(faixa[0]))} fill="var(--ciano)" fillOpacity={0.1} /> : null}
        {ticks.map((p, i) => <g key={i}><line x1={L} x2={W - R} y1={Y(p)} y2={Y(p)} stroke="var(--linha)" strokeWidth={1} /><text x={L - 6} y={Y(p) + 4} textAnchor="end" style={{ font: '400 11px var(--font-brand)', fill: 'var(--texto-3)' }}>{pc(p)}</text></g>)}
        {tiros.map((t, k) => t.paceSkm == null ? null : <g key={k}>
          {fora[k] ? <circle cx={X(k)} cy={Y(t.paceSkm)} r={9} fill="none" stroke="var(--atencao)" strokeWidth={1.5} /> : null}
          <circle cx={X(k)} cy={Y(t.paceSkm)} r={5} fill={fora[k] ? 'var(--atencao)' : 'var(--ciano)'} />
          <text x={X(k)} y={H - 6} textAnchor="middle" style={{ font: '400 11px var(--font-brand)', fill: 'var(--texto-3)' }}>{k + 1}</text>
        </g>)}
      </svg>
      <p className="hint">{faixa ? 'Faixa clara = alvo do treino (' + pc(faixa[0]) + ' a ' + pc(faixa[1]) + '/km). ' : 'Sem alvo no relógio: sem faixa. '}Mais alto é mais rápido.</p>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th scope="col">#</th><th scope="col" className="n">Tempo</th><th scope="col" className="n">Pace</th><th scope="col" className="n">FC</th><th scope="col" className="n">Recup.</th></tr></thead>
          <tbody>
            {tiros.map((t, k) => { const ii = idxDe(t); return (
              <tr key={k} className={fora[k] ? 'fora' : undefined}>
                <td>{onPick && ii != null ? <button type="button" className="link" onClick={() => onPick(ii, fimDe(t) ?? undefined)} aria-label={'Destacar o ' + (k + 1) + 'º tiro no mapa e no gráfico'}>{k + 1}</button> : k + 1}{fora[k] ? <span style={{ color: 'var(--atencao)' }}> · fora do alvo</span> : null}</td>
                <td className="n">{tempo(t.t)}</td><td className="n">{pc(t.paceSkm)}</td><td className="n">{t.hr || '—'}</td><td className="n">{t.recT ? tempo(t.recT) : '—'}</td>
              </tr>); })}
          </tbody>
        </table>
      </div>
      <div className="row between wrap" style={{ alignItems: 'center' }}>
        <span className="apoio muted">Origem: {origem}{escolhida ? ' (escolhida por você)' : ''}</span>
        <div className="row" style={{ gap: 8 }}>
          <Kpi doc="tiros" conf={CONF_ORIGEM[origem] || null} value={T.rotulo} band={T.regularidadePct != null ? 'variação de ' + dec(T.regularidadePct, 1) + '% entre os tiros' : undefined} className="link-kpi" label="Sobre os tiros"><Conf level={CONF_ORIGEM[origem] || null} /></Kpi>
          <button type="button" className="btn" onClick={abrirTrocar}>Trocar origem</button>
        </div>
      </div>
      {trocar ? (
        <Sheet title="Origem dos tiros" onClose={() => setTrocar(null)}>
          <p className="apoio muted">Escolha de onde vêm os tiros deste treino. Os outros números não mudam.</p>
          <div className="stack" role="radiogroup" aria-label="Origem dos tiros">
            {trocar.map((o) => {
              const cur = (escolhida || '') === o.k || (!escolhida && ORIGENS[o.k] === origem) || (!escolhida && o.k === 'voltas' && /voltas/.test(origem));
              return <button key={o.k} type="button" role="radio" aria-checked={cur} className={'btn quiet' + (cur ? ' on' : '')} disabled={!o.rotulo} onClick={async () => { await trocarOrigem(w.id, o.k); setTrocar(null); }}>
                {o.k === 'nenhum' ? 'Não são tiros' : ORIGENS[o.k].replace(/^./, (c) => c.toUpperCase())}<span className="muted">{o.k === 'nenhum' ? '' : o.rotulo ? ' · ' + o.rotulo : ' · não se aplica'}</span>
              </button>;
            })}
          </div>
          {escolhida ? <button type="button" className="btn" onClick={async () => { await trocarOrigem(w.id, null); setTrocar(null); }}>Voltar ao automático</button> : null}
        </Sheet>
      ) : null}
    </Card>
  );
}

// ---------------- 6. melhores esforços ----------------
export function SeloEsforco({ tipo }: { tipo: 'pr' | 'ciclo' }) {
  return tipo === 'pr'
    ? <span className="selo pr"><svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d="M4 0 8 4 4 8 0 4Z" fill="currentColor" /></svg>Recorde pessoal</span>
    : <span className="selo ciclo">Melhor do ciclo</span>;
}
export function EsforcosCard({ w, st, tr, onPick }: { w: any; st: any; tr: Track | null; onPick?: (i: number, fim?: number) => void }) {
  const [todos, setTodos] = useState(false);
  const e = w.leitura && w.leitura.esforcos;
  if (!e) return null;
  const s = selos(w, st.workouts, st.race && st.race.startDate ? st.race.startDate : null);
  const ks = DISTANCIAS.map(String).filter((k) => e[k]);
  const comSelo = ks.filter((k) => s[k]);
  const lista = (todos ? ks.slice() : [...comSelo, ...ks.filter((k) => !s[k])].slice(0, 4)).sort((a, b) => +a - +b);
  const pr = ks.filter((k) => s[k] === 'pr').sort((a, b) => +b - +a)[0];
  const ci = ks.filter((k) => s[k] === 'ciclo').sort((a, b) => +b - +a)[0];
  const titulo = pr ? 'Novo recorde nos ' + ROTULO[pr] : ci ? 'Melhor do ciclo nos ' + ROTULO[ci] : 'Seus trechos mais rápidos';
  const comparados = st.workouts.filter((o: any) => o.leitura && o.leitura.esforcos).length;
  const idx = (t: number) => (tr ? idxT(tr, t) : null);
  return (
    <Card>
      <SecH tema="Melhores esforços" titulo={titulo} icon={<IconTrophy size={14} stroke={1.75} aria-hidden="true" />} />
      <ul className="esforcos">
        {lista.map((k) => { const x = e[k], i = idx(x.ini); const p = x.t / (+k / 1000); const body = (<>
          <span className="d">{ROTULO[k]}</span><span className="t tn">{tempo(x.t)}</span><span className="p tn muted">{pc(p)}/km</span>{s[k] ? <SeloEsforco tipo={s[k]} /> : <span />}
        </>); return <li key={k}>{onPick && i != null ? <button type="button" onClick={() => onPick(i, idx(x.fim) ?? undefined)} aria-label={ROTULO[k] + ' em ' + tempo(x.t) + (s[k] === 'pr' ? ', recorde pessoal' : s[k] === 'ciclo' ? ', melhor do ciclo' : '') + '. Destacar no mapa'}>{body}</button> : <div>{body}</div>}</li>; })}
      </ul>
      {ks.length > 4 ? <button type="button" className="link" onClick={() => setTodos(!todos)} aria-expanded={todos}>{todos ? 'Ver menos' : 'Ver todos (' + ks.length + ')'}</button> : null}
      <div className="row between wrap" style={{ alignItems: 'center' }}>
        <p className="hint" style={{ margin: 0 }}>Compara com o ciclo atual e com {comparados} treino{comparados === 1 ? '' : 's'} com trajeto.</p>
        <Kpi doc="melhor-esforco" className="link-kpi" label="Sobre o melhor esforço">O que é</Kpi>
      </div>
    </Card>
  );
}

// ---------------- 7. custo da subida ----------------
export const COR_FAIXA = ['var(--zona-2)', 'var(--zona-1)', 'var(--texto-3)', 'var(--zona-4)', 'var(--zona-5)'];
export const custoTxt = (s: number) => (Math.abs(s) >= 60 ? (s < 0 ? '−' : '+') + E.paceStr(Math.abs(s)) : (s < 0 ? '−' : '+') + Math.round(Math.abs(s)) + ' s') + '/km';
export function tituloSubida(S: any): string {
  if (!S) return '';
  if (!S.titulo) return 'Treino plano: a inclinação quase não pesou';
  const f = S.titulo.faixa === '> 5%' ? 'acima de 5%' : 'de ' + S.titulo.faixa;
  return 'Subidas ' + f + ' custaram ' + custoTxt(S.titulo.custoSkm);
}
export function SubidaCard({ w }: { w: any }) {
  const S = w.leitura && w.leitura.subida;
  if (!S || E.isBike(w) || w.indoor) return null;
  const tot = S.faixas.reduce((s: number, f: any) => s + f.tS, 0) || 1;
  const g0 = E.computeGap(w);
  return (
    <Card>
      <SecH tema="Custo da subida" titulo={tituloSubida(S)} icon={<IconMountain size={14} stroke={1.75} aria-hidden="true" />} />
      <div className="stackbar" role="img" aria-label={'Tempo por faixa de inclinação: ' + S.faixas.map((f: any) => f.faixa + ' ' + dec(f.tS / 60, 1) + ' min').join(', ')}>
        {S.faixas.map((f: any, k: number) => f.tS > 0 ? <i key={k} style={{ width: (f.tS / tot) * 100 + '%', background: COR_FAIXA[k] }} /> : null)}
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th scope="col">Faixa</th><th scope="col" className="n">Tempo</th><th scope="col" className="n">Real</th><th scope="col" className="n">GAP</th><th scope="col" className="n">FC</th></tr></thead>
          <tbody>
            {S.faixas.map((f: any, k: number) => (
              <tr key={k}>
                <td><span className="sw" style={{ background: COR_FAIXA[k] }} aria-hidden="true" />{f.faixa}</td>
                <td className="n">{f.tS ? dec(f.tS / 60, 1) + ' min' : '—'}</td><td className="n">{pc(f.paceSkm)}</td><td className="n">{pc(f.gapSkm)}</td><td className="n">{f.hr || '—'}</td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="row between wrap" style={{ alignItems: 'center' }}>
        <p className="hint" style={{ margin: 0 }}>Pace real × pace equivalente no plano (GAP). A diferença é o custo de cada faixa.</p>
        <Kpi doc="custo-subida" conf={g0 ? g0.confidence : null} className="link-kpi" label="Sobre o custo da subida">O que é</Kpi>
      </div>
    </Card>
  );
}

// ---------------- 2. vento: chip ----------------
export function VentoChip({ v }: { v: any }) {
  if (!v) return null;
  if (v.fraco) return <span className="chip-info on-map">Vento fraco</span>;
  const para = (v.de + 180) % 360;
  return (
    <Kpi doc="vento" value={'Vento ' + Math.round(v.kmh) + ' km/h'} band={'a favor ' + v.aFavorPct + '% do tempo · contra ' + v.contraPct + '%' + (v.custoContraSkm ? ' · trechos contra ≈ +' + v.custoContraSkm + ' s/km' : '')} conf="Baixa" className="chip-info on-map" label={'Vento de ' + Math.round(v.kmh) + ' km/h, soprando para ' + rumoNome(para)}>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: 'rotate(' + para + 'deg)' }}><path d="M12 3v18M12 3l-6 6M12 3l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Vento {Math.round(v.kmh)} km/h
    </Kpi>
  );
}
function rumoNome(g: number) { return ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'][Math.round(g / 45) % 8]; }

// início da deriva: índice do trajeto onde começa o km
export function idxDoKm(tr: Track, km: number): number | null {
  const alvo = (km - 1) * 1000;
  for (let i = 0; i < tr.dist.length; i++) { const d = tr.dist[i]; if (d != null && d >= alvo) return i; }
  return null;
}
export const leituraDe = (id: string) => { const w = getState().workouts.find((x: any) => x.id === id); return w && w.leitura; };
export { kmTxt };

// ---------------- Progresso: melhores esforços no período + curva da subida ----------------

function useSemLeitura(runs: any[]) {
  const [n, setN] = useState<{ comTrajeto: number; semTrajeto: number }>({ comTrajeto: 0, semTrajeto: 0 });
  const chave = runs.map((w) => w.id + (w.leitura && w.leitura.v ? '1' : '0')).join(',');
  useEffect(() => {
    let vivo = true;
    trackIds().then((ids) => { if (!vivo) return; setN({ comTrajeto: runs.filter((w) => !(w.leitura && w.leitura.v) && ids.has(w.id)).length, semTrajeto: runs.filter((w) => !ids.has(w.id) && w.garminActivityId && !(w.leitura && w.leitura.esforcos)).length }); }).catch(() => {});
    return () => { vivo = false; };
  }, [chave]);
  return n;
}

export function EsforcosProgresso({ runs, todas, recorte, st }: { runs: any[]; todas: any[]; recorte: boolean; st: any }) {
  const aqui = melhoresDoPeriodo(runs), sempre = melhoresDoPeriodo(todas);
  const falta = useSemLeitura(runs);
  const gs = useGarminSync();
  const [busy, setBusy] = useState(false);
  const ks = DISTANCIAS.map(String).filter((k) => aqui[k]);
  const ciclo = st.race && st.race.startDate ? st.race.startDate : null;
  const calcular = async () => { setBusy(true); try { const n = await recalcularLeitura(runs.map((w) => w.id)); toast(n + ' treino' + (n === 1 ? '' : 's') + ' com leitura calculada. Nenhum outro número mudou.'); } finally { setBusy(false); } };
  const buscar = async () => { setBusy(true); try { const r = await buscarTrajetos(runs.map((w) => w.id)); toast(r && r.ok ? r.ok + ' trajeto' + (r.ok === 1 ? '' : 's') + ' adicionado' + (r.ok === 1 ? '' : 's') + '.' : 'Não deu para buscar agora. Tente de novo mais tarde.'); } finally { setBusy(false); } };
  return (<>
    <div className="stack" style={{ gap: 2 }}>
      <span className="cap row" style={{ gap: 6 }}><IconTrophy size={14} stroke={1.75} aria-hidden="true" />Melhores esforços</span>
      <h2 className="lead">{ks.length ? 'Seus trechos mais rápidos no período' : 'Sem melhores esforços no período'}</h2>
    </div>
    {ks.length ? (
      <ul className="esforcos">
        {ks.map((k) => { const x = aqui[k], b = sempre[k]; const nK = todas.filter((o: any) => o.leitura && o.leitura.esforcos && o.leitura.esforcos[k]).length; const pr = nK >= 2 && b && b.id === x.id; const doCiclo = !pr && nK >= 2 && ciclo && x.date >= ciclo;
          return <li key={k}><a href={href('treino', x.id)} style={{ textDecoration: 'none' }} className="esf-row">
            <span className="d">{ROTULO[k]}</span>
            <span className="stack" style={{ gap: 0 }}><span className="t tn">{tempo(x.t)}</span><span className="p tn muted">{pc(x.t / (+k / 1000))}/km · {dayMon(x.date)}{recorte && !pr && b ? ' · seu melhor ' + tempo(b.t) : ''}</span></span>
            {pr ? <SeloEsforco tipo="pr" /> : doCiclo ? <SeloEsforco tipo="ciclo" /> : <span />}
          </a></li>; })}
      </ul>
    ) : null}
    <p className="hint">Só entram treinos com o trajeto salvo neste aparelho ou calculados em outro.</p>
    {falta.comTrajeto ? <button type="button" className="btn" disabled={busy} onClick={calcular}>{busy ? 'Calculando…' : 'Calcular a leitura de ' + falta.comTrajeto + ' treino' + (falta.comTrajeto === 1 ? '' : 's') + ' com trajeto'}</button> : null}
    {falta.semTrajeto ? (garminReady()
      ? <button type="button" className="btn quiet" disabled={busy || gs.rodando} onClick={buscar}>{gs.rodando ? 'Buscando ' + gs.feito + ' de ' + gs.total + '…' : 'Buscar trajeto de ' + falta.semTrajeto + ' treino' + (falta.semTrajeto === 1 ? '' : 's') + ' no Garmin'}</button>
      : <p className="hint">{falta.semTrajeto} treino{falta.semTrajeto === 1 ? '' : 's'} do Garmin sem trajeto neste aparelho: os esforços deles não entram.</p>) : null}
    <Kpi doc="melhor-esforco" className="link-kpi" label="Sobre o melhor esforço">O que é o melhor esforço</Kpi>
  </>);
}

export function CurvaSubida({ runs }: { runs: any[] }) {
  const c = curvaSubida(runs);
  const tem = c.some((x) => x.custoSkm != null);
  const sub = [c[4], c[3]].filter((x) => x.custoSkm != null).sort((a, b) => (b.custoSkm as number) - (a.custoSkm as number))[0];
  const titulo = !tem ? 'Ainda sem treinos suficientes' : sub ? 'Nas subidas de ' + (sub.faixa === '> 5%' ? 'mais de 5%' : sub.faixa) + ', você perde ' + custoTxt(sub.custoSkm as number) : 'Subidas curtas demais no período';
  const max = Math.max(1, ...c.map((x) => Math.abs(x.custoSkm || 0)));
  return (<>
    <div className="stack" style={{ gap: 2 }}>
      <span className="cap row" style={{ gap: 6 }}><IconMountain size={14} stroke={1.75} aria-hidden="true" />Custo da subida · sua curva</span>
      <h2 className="lead">{titulo}</h2>
    </div>
    <div className="list" role="list">
      {c.map((x, k) => (
        <div key={k} className="item-row" role="listitem">
          <span style={{ width: 92 }}><span className="sw" style={{ background: COR_FAIXA[k] }} aria-hidden="true" />{x.faixa}</span>
          <span className="grow" aria-hidden="true">{x.custoSkm != null ? <span className="bar" style={{ display: 'block', height: 6 }}><i style={{ width: (Math.abs(x.custoSkm) / max) * 100 + '%', background: COR_FAIXA[k] }} /></span> : null}</span>
          <b className="tn" style={{ fontWeight: 500, minWidth: 88, textAlign: 'right' }}>{x.custoSkm != null ? custoTxt(x.custoSkm) : '—'}</b>
          <span className="s tn" style={{ minWidth: 72, textAlign: 'right' }}>{x.custoSkm != null ? x.n + ' treinos' : 'faltam ' + Math.max(0, 3 - x.n)}</span>
        </div>))}
    </div>
    <p className="hint">Mediana da diferença entre o pace real e o GAP em cada faixa, nos treinos do período com 3 min ou mais nela. Precisa de 3 treinos por faixa.</p>
    <Kpi doc="custo-subida" className="link-kpi" label="Sobre o custo da subida">O que é o custo da subida</Kpi>
  </>);
}
