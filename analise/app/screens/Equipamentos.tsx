// EQUIPAMENTOS (Fase 5 · Etapa 2; design/telas-fase5/Equipamentos e HojeAvisos). Tênis com nome, km
// atuais e limite (decisão do Lucas); bike com pneus e corrente desde a troca, sem aviso. Os km
// são somados na hora a partir dos treinos (analise/equipamentos.mjs). Catálogo em
// athlete.equipamentos, que sincroniza com o resto.
import { useState } from 'react';
import { IconAlertTriangle, IconPlus, IconPencil, IconShoe, IconBike, IconChevronDown } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex, getState, commit, toast } from '../store';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, Sheet, Kpi } from '../ui';
import { dayMon } from '../fmt';
import { ativos, kmTenis, kmPeca, desdeDe, estado, avisosHoje, comEsteTreino, novoTenis, novaBike, editar, aposentar, troquei, LIMITE_PADRAO, PECAS, type Equip, type Estado } from '../../equipamentos.mjs';

export const hojeIso = () => E.mIsoLocal(new Date());
const kmTxt = (k: number) => Math.round(k).toLocaleString('pt-BR');
const lista = (st: any): Equip[] => (st.athlete && st.athlete.equipamentos) || [];
function gravar(nova: Equip[], msg?: string) {
  const a: any = getState().athlete; a.equipamentos = nova; a.updatedAt = new Date().toISOString(); commit(); if (msg) toast(msg);
}
const ROT_PECA: Record<string, [string, string]> = { pneus: ['Pneus', 'trocados'], corrente: ['Corrente', 'trocada'] };

export function Barra({ km, limite, est }: { km: number; limite: number | null | undefined; est: Estado }) {
  if (!(limite! > 0)) return null;
  const p = Math.min(1, km / limite!);
  return <div className="eq-barra" role="img" aria-label={kmTxt(km) + ' de ' + kmTxt(limite!) + ' km'}><i className={est === 'ok' ? '' : 'atencao'} style={{ width: Math.round(p * 100) + '%' }} /></div>;
}

function FormTenis({ ini, onClose }: { ini: Equip | null; onClose: () => void }) {
  const [nome, setNome] = useState(ini ? ini.nome : '');
  const [kmIni, setKmIni] = useState(ini ? String(ini.kmInicial || 0) : '');
  const [lim, setLim] = useState(ini ? (ini.limiteKm ? String(ini.limiteKm) : '') : String(LIMITE_PADRAO));
  const salvar = () => {
    const n = nome.trim(); if (!n) { alert('Dê um nome ao tênis.'); return; }
    const k = kmIni.trim() ? Number(kmIni.replace(',', '.')) : 0; if (!(k >= 0)) { alert('Os km atuais precisam ser um número, 0 ou mais.'); return; }
    const l = lim.trim() ? Number(lim.replace(',', '.')) : null; if (l != null && !(l > 0)) { alert('O limite precisa ser maior que 0, ou em branco para não ter aviso.'); return; }
    const cur = lista(getState());
    gravar(ini ? editar(cur, ini.id, { nome: n, kmInicial: k, limiteKm: l }) : novoTenis(cur, { nome: n, kmInicial: k, limiteKm: l, hoje: hojeIso() }), ini ? 'Tênis atualizado' : 'Tênis cadastrado: ele passa a vir escolhido nas corridas');
    onClose();
  };
  return (
    <Sheet title={ini ? 'Editar tênis' : 'Novo par'} onClose={onClose}>
      <div className="field"><label htmlFor="eq_nome">Nome</label><input id="eq_nome" value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} placeholder="Como você chama este par" /></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="eq_km">Km atuais</label><input id="eq_km" inputMode="decimal" value={kmIni} onChange={(e) => setKmIni(e.target.value)} placeholder="0" /></div>
        <div className="field"><label htmlFor="eq_lim">Km limite</label><input id="eq_lim" inputMode="decimal" value={lim} onChange={(e) => setLim(e.target.value)} placeholder="Em branco: sem aviso" /></div>
      </div>
      <p className="hint">{ini ? 'Os km atuais são o ponto de partida; as corridas salvas com ele somam a partir de ' + dayMon(ini.criadoEm) + '.' : 'Os km atuais são o ponto de partida; daqui em diante, as corridas salvas com este tênis somam.'} Aviso a partir de 90% do limite.</p>
      <button type="button" className="btn-primary" onClick={salvar}>Salvar</button>
    </Sheet>
  );
}

function CardTenis({ t, ws, onEdit }: { t: Equip; ws: any[]; onEdit: () => void }) {
  const k = kmTenis(t, ws); const est = estado(k.km, t.limiteKm);
  return (
    <Card className={'eq-card' + (est === 'atencao' || est === 'limite' ? ' atencao' : '')}>
      <div className="row between" style={{ alignItems: 'baseline' }}><b className="eq-nome">{t.nome}</b><span className="apoio muted">desde {dayMon(t.criadoEm)}</span></div>
      <div className="row" style={{ alignItems: 'baseline', gap: 6 }}><span className="eq-km tn">{kmTxt(k.km)}</span><span className="apoio muted">{t.limiteKm ? 'de ' + kmTxt(t.limiteKm) + ' km' : 'km'}</span></div>
      <Barra km={k.km} limite={t.limiteKm} est={est} />
      {est === 'limite' ? <span className="eq-est"><IconAlertTriangle size={16} stroke={1.75} aria-hidden="true" />Chegou ao limite: hora de trocar o par.</span>
        : est === 'atencao' ? <span className="eq-est"><IconAlertTriangle size={16} stroke={1.75} aria-hidden="true" />Perto do limite: faltam {kmTxt(t.limiteKm! - k.km)} km.</span>
        : !t.limiteKm ? <span className="apoio muted">Sem limite: sem aviso.</span> : null}
      <div className="row between eq-pe">
        <span className="apoio muted tn">Corridas com ele: {k.corridas}</span>
        <span className="row" style={{ gap: 4 }}>
          <button type="button" className="link-btn" onClick={onEdit}><IconPencil size={16} stroke={1.75} aria-hidden="true" />Editar</button>
          <button type="button" className="link-btn" onClick={() => { if (confirm('Aposentar "' + t.nome + '"? Ele sai da escolha nas corridas e vai para Aposentados, com o histórico.')) gravar(aposentar(lista(getState()), t.id, hojeIso()), 'Tênis aposentado'); }}>Aposentar</button>
        </span>
      </div>
    </Card>
  );
}

export function Equipamentos() {
  const { st } = useApex();
  const L = lista(st); const ws = st.workouts;
  const tenis = ativos(L, 'tenis'), bikes = ativos(L, 'bike');
  const velhos = L.filter((e) => e.tipo === 'tenis' && e.aposentado);
  const [form, setForm] = useState<{ ini: Equip | null } | null>(null);
  const trocas = bikes.flatMap((b) => PECAS.flatMap((p) => ((b.pecas && b.pecas[p] && b.pecas[p].trocas) || []).slice(0, -1).map((d) => ({ p, d }))));
  return (<>
    <PageHead title="Equipamentos" back={href('mais')} />
    <section className="stack" style={{ gap: 12 }} aria-labelledby="h-tenis">
      <h2 id="h-tenis" className="lead">Tênis</h2>
      {tenis.length ? tenis.map((t) => <CardTenis key={t.id} t={t} ws={ws} onEdit={() => setForm({ ini: t })} />)
        : <Card><p className="apoio">Nenhum tênis cadastrado. Informe o nome, os km atuais e o limite: daí em diante, as corridas somam sozinhas.</p></Card>}
      <button type="button" className="btn-primary" onClick={() => setForm({ ini: null })}><IconPlus size={18} stroke={2} aria-hidden="true" />Novo par</button>
      <span className="hint">O novo par passa a vir escolhido nas próximas corridas. O antigo continua até você aposentar.</span>
    </section>
    <section className="stack" style={{ gap: 12 }} aria-labelledby="h-bike">
      <h2 id="h-bike" className="lead">Bike</h2>
      {bikes.length ? bikes.map((b) => (
        <Card key={b.id} className="eq-bike">
          {bikes.length > 1 ? <b className="eq-nome">{b.nome}</b> : null}
          {PECAS.map((p) => { const k = kmPeca(b, p, ws); const tr = (b.pecas && b.pecas[p] && b.pecas[p].trocas) || []; return (
            <div key={p} className="eq-peca">
              <div className="row between" style={{ alignItems: 'baseline' }}><b>{ROT_PECA[p][0]}</b><span className="apoio muted">{tr.length ? ROT_PECA[p][1] + ' em ' + dayMon(desdeDe(b, p) || '') : 'desde ' + dayMon(b.criadoEm)}</span></div>
              <div className="row" style={{ alignItems: 'baseline', gap: 6 }}><span className="eq-km sm tn">{kmTxt(k.km)}</span><span className="apoio muted">{tr.length ? 'km desde a troca' : 'km desde o cadastro'}</span></div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn quiet sm" onClick={() => { if (confirm('Registrar a troca de ' + ROT_PECA[p][0].toLowerCase() + ' hoje? Os km voltam a zero; a troca fica no histórico.')) gravar(troquei(lista(getState()), b.id, p, hojeIso()), ROT_PECA[p][0] + ': troca registrada'); }}>Troquei</button>
              </div>
            </div>); })}
        </Card>)) : (
        <Card><p className="apoio">Cadastre a bike para contar os km dos pneus e da corrente.</p>
          <button type="button" className="btn quiet" onClick={() => gravar(novaBike(lista(getState()), { hoje: hojeIso() }), 'Bike cadastrada: ela passa a vir escolhida nos pedais')}><IconBike size={18} stroke={1.75} aria-hidden="true" />Cadastrar a bike</button></Card>)}
      <span className="hint">Na bike não há aviso: os km aparecem e "Troquei" zera a contagem, guardando a troca no histórico.</span>
    </section>
    {velhos.length || trocas.length ? (
      <details className="acc eq-hist">
        <summary><span className="grow">Aposentados e trocas anteriores</span><IconChevronDown size={18} stroke={1.75} className="chev" aria-hidden="true" /></summary>
        <div className="body stack" style={{ gap: 8 }}>
          {velhos.map((t) => { const k = kmTenis(t, ws); return <div key={t.id} className="row between"><span><IconShoe size={16} stroke={1.75} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 6 }} />{t.nome}</span><span className="apoio muted tn">{kmTxt(k.km)} km · {dayMon(t.criadoEm)} a {dayMon(t.aposentadoEm || '')}</span></div>; })}
          {trocas.map((x, i) => <div key={i} className="row between"><span>{ROT_PECA[x.p][0]}</span><span className="apoio muted">{ROT_PECA[x.p][1]} em {dayMon(x.d)}</span></div>)}
        </div>
      </details>) : null}
    <p className="hint">Os km vêm da distância de cada treino: a corrida soma no tênis; o pedal soma nos pneus e na corrente. Treinos sem distância somam 0.</p>
    <Kpi doc="km-equipamento" className="link-kpi" label="Sobre os km do equipamento">Como os km são contados</Kpi>
    {form ? <FormTenis ini={form.ini} onClose={() => setForm(null)} /> : null}
  </>);
}

// ---------------- Hoje: tênis no limite ----------------
export function AvisoEquipCard() {
  const { st } = useApex();
  const av = avisosHoje(lista(st), st.workouts);
  if (!av.length) return null;
  return (<>{av.map((x) => (
    <Card key={x.t.id} className="eq-aviso">
      <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <IconShoe size={22} stroke={1.75} color="var(--atencao)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <div className="stack grow" style={{ gap: 2 }}><b>{x.t.nome} passou dos {kmTxt(x.t.limiteKm!)} km</b><span className="apoio muted tn">{kmTxt(x.km)} km. Hora de trocar o par.</span></div>
      </div>
      <a className="btn quiet sm" href={href('mais', 'equipamentos')}>Ver equipamentos</a>
    </Card>))}</>);
}

// ---------------- Completar: escolha do equipamento ----------------
export function CampoEquip({ modal, gear, setGear, distKm, wid }: { modal: string; gear: string; setGear: (g: string) => void; distKm: number; wid: string | null }) {
  const { st } = useApex();
  const L = lista(st); const bike = modal === 'bike';
  const ops = ativos(L, bike ? 'bike' : 'tenis');
  const atual = L.find((e) => e.id === gear) || null;
  const label = bike ? 'Bike' : 'Tênis';
  return (
    <div className="field eq-campo">
      <span className="lab" id="eq-l">{label}</span>
      {ops.length ? (
        <div className="row wrap" style={{ gap: 6 }} role="group" aria-labelledby="eq-l">
          {ops.map((e) => <button key={e.id} type="button" className="chip" aria-pressed={gear === e.id} onClick={() => setGear(e.id)}>{e.nome}</button>)}
          <button type="button" className="chip" aria-pressed={!gear} onClick={() => setGear('')}>{bike ? 'Sem bike' : 'Sem tênis'}</button>
        </div>
      ) : <a className="link-kpi" href={href('mais', 'equipamentos')}>{bike ? 'Cadastrar a bike' : 'Cadastrar um tênis'}</a>}
      {atual && !bike ? (() => { const c = comEsteTreino(atual, st.workouts, distKm, wid); return (<>
        <Barra km={c.km} limite={atual.limiteKm} est={c.estado} />
        <span className={'apoio tn' + (c.estado === 'atencao' || c.estado === 'limite' ? ' eq-est' : ' muted')}>{(c.estado === 'atencao' || c.estado === 'limite') ? <IconAlertTriangle size={14} stroke={1.75} aria-hidden="true" /> : null}{atual.limiteKm ? kmTxt(c.km) + ' de ' + kmTxt(atual.limiteKm) + ' km com este treino' : kmTxt(c.km) + ' km com este treino'}</span>
      </>); })() : null}
      {atual && bike ? <span className="apoio muted tn">{PECAS.map((p) => ROT_PECA[p][0] + ' ' + kmTxt(kmPeca(atual, p, st.workouts.filter((w: any) => w.id !== wid)).km + (distKm > 0 ? distKm : 0)) + ' km').join(' · ')} desde a troca, com este treino</span> : null}
    </div>
  );
}
