// CICLO DE PROVA › EDITAR e PERCURSO DA PROVA (Fase 4 · Etapa 2; design/telas-fase4/EditarCiclo,
// PercursoVazio e Percurso). Campos novos do ciclo são opcionais e aditivos: goal "time",
// targetSec, strategy, startTime e course. Ciclos antigos abrem como antes.
import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { IconCheck, IconAlertCircle, IconFileUpload, IconArrowUp, IconArrowDown, IconTrash, IconRoute, IconChevronRight, IconChevronDown, IconMountain } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex, commit, getState, toast } from '../store';
import { href, go } from '../route';
import { PageHead } from '../Shell';
import { Card, Sheet, Empty, IC } from '../ui';
import { dec, noEmoji } from '../fmt';
import { juntaPartes, ordemPadrao, reamostra, comparaOficial, montaCourse, perfilDigitado, MAX_PARTES, SALTO_AVISO_M } from '../../percurso.mjs';
import { lerArquivo, salvarCourse, removerCourse, trackDoCourse, resumo, FONTE_ROTULO, type ParteLida } from '../course';
import { TrackSvg } from '../map/TrackSvg';

const RuasMap = lazy(() => import('../map/RuasMap').then((m) => ({ default: m.RuasMap })));

// ---------------- utilidades ----------------
const kmTxt = (x: number, n = 2) => dec(x, n);
const pct = (x: number | null | undefined) => (x == null ? '—' : (x > 0 ? '+' : x < 0 ? '−' : '') + dec(Math.abs(x), 1) + '%');
export function hhmm(sec: number | null | undefined): string { if (sec == null || !(sec > 0)) return ''; const m = Math.round(sec / 60); return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }
export function parseHhmm(s: string): number | null { const m = /^\s*(\d{1,2})\s*[:h]\s*(\d{1,2})\s*$/.exec(s || ''); if (!m || +m[2] > 59) return null; const v = (+m[1] * 60 + +m[2]) * 60; return v > 0 ? v : null; }
export function metaTxt(sec: number): string { const m = Math.round(sec / 60); return Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0'); }
function Conf({ c }: { c: string }) {
  const baixa = /baixa/i.test(c);
  return <span className="conf-fonte" style={{ color: baixa ? 'var(--atencao)' : 'var(--ok)' }}>{baixa ? <IconAlertCircle size={14} stroke={2} aria-hidden="true" /> : <IconCheck size={14} stroke={2} aria-hidden="true" />}Confiança {c.toLowerCase()}</span>;
}

// ---------------- Editar ciclo ----------------
export function EditarCiclo() {
  const { st } = useApex();
  const race = st.race;
  const [f, setF] = useState(() => ({
    name: race?.name || '', date: race?.date || '', start: race?.startDate || '', hora: race?.startTime || '06:00',
    dist: race?.distKm ? String(race.distKm).replace('.', ',') : '', goal: (race?.goal === 'time' ? 'time' : 'finish') as 'finish' | 'time',
    alvo: hhmm(race?.targetSec), strategy: (race?.strategy === 'negativa' ? 'negativa' : 'constante') as 'constante' | 'negativa',
    long: String(race?.longRunTargetKm || ''), peak: String(race?.peakKmTarget || ''),
  }));
  const [mais, setMais] = useState(false);
  if (!race) return (<><PageHead title="Editar ciclo" back={href('mais', 'maratona')} /><Card><Empty>Nenhum ciclo ativo. Comece um em Configurações › Novo ciclo de prova.</Empty></Card></>);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const dist = parseFloat(String(f.dist).replace(',', '.'));
  const alvoSec = parseHhmm(f.alvo);
  const paceMedio = alvoSec && dist > 0 ? E.paceStr(alvoSec / dist) : null;
  const course = race.course, res = course ? resumo(course) : null;

  const salvar = () => {
    if (f.date && f.start && f.start > f.date) { alert('O início do ciclo não pode ser depois da data da prova.'); return; }
    if (f.goal === 'time' && !alvoSec) { alert('Digite o tempo-alvo em h:mm, por exemplo 1:30.'); return; }
    if (!/^\d{2}:\d{2}$/.test(f.hora)) { alert('Digite o horário da largada em hh:mm.'); return; }
    const S = getState(); const r: any = S.race; if (!r) return;
    r.name = (f.name || 'Prova').trim(); if (f.date) r.date = f.date; if (f.start) r.startDate = f.start;
    if (dist > 0) r.distKm = dist;
    const lr = parseFloat(f.long), pk = parseFloat(f.peak);
    if (lr > 0) r.longRunTargetKm = lr; if (pk > 0) r.peakKmTarget = pk;
    // Fase 4 (campos novos e opcionais)
    r.startTime = f.hora; r.goal = f.goal; r.strategy = f.strategy;
    if (f.goal === 'time') r.targetSec = alvoSec; else delete r.targetSec;
    r.updatedAt = new Date().toISOString(); commit(); toast('Ciclo salvo'); go('mais', 'maratona');
  };

  return (<>
    <PageHead title="Editar ciclo" back={href('mais', 'maratona')} />
    <section className="form-grid ciclo-grid" aria-label="Prova">
      <div className="field full"><label htmlFor="c_nome">Nome da prova</label><input id="c_nome" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
      <div className="field"><label htmlFor="c_data">Data da prova</label><input id="c_data" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
      <div className="field"><label htmlFor="c_hora">Horário da largada</label><input id="c_hora" type="time" value={f.hora} onChange={(e) => set('hora', e.target.value)} /></div>
      <div className="field"><label htmlFor="c_inicio">Início do ciclo</label><input id="c_inicio" type="date" value={f.start} onChange={(e) => set('start', e.target.value)} /></div>
      <div className="field"><label htmlFor="c_dist">Distância (km)</label><input id="c_dist" inputMode="decimal" value={f.dist} onChange={(e) => set('dist', e.target.value)} /></div>
    </section>

    <fieldset className="grupo">
      <legend>Objetivo</legend>
      <div className="seg full" role="radiogroup" aria-label="Objetivo">
        {([['finish', 'Terminar bem'], ['time', 'Tempo-alvo']] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={f.goal === k} onClick={() => set('goal', k)}>{l}</button>)}
      </div>
      {f.goal === 'time' ? (
        <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
          <div className="field" style={{ width: 120 }}><label htmlFor="c_alvo">Tempo-alvo (h:mm)</label><input id="c_alvo" inputMode="numeric" placeholder="h:mm" value={f.alvo} onChange={(e) => set('alvo', e.target.value)} style={{ fontSize: 18 }} className="tn" /></div>
          <span className="apoio tn" aria-live="polite" style={{ paddingBottom: 10 }}>{paceMedio ? 'pace médio ' + paceMedio + '/km' : f.alvo ? 'use h:mm' : ''}</span>
        </div>
      ) : null}
      <span className="hint">Em "Terminar bem", o plano vai usar a ponta mais lenta do seu tempo realista. O simulador de meta chega numa próxima etapa.</span>
    </fieldset>

    <fieldset className="grupo">
      <legend>Estratégia</legend>
      {([['constante', 'Esforço constante', 'O mesmo esforço do início ao fim: mais lento nas subidas, mais rápido nas descidas.'],
        ['negativa', 'Segunda metade mais rápida', 'Começa mais contido e acelera depois da metade, no mesmo tempo final.']] as const).map(([k, t, d]) => (
        <label key={k} className={'opcao' + (f.strategy === k ? ' on' : '')}>
          <input type="radio" name="estrategia" checked={f.strategy === k} onChange={() => set('strategy', k)} />
          <span className="stack" style={{ gap: 2 }}><span className="t">{t}</span><span className="apoio muted">{d}</span></span>
        </label>
      ))}
    </fieldset>

    <fieldset className="grupo">
      <legend>Percurso</legend>
      <a className="item-row opcao-link" href={href('mais', 'percurso')}>
        <IconRoute {...IC} color="var(--ciano)" aria-hidden="true" />
        <span className="grow stack" style={{ gap: 0 }}>
          {course && res ? <><b style={{ fontWeight: 500 }}>{FONTE_ROTULO[course.fonte]}</b><span className="s tn">{kmTxt(res.km)} km · D+ {res.dMais} m · confiança {String(course.confianca).toLowerCase()}</span></>
            : <><b style={{ fontWeight: 500 }}>Sem percurso</b><span className="s">Sem percurso, o plano sai só por ritmo, sem as subidas.</span></>}
        </span>
        <span className="link">{course ? 'Ver' : 'Adicionar'}</span>
      </a>
    </fieldset>

    <div className="grupo">
      <button type="button" className="acc-btn" aria-expanded={mais} aria-controls="c_mais" onClick={() => setMais(!mais)}>
        {mais ? <IconChevronDown size={18} stroke={1.75} color="var(--ciano)" aria-hidden="true" /> : <IconChevronRight size={18} stroke={1.75} color="var(--ciano)" aria-hidden="true" />}Mais metas do ciclo (longão e volume)
      </button>
      {mais ? <div id="c_mais" className="form-grid">
        <div className="field"><label htmlFor="c_long">Meta de longão (km)</label><input id="c_long" inputMode="decimal" value={f.long} onChange={(e) => set('long', e.target.value)} /></div>
        <div className="field"><label htmlFor="c_peak">Pico de volume (km/sem)</label><input id="c_peak" inputMode="decimal" value={f.peak} onChange={(e) => set('peak', e.target.value)} /></div>
      </div> : null}
    </div>

    <button type="button" className="btn-primary" onClick={salvar}>Salvar ciclo</button>
  </>);
}

// ---------------- Percurso da prova ----------------
type Fonte = 'gpx' | 'gravacao' | 'digitada';
type Pendente = { fonte: Fonte; partes: ParteLida[]; ordem: number[] } | null;

export function Percurso() {
  const { st } = useApex();
  const race = st.race;
  const [trocar, setTrocar] = useState(false);
  if (!race) return (<><PageHead title="Percurso da prova" back={href('mais', 'maratona')} /><Card><Empty>Nenhum ciclo ativo.</Empty></Card></>);
  if (race.course && !trocar) return <PercursoImportado race={race} onTrocar={() => setTrocar(true)} />;
  return <PercursoEscolha race={race} onCancel={race.course ? () => setTrocar(false) : null} onDone={() => setTrocar(false)} />;
}

function PercursoEscolha({ race, onCancel, onDone }: { race: any; onCancel: (() => void) | null; onDone: () => void }) {
  const [fonte, setFonte] = useState<Fonte>('gpx');
  const [pend, setPend] = useState<Pendente>(null);
  const [perg, setPerg] = useState<{ diffPct: number; salvar: (ajustar: boolean) => void } | null>(null);
  const [digitar, setDigitar] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const kmOf = race.distKm || null;

  const abrir = () => { if (fonte === 'digitada') { setDigitar(true); return; } fileRef.current?.click(); };
  const ler = async (files: FileList | null) => {
    const list = files ? Array.from(files) : []; if (!list.length) return;
    if (fonte === 'gpx' && list.length > 1) { alert('Escolha um arquivo GPX só.'); return; }
    if (list.length > MAX_PARTES) { alert('No máximo ' + MAX_PARTES + ' partes.'); return; }
    setBusy('Lendo ' + list.length + (list.length > 1 ? ' arquivos…' : ' arquivo…'));
    try {
      const partes: ParteLida[] = [];
      for (const f of list) partes.push(await lerArquivo(f));
      if (!partes.every((p) => p.temAltitude)) throw new Error('Um dos arquivos não tem altitude. Sem altitude, o plano não enxerga as subidas.');
      setPend({ fonte, partes, ordem: ordemPadrao(partes) });
    } catch (e: any) { alert(e && e.message ? e.message : String(e)); }
    finally { setBusy(null); }
  };
  const concluir = (p: NonNullable<Pendente>) => {
    const tr = juntaPartes(p.partes, p.ordem);
    const perfil = reamostra(tr);
    const cmp = comparaOficial(tr.kmTotal, kmOf);
    const partesInfo = p.ordem.map((i) => ({ data: p.partes[i].data, esporte: p.partes[i].esporte, km: Math.round(p.partes[i].km * 100) / 100 }));
    const baro = p.fonte === 'gravacao' && p.partes.every((x) => x.baro);
    const salvar = (ajustar: boolean) => {
      const { course } = montaCourse({ fonte: p.fonte, perfilBruto: perfil, partesInfo, kmOficiais: kmOf, ajustar, baro });
      salvarCourse(course); setPend(null); setPerg(null);
      toast(course.ajustado && course.diffPct ? 'Percurso salvo e ajustado à distância oficial (' + pct(course.diffPct) + ').' : 'Percurso salvo.');
      onDone();
    };
    if (cmp.pergunta) setPerg({ diffPct: cmp.diffPct as number, salvar }); else salvar(true);
  };

  if (digitar) return <PercursoDigitado race={race} onCancel={() => setDigitar(false)} onDone={onDone} />;
  if (pend) return <RevisaoPartes p={pend} kmOf={kmOf} onOrdem={(ordem) => setPend({ ...pend, ordem })} onCancel={() => setPend(null)} onOk={() => concluir(pend)} perg={perg} onPerg={setPerg} />;
  const OPC: [Fonte, string, string, string][] = [
    ['gpx', 'Arquivo da prova', 'Alta', 'O GPX que o site da prova oferece, ou exportado do Strava ou do Garmin Connect pelo navegador.'],
    ['gravacao', 'Reconhecimento gravado', 'Moderada ou baixa', 'Grave o percurso de bike ou caminhando, em até 4 partes (.FIT ou GPX). O app junta na ordem. Com altímetro barométrico, a confiança é moderada.'],
    ['digitada', 'Digitar a altimetria', 'Baixa', 'Subida e descida de cada km, copiadas do site oficial. Você informa a fonte.'],
  ];
  return (<>
    <PageHead title="Percurso da prova" back={href('mais', 'ciclo')} />
    <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" accept={fonte === 'gpx' ? '.gpx,application/gpx+xml' : '.fit,.FIT,.gpx,application/octet-stream,application/gpx+xml'} multiple={fonte === 'gravacao'} onChange={(e) => { ler(e.target.files); e.target.value = ''; }} />
    <div className="stack" style={{ gap: 6 }}>
      <h2 className="titulo-2">Com o percurso, o plano ajusta o pace a cada subida.</h2>
      <p className="apoio muted">Escolha de onde ele vem. Quanto mais confiável a fonte, melhor o plano.</p>
    </div>
    <fieldset className="grupo" role="radiogroup" aria-label="Fonte do percurso">
      <legend className="sr-only">Fonte do percurso</legend>
      {OPC.map(([k, t, c, d]) => (
        <label key={k} className={'opcao' + (fonte === k ? ' on' : '')}>
          <input type="radio" name="fonte" checked={fonte === k} onChange={() => setFonte(k)} />
          <span className="stack grow" style={{ gap: 4 }}>
            <span className="row between" style={{ alignItems: 'baseline', gap: 8 }}><span className="t">{t}</span><Conf c={c} /></span>
            <span className="apoio muted">{d}</span>
          </span>
        </label>
      ))}
    </fieldset>
    {kmOf ? <p className="hint">Distância oficial do ciclo: {kmTxt(kmOf, 3)} km. Diferença de até 2%: o app ajusta e avisa. Acima disso, pergunta antes.</p> : null}
    <div className="stack" style={{ gap: 4 }}>
      <button type="button" className="btn-primary" onClick={abrir} disabled={!!busy}><IconFileUpload size={20} stroke={1.75} aria-hidden="true" />{busy || (fonte === 'digitada' ? 'Digitar altimetria' : 'Importar percurso')}</button>
      {onCancel ? <button type="button" className="btn quiet" onClick={onCancel}>Manter o percurso atual</button>
        : <a className="btn quiet" href={href('mais', 'ciclo')}>Seguir sem percurso</a>}
    </div>
  </>);
}

function RevisaoPartes({ p, kmOf, onOrdem, onCancel, onOk, perg, onPerg }: { p: NonNullable<Pendente>; kmOf: number | null; onOrdem: (o: number[]) => void; onCancel: () => void; onOk: () => void; perg: any; onPerg: (x: any) => void }) {
  const tr = useMemo(() => juntaPartes(p.partes, p.ordem), [p]);
  const cmp = comparaOficial(tr.kmTotal, kmOf || 0);
  const mover = (k: number, dir: -1 | 1) => { const o = p.ordem.slice(); const j = k + dir; if (j < 0 || j >= o.length) return; [o[k], o[j]] = [o[j], o[k]]; onOrdem(o); };
  const baro = p.partes.every((x) => x.baro);
  return (<>
    <PageHead title="Conferir o percurso" back={href('mais', 'percurso')} />
    <Card>
      <h2 className="lead">{p.partes.length > 1 ? p.partes.length + ' partes, na ordem do horário de início' : 'Arquivo lido'}</h2>
      <ol className="list partes" aria-label="Partes do percurso">
        {p.ordem.map((i, k) => { const x = p.partes[i]; return (
          <li key={i} className="item-row">
            <span className="grow stack" style={{ gap: 0 }}><b style={{ fontWeight: 500 }}>Parte {k + 1}{x.data ? ' · ' + x.data.split('-').reverse().slice(0, 2).join('/') : ''} · {x.esporte}</b><span className="s">{x.arquivo}{x.baro ? ' · com barômetro' : ''}</span></span>
            <b className="tn">{kmTxt(x.km)} km</b>
            {p.partes.length > 1 ? <span className="row" style={{ gap: 0 }}>
              <button type="button" className="iconbtn" aria-label={'Subir a parte ' + (k + 1)} disabled={k === 0} onClick={() => mover(k, -1)}><IconArrowUp size={18} stroke={1.75} /></button>
              <button type="button" className="iconbtn" aria-label={'Descer a parte ' + (k + 1)} disabled={k === p.ordem.length - 1} onClick={() => mover(k, 1)}><IconArrowDown size={18} stroke={1.75} /></button>
            </span> : null}
          </li>); })}
      </ol>
      <p className="apoio tn">Total gravado: <b>{kmTxt(tr.kmTotal)} km</b>{kmOf ? <> · oficial: {kmTxt(kmOf, 3)} km ({pct(cmp.diffPct)})</> : null}</p>
      {tr.avisoSalto ? <p className="apoio" style={{ color: 'var(--atencao)' }}><IconAlertCircle size={16} stroke={1.75} aria-hidden="true" style={{ verticalAlign: -3 }} /> Há um buraco de mais de {SALTO_AVISO_M} m entre as partes ({tr.saltos.map((s: any) => s.m + ' m').join(', ')}). O app liga em linha reta.</p> : null}
      {p.fonte === 'gravacao' ? <p className="hint">Confiança: <b>{baro ? 'moderada' : 'baixa'}</b> ({baro ? 'altitude do altímetro barométrico' : 'altitude só do GPS'}).</p> : null}
    </Card>
    <div className="stack" style={{ gap: 4 }}>
      <button type="button" className="btn-primary" onClick={onOk}>Salvar percurso</button>
      <button type="button" className="btn quiet" onClick={onCancel}>Trocar arquivo</button>
    </div>
    {perg ? (
      <Sheet title="Distância diferente da oficial" onClose={() => onPerg(null)}>
        <p className="apoio">O percurso gravado tem <b className="tn">{kmTxt(tr.kmTotal)} km</b> e a prova tem <b className="tn">{kmTxt(kmOf || 0, 3)} km</b>: uma diferença de <b className="tn">{dec(Math.abs(perg.diffPct), 1)}%</b>, acima dos 2% de tolerância.</p>
        <p className="hint">Ajustar estica ou encolhe todo o percurso por igual até a distância oficial. As subidas ficam no mesmo lugar, proporcionalmente.</p>
        <button type="button" className="btn" onClick={() => perg.salvar(true)}>Ajustar mesmo assim</button>
        <button type="button" className="btn quiet" onClick={() => { onPerg(null); onCancel(); }}>Trocar arquivo</button>
      </Sheet>
    ) : null}
  </>);
}

function PercursoDigitado({ race, onCancel, onDone }: { race: any; onCancel: () => void; onDone: () => void }) {
  const n = Math.max(1, Math.ceil((race.distKm || 1) - 1e-9));
  const [fonteTexto, setFonteTexto] = useState('');
  const [kms, setKms] = useState(() => Array.from({ length: n }, () => ({ sobe: '', desce: '' })));
  const set = (i: number, k: 'sobe' | 'desce', v: string) => { const c = kms.slice(); c[i] = { ...c[i], [k]: v.replace(/[^\d]/g, '') }; setKms(c); };
  const salvar = () => {
    if (!fonteTexto.trim()) { alert('Informe a fonte da altimetria (link ou nome do site oficial). Sem fonte, o percurso não é salvo.'); return; }
    const valores = kms.map((k) => ({ sobe: +k.sobe || 0, desce: +k.desce || 0 }));
    try {
      const perfil = perfilDigitado(valores, race.distKm, fonteTexto);
      const { course } = montaCourse({ fonte: 'digitada', perfilBruto: perfil, kmOficiais: race.distKm, fonteTexto: fonteTexto.trim(), digitados: valores });
      salvarCourse(course); toast('Altimetria salva (confiança baixa).'); onDone();
    } catch (e: any) { alert(e && e.message ? e.message : String(e)); }
  };
  return (<>
    <PageHead title="Digitar a altimetria" back={href('mais', 'percurso')} />
    <div className="field"><label htmlFor="d_fonte">Fonte (obrigatória)</label><input id="d_fonte" placeholder="Link ou nome do site oficial" value={fonteTexto} onChange={(e) => setFonteTexto(e.target.value)} aria-required="true" /><span className="help">Confiança sempre baixa: a altimetria digitada não tem o detalhe de um arquivo.</span></div>
    <Card>
      <div className="tbl-wrap">
        <table className="digitar">
          <thead><tr><th scope="col">Km</th><th scope="col" className="n">Subida (m)</th><th scope="col" className="n">Descida (m)</th></tr></thead>
          <tbody>{kms.map((k, i) => (
            <tr key={i}><td>{i + 1}</td>
              <td className="n"><label className="sr-only" htmlFor={'d_s' + i}>Subida do km {i + 1}</label><input id={'d_s' + i} inputMode="numeric" value={k.sobe} onChange={(e) => set(i, 'sobe', e.target.value)} /></td>
              <td className="n"><label className="sr-only" htmlFor={'d_d' + i}>Descida do km {i + 1}</label><input id={'d_d' + i} inputMode="numeric" value={k.desce} onChange={(e) => set(i, 'desce', e.target.value)} /></td></tr>))}
          </tbody>
        </table>
      </div>
    </Card>
    <div className="stack" style={{ gap: 4 }}>
      <button type="button" className="btn-primary" onClick={salvar}>Salvar altimetria</button>
      <button type="button" className="btn quiet" onClick={onCancel}>Voltar</button>
    </div>
  </>);
}

// Perfil do percurso: área --superficie-2, linha --texto-3, trecho mais duro em --atencao a 12%,
// tracejado na metade (e no km 30, se houver)
export function PerfilCourse({ course, height = 120 }: { course: any; height?: number }) {
  const res = resumo(course);
  const kms = res.kms;
  if (!kms.length) return null;
  const tot = res.km, W = 340, H = height, pad = 4;
  // alturas: começo de cada km + fim
  const pts: [number, number][] = [];
  let a = 0; pts.push([0, 0]);
  for (const k of kms) { a += (k.sobe - k.desce); pts.push([k.ate, a]); }
  const ys = pts.map((x) => x[1]), lo = Math.min(...ys), hi = Math.max(...ys), span = Math.max(10, hi - lo);
  const X = (km: number) => (km / tot) * W, Y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad - 14);
  const line = pts.map(([x, y], i) => (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1)).join('');
  const area = line + `L${W} ${H}L0 ${H}Z`;
  const duro = res.duro;
  const marcas = [tot / 2, ...(tot > 32 ? [30] : [])];
  const desc = (duro ? 'Trecho mais duro: do km ' + duro.de + ' ao ' + duro.ate + ', +' + duro.metros + ' m. ' : 'Percurso plano. ') + 'D+ ' + res.dMais + ' m, D− ' + res.dMenos + ' m, em ' + kmTxt(tot) + ' km.';
  return (
    <figure className="perfil" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="chart" style={{ height: H }} role="img" aria-label={'Perfil do percurso. ' + desc}>
        {duro ? <rect x={X(duro.de - 1)} y={0} width={X(duro.ate) - X(duro.de - 1)} height={H} fill="var(--atencao)" fillOpacity={0.12} /> : null}
        <path d={area} fill="var(--superficie-2)" />
        <path d={line} fill="none" stroke="var(--texto-3)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        {marcas.map((m) => <line key={m} x1={X(m)} x2={X(m)} y1={0} y2={H} stroke="var(--texto)" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <figcaption className="row between legend tn"><span>km 0</span><span>{kmTxt(tot / 2, 1)}</span><span>{kmTxt(tot, 1)}</span></figcaption>
    </figure>
  );
}

function PercursoImportado({ race, onTrocar }: { race: any; onTrocar: () => void }) {
  const course = race.course, res = resumo(course);
  const tr = useMemo(() => trackDoCourse(course), [course]);
  const [modo, setModo] = useState<'ruas' | 'trajeto'>('trajeto');
  const duro = res.duro;
  // trecho mais duro destacado no mapa
  const band = useMemo(() => { if (!tr) return () => null; const a = duro ? (duro.de - 1) * 1000 : -1, b = duro ? duro.ate * 1000 : -1; return (i: number) => { const d = tr.dist[i] as number; return duro && d >= a && d <= b ? 1 : 0; }; }, [tr, duro]);
  const PAL = ['var(--ciano)', 'var(--atencao)'];
  const titulo = duro ? 'Trecho mais duro: do km ' + duro.de + ' ao ' + duro.ate + ', +' + duro.metros + ' m' : 'Percurso plano: sem trecho de subida';
  const nota = course.fonte === 'digitada' ? 'Fonte: ' + course.fonteTexto + '. Altimetria digitada km a km.'
    : course.kmOficiais ? 'Gravado: ' + kmTxt(course.kmGravados) + ' km. Oficial: ' + kmTxt(course.kmOficiais, 3) + ' km (' + pct(course.diffPct) + '). ' + (course.ajustado ? (Math.abs(course.diffPct) <= 2 ? 'Dentro da tolerância de 2%, então o percurso foi ajustado à distância oficial.' : 'Acima de 2%: você escolheu ajustar mesmo assim.') : 'Sem ajuste.')
      : 'Gravado: ' + kmTxt(course.kmGravados) + ' km.';
  return (<>
    <PageHead title="Percurso da prova" sub={noEmoji(race.name || 'Prova') + ' · ' + FONTE_ROTULO[course.fonte].toLowerCase()} back={href('mais', 'ciclo')} />
    {tr ? (
      <div className="course-map">
        {modo === 'ruas' ? <Suspense fallback={<div className="trackmap" aria-busy="true" />}><RuasMap tr={tr} band={band} bandKey={'c' + (duro ? duro.de : 0)} cursor={null} onPick={() => {}} palette={PAL} onFail={() => setModo('trajeto')} /></Suspense>
          : <TrackSvg tr={tr} band={band} cursor={null} onPick={() => {}} palette={PAL} />}
        <div className="seg on-map course-seg" role="radiogroup" aria-label="Fundo do mapa">
          {([['ruas', 'Ruas'], ['trajeto', 'Só trajeto']] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={modo === k} onClick={() => setModo(k)}>{l}</button>)}
        </div>
      </div>
    ) : null}
    <Card>
      <div className="grid-4" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
        <div className="stat"><span className="v tn">{kmTxt(res.km, 3)}</span><span className="l">km {course.ajustado || course.fonte === 'digitada' ? '(oficial)' : '(gravado)'}</span></div>
        <div className="stat"><span className="v tn">{res.dMais} m</span><span className="l">subida total (D+)</span></div>
        <div className="stat"><span className="v tn">{res.dMenos} m</span><span className="l">descida total (D−)</span></div>
      </div>
      <h2 className="lead row" style={{ gap: 8 }}><IconMountain size={20} stroke={1.75} color={duro ? 'var(--atencao)' : 'var(--texto-2)'} aria-hidden="true" />{titulo}</h2>
      <PerfilCourse course={course} />
    </Card>
    <Card className="fonte-box">
      <div className="row between" style={{ alignItems: 'baseline' }}><b style={{ fontWeight: 500 }}>{FONTE_ROTULO[course.fonte]}</b><Conf c={course.confianca} /></div>
      <p className="apoio muted tn">{nota}</p>
      {course.fonte === 'gravacao' && course.partes && course.partes.length ? <ul className="list">{course.partes.map((p: any, k: number) => (
        <li key={k} className="item-row"><span className="grow">Parte {k + 1}{p.data ? ' · ' + p.data.split('-').reverse().slice(0, 2).join('/') : ''} · {p.esporte}</span><b className="tn">{kmTxt(p.km)} km</b></li>))}</ul> : null}
    </Card>
    <div className="stack" style={{ gap: 4 }}>
      <a className="btn-primary" href={href('mais', 'plano')}>Ver plano de prova</a>
      <button type="button" className="btn quiet" onClick={onTrocar}><IconRoute size={18} stroke={1.75} aria-hidden="true" />Trocar percurso</button>
      <button type="button" className="btn quiet danger-text" onClick={() => { if (confirm('Remover o percurso deste ciclo?')) removerCourse(); }}><IconTrash size={18} stroke={1.75} aria-hidden="true" />Remover percurso</button>
    </div>
  </>);
}
