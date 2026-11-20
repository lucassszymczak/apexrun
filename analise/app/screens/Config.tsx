// CONFIGURAÇÕES (Mais). Porta de renderConfig, renderNewCycleCard, renderBikeZonesCard,
// renderSyncCard, exportData e importData (app antigo), mais o download do backup
// automático (IndexedDB) e a aparência automática. Mesmas regras de salvar e validar.
import { useEffect, useRef, useState } from 'react';
import { IconDeviceWatch, IconChevronRight, IconUser, IconFlag, IconBike, IconPalette, IconRefresh, IconDatabase, IconDownload, IconUpload, IconCopy, IconTrash, IconRotate, IconMap } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { useApex, commit, getState, toast, syncNow, syncJoin, useSyncStatus, backupStatus, refresh } from '../store';
import { href, go } from '../route';
import { PageHead } from '../Shell';
import { Card, CardH, Seg, IC } from '../ui';
import { themePref, setThemePref, type ThemePref } from '../theme';
import { listBackups, backupFileName, type BackupRow } from '../backup';
import { dayMonYear } from '../fmt';
import { defaultPrivacy, privacyLabel, type Privacy } from '../privacy';
import { PrivacyFields, PrivacyIcon } from './Privacidade';

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Field({ id, label, help, ...p }: { id: string; label: string; help?: string; [k: string]: any }) {
  return <div className="field"><label htmlFor={id}>{label}{help ? <span className="faint"> · {help}</span> : null}</label><input id={id} {...p} /></div>;
}

// ---------------- atleta ----------------
function Atleta() {
  const a = getState().athlete;
  const init = () => ({ name: a.name ?? '', city: a.city ?? '', age: a.age ?? '', weight: a.weight ?? '', fcRep: a.fcRep ?? '', fcMax: a.fcMax ?? '', vo2: a.vo2 ?? '', cad: a.cadenceTarget ?? '', efb: a.efBaseline ?? '', efg: a.efGainPct ?? '', dec: a.decouplingTarget ?? '', wk: a.weeklyTargetKm ?? '', ses: a.sessionsTarget ?? '', cycle: a.cycleName ?? '', alert: a.alert ?? '', fcProv: !!a.fcMaxProv, showBl: !!a.showBaseline5k });
  const [f, setF] = useState(init);
  const s = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = () => {
    const A = getState().athlete;
    A.name = String(f.name).trim() || 'Atleta'; A.city = String(f.city).trim();
    A.age = +f.age || A.age; A.weight = +f.weight || A.weight;
    A.fcRep = +f.fcRep || A.fcRep; A.fcMax = +f.fcMax || A.fcMax;
    A.vo2 = +f.vo2 || A.vo2; A.cadenceTarget = +f.cad || A.cadenceTarget;
    A.efBaseline = +f.efb || A.efBaseline; A.efGainPct = +f.efg || A.efGainPct;
    A.decouplingTarget = +f.dec || A.decouplingTarget; A.weeklyTargetKm = +f.wk || A.weeklyTargetKm;
    A.sessionsTarget = +f.ses || A.sessionsTarget; A.cycleName = String(f.cycle).trim() || A.cycleName;
    A.alert = String(f.alert).trim(); A.fcMaxProv = !!f.fcProv; A.showBaseline5k = !!f.showBl;
    A.updatedAt = new Date().toISOString(); commit(); toast('Configuração salva');
  };
  return (
    <Card>
      <CardH icon={<IconUser {...IC} />} title="Atleta" />
      <p className="apoio muted">Estes valores calibram TRIMP, zonas, GAP, metas e o score. Ajuste conforme seus testes.</p>
      <div className="form-grid g3">
        <Field id="c_name" label="Nome" value={f.name} onChange={s('name')} />
        <Field id="c_city" label="Cidade" value={f.city} onChange={s('city')} />
        <Field id="c_age" label="Idade" help="anos" type="number" value={f.age} onChange={s('age')} />
        <Field id="c_weight" label="Peso" help="kg" type="number" value={f.weight} onChange={s('weight')} />
        <Field id="c_fcrep" label="FC de repouso" help="bpm" type="number" value={f.fcRep} onChange={s('fcRep')} />
        <Field id="c_fcmax" label="FC máxima" help="bpm" type="number" value={f.fcMax} onChange={s('fcMax')} />
        <Field id="c_vo2" label="VO₂máx" help="ml/kg/min" type="number" value={f.vo2} onChange={s('vo2')} />
        <Field id="c_cad" label="Cadência alvo" help="spm" type="number" value={f.cad} onChange={s('cad')} />
        <Field id="c_efb" label="EF baseline" help="m/s/bpm" type="number" step="0.0001" value={f.efb} onChange={s('efb')} />
        <Field id="c_efg" label="Meta de EF" help="% de ganho" type="number" value={f.efg} onChange={s('efg')} />
        <Field id="c_dec" label="Decoupling alvo" help="%" type="number" value={f.dec} onChange={s('dec')} />
        <Field id="c_wk" label="Volume semanal alvo" help="km" type="number" value={f.wk} onChange={s('wk')} />
        <Field id="c_ses" label="Sessões por semana alvo" type="number" value={f.ses} onChange={s('ses')} />
        <Field id="c_cycle" label="Nome do ciclo" value={f.cycle} onChange={s('cycle')} />
      </div>
      <div className="field"><label htmlFor="c_alert">Alerta / status atual <span className="faint">· aparece no topo do Hoje</span></label><textarea id="c_alert" value={f.alert} onChange={s('alert')} /></div>
      <label className="switch"><span>FCmáx ainda provisória (aguardando teste de campo)</span><input type="checkbox" role="switch" checked={f.fcProv} onChange={s('fcProv')} /></label>
      <label className="switch"><span>Mostrar o "Baseline 5K" no painel</span><input type="checkbox" role="switch" checked={f.showBl} onChange={s('showBl')} /></label>
      <button type="button" className="btn-primary" onClick={save}>Salvar configuração</button>
    </Card>
  );
}

// ---------------- novo ciclo de prova ----------------
function NovoCiclo() {
  const st = getState(); const active = st.race;
  const [t, setT] = useState('maratona');
  const [name, setName] = useState('');
  const [dist, setDist] = useState(String(E.RACE_TYPES.maratona.dist));
  const [start, setStart] = useState(E.mIsoLocal(new Date()));
  const [end, setEnd] = useState('');
  const [goal, setGoal] = useState('');
  const fr = (E.RACE_TYPES[t] || E.RACE_TYPES.maratona).phases, names = ['Base', 'Construção', 'Pico', 'Taper'];
  let wks: number | null = null; if (start && end) { const s = new Date(start + 'T00:00:00'), e = new Date(end + 'T00:00:00'); wks = Math.round((e.getTime() - s.getTime()) / 86400000 / 7); }
  const start_ = () => {
    let d = parseFloat(dist), nm = name.trim();
    if (!end) { alert('Informe a data da prova.'); return; }
    if (!start) { alert('Informe o início do bloco.'); return; }
    if (end <= start) { alert('A data da prova precisa ser depois do início do bloco.'); return; }
    const T = E.RACE_TYPES[t] || E.RACE_TYPES.maratona;
    if (isNaN(d) || d <= 0) d = T.dist || 42.195;
    if (!nm) nm = T.label;
    if (active) { if (!confirm('Arquivar o ciclo atual (“' + (active.name || 'prova') + '”) e iniciar “' + nm + '”?')) return; E.archiveCycle(active); }
    getState().race = { name: nm, type: t, date: end, distKm: d, goal: goal.trim() || 'finish', objective: goal.trim(), startDate: start, longRunTargetKm: T.longRunTargetKm, peakKmTarget: T.peakKmTarget, updatedAt: new Date().toISOString() };
    commit(); toast('Novo ciclo iniciado'); go('mais', 'maratona');
  };
  return (
    <Card>
      <CardH icon={<IconFlag {...IC} />} title="Novo ciclo de prova" />
      <p className="apoio muted">As fases (Base · Construção · Pico · Taper) são montadas por <b>proporção do bloco</b>, conforme o tipo de prova (maratona 40/30/20/10, meia 35/30/25/10).{active ? <> Iniciar um novo ciclo <b>arquiva o atual</b> (“{active.name || 'prova'}”) com resumo.</> : null}</p>
      <div className="form-grid g3">
        <div className="field"><label htmlFor="nc_type">Tipo</label><select id="nc_type" value={t} onChange={(e) => { setT(e.target.value); const d = (E.RACE_TYPES[e.target.value] || {}).dist; if (d != null) setDist(String(d)); }}>{Object.keys(E.RACE_TYPES).map((k) => <option key={k} value={k}>{E.RACE_TYPES[k].label}</option>)}</select></div>
        <Field id="nc_name" label="Nome da prova" placeholder="Ex.: Maratona de Curitiba" value={name} onChange={(e: any) => setName(e.target.value)} />
        <Field id="nc_dist" label="Distância" help="km" type="number" step="0.001" inputMode="decimal" value={dist} onChange={(e: any) => setDist(e.target.value)} />
        <Field id="nc_start" label="Início do bloco" type="date" value={start} onChange={(e: any) => setStart(e.target.value)} />
        <Field id="nc_end" label="Data da prova" type="date" value={end} onChange={(e: any) => setEnd(e.target.value)} />
        <Field id="nc_goal" label="Objetivo" help="livre" placeholder="terminar bem por zonas de FC" value={goal} onChange={(e: any) => setGoal(e.target.value)} />
      </div>
      <p className="apoio muted">{wks != null && wks > 0 ? <>Bloco de <b>{wks} semanas</b> → {fr.map((x: number, i: number) => names[i] + ' ~' + Math.max(1, Math.round(x * wks!)) + ' sem').join(' · ')}</> : 'Fases: ' + fr.map((x: number, i: number) => names[i] + ' ' + Math.round(x * 100) + '%').join(' · ') + '. Preencha início e data para ver as semanas.'}</p>
      <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={start_}>Iniciar ciclo</button>
    </Card>
  );
}

// ---------------- zonas da bike ----------------
function ZonasBike() {
  const a = getState().athlete;
  const z0 = a.bikeZones && a.bikeZones.length === 5 ? a.bikeZones.slice() : [123, 138, 145, 167, 179];
  const fm = a.bikeFcMax || 186;
  const [mx, setMx] = useState(String(fm));
  const [z, setZ] = useState<string[]>(z0.map(String));
  const zz = z.map((x, i) => +x || z0[i]);
  const save = () => {
    const nm = +mx || fm; const nz = z.map((x, i) => +x || z0[i]);
    for (let i = 1; i < 5; i++) if (nz[i] <= nz[i - 1]) { alert('As zonas precisam ser crescentes (Z1 < Z2 < … < Z5).'); return; }
    const A = getState().athlete; A.bikeFcMax = nm; A.bikeZones = nz; A.updatedAt = new Date().toISOString(); commit(); toast('Zonas da bike salvas');
  };
  return (
    <Card>
      <CardH icon={<IconBike {...IC} />} title="Zonas de FC · bike" />
      <p className="apoio muted">As zonas da bike (do seu Garmin) — usadas na <b>carga (TRIMP) e nas zonas de FC da bike</b>. A corrida segue com a FCmáx e as zonas dela (Karvonen). Início de cada zona, em bpm:</p>
      <div className="form-grid g3">
        <Field id="bz_max" label="FCmáx bike (bpm)" type="number" inputMode="numeric" value={mx} onChange={(e: any) => setMx(e.target.value)} />
        {['Z1', 'Z2', 'Z3', 'Z4', 'Z5'].map((l, i) => <Field key={l} id={'bz_' + i} label={l + ' início'} type="number" inputMode="numeric" value={z[i]} onChange={(e: any) => { const n = z.slice(); n[i] = e.target.value; setZ(n); }} />)}
      </div>
      <p className="apoio muted tn">{zz.map((lo, i) => 'Z' + (i + 1) + ' ' + lo + '–' + (i < 4 ? zz[i + 1] - 1 : 'máx')).join(' · ')}</p>
      {(() => { const r = E.runZoneHrRanges(a); return r ? <p className="apoio muted tn">Corrida (FC {a.fcRep}–{a.fcMax}): {r.map((x: any) => x.z + ' ' + x.lo + '–' + x.hi).join(' · ')}</p> : null; })()}
      <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={save}>Salvar zonas da bike</button>
    </Card>
  );
}

// ---------------- mapa (novo na Fase 1; campos opcionais e aditivos no atleta) ----------------
function Mapa() {
  const a = getState().athlete;
  const [m, setM] = useState<'ruas' | 'trajeto'>(a.mapaPadrao === 'trajeto' ? 'trajeto' : 'ruas');
  const [c, setC] = useState<string>(['fc', 'pace', 'zona', 'grade'].includes(a.corPadrao) ? a.corPadrao : 'fc');
  const save = (mm: string, cc: string) => { const A = getState().athlete; A.mapaPadrao = mm; A.corPadrao = cc; A.updatedAt = new Date().toISOString(); commit(); toast('Padrão do mapa salvo'); };
  return (
    <Card>
      <CardH icon={<IconMap {...IC} />} title="Mapa" />
      <p className="apoio muted">Como o treino abre. “Só trajeto” desenha o percurso sem mapa de ruas e funciona sem internet.</p>
      <Seg value={m} onChange={(v) => { setM(v); save(v, c); }} label="Fundo padrão do mapa" options={[['ruas', 'Ruas'], ['trajeto', 'Só trajeto']]} />
      <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="Cor padrão do trajeto">
        {([['fc', 'FC'], ['pace', 'Pace'], ['zona', 'Zona'], ['grade', 'Inclinação']] as const).map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={c === k} onClick={() => { setC(k); save(m, k); }}>{l}</button>)}
      </div>
    </Card>
  );
}

// ---------------- Garmin (Fase 2): leva à tela Configurações › Garmin ----------------
function GarminLink() {
  return (
    <a className="card item-row" href={href('mais', 'garmin')} style={{ flexDirection: 'row', textDecoration: 'none', color: 'inherit' }}>
      <IconDeviceWatch {...IC} color="var(--ciano)" aria-hidden="true" />
      <div className="grow stack" style={{ gap: 0 }}><span className="t">Garmin</span><span className="s">Treinos do relógio entrando sozinhos</span></div>
      <IconChevronRight size={20} stroke={1.75} className="faint" aria-hidden="true" />
    </a>
  );
}

// ---------------- privacidade padrão (Etapa 3; campo opcional e aditivo no atleta) ----------------
function PrivacidadePadrao() {
  const [p, setP] = useState<Privacy>(() => defaultPrivacy(getState().athlete));
  const save = (v: Privacy) => { setP(v); const A = getState().athlete; A.privacidadePadrao = v; A.updatedAt = new Date().toISOString(); commit(); toast('Privacidade padrão salva'); };
  return (
    <Card>
      <CardH icon={<PrivacyIcon p={p} />} title="Privacidade padrão" />
      <p className="apoio muted">Vale para os treinos novos e para os antigos que você não ajustou. Cada treino pode mudar no escudo. Agora: {privacyLabel(p)}.</p>
      <PrivacyFields value={p} onChange={save} />
    </Card>
  );
}

// ---------------- aparência ----------------
function Aparencia() {
  const [p, setP] = useState<ThemePref>(themePref());
  return (
    <Card>
      <CardH icon={<IconPalette {...IC} />} title="Aparência" />
      <p className="apoio muted">O escuro poupa a vista; o claro é melhor em ambientes muito iluminados; o automático segue o celular.</p>
      <Seg value={p} onChange={(v) => { setP(v); setThemePref(v); }} label="Tema" options={[['dark', 'Escuro'], ['light', 'Claro'], ['auto', 'Automático']]} />
    </Card>
  );
}

// ---------------- sincronizar ----------------
function Sync() {
  const s = useSyncStatus();
  const [code, setCode] = useState('');
  const st = getState();
  const label = s.state === 'syncing' ? 'sincronizando…' : s.state === 'ok' ? 'sincronizado' + (st.lastSyncAt ? ' · ' + new Date(st.lastSyncAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '') : s.state === 'err' ? (s.msg || 'falha') : '';
  const badge = label ? <span className={'badge ' + (s.state === 'ok' ? 'ok' : s.state === 'err' ? 'alerta' : 'neutro')} role="status">{label}</span> : null;
  if (!E.sbReady()) return (<Card><CardH icon={<IconRefresh {...IC} />} title="Sincronizar entre aparelhos" />
    <p className="apoio muted">A sincronização em nuvem funciona na <b>versão publicada</b> (o link do GitHub Pages). Nesta cópia local, use <b>Exportar/Importar JSON</b> para levar os dados.</p></Card>);
  if (!E.syncEnabled()) {
    const activate = () => {
      const c = E.newSyncCode(); E.setSyncCode(c);
      E.syncPush().then(() => { getState().lastSyncAt = new Date().toISOString(); E.save(); toast('Sincronização ligada'); refresh(); })
        .catch((e: any) => { E.setSyncCode(null); alert('Não deu para ativar agora: ' + e.message); refresh(); });
    };
    const join = () => {
      const c = E.normalizeSyncCode(code); if (!/^apex-/.test(c)) { alert('Código inválido. Ele tem o formato apex-xxxx-xxxx-xxxx.'); return; }
      if (st.workouts && st.workouts.length && !st.seeded) { if (!confirm('Conectar vai substituir os dados deste aparelho pelos do código. Continuar?')) return; }
      syncJoin(c).then(() => toast('Conectado — dados sincronizados')).catch((e) => { alert('Não deu para conectar: ' + e.message); refresh(); });
    };
    return (
      <Card>
        <CardH icon={<IconRefresh {...IC} />} title="Sincronizar entre aparelhos" right={badge} />
        <p className="apoio muted">Ligue a sincronização para que os treinos apareçam no <b>celular e no computador</b>. Um <b>código secreto</b> conecta seus aparelhos — sem login, sem senha. Guarde o código; quem tiver ele acessa seus dados.</p>
        <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={activate}>Ativar e gerar meu código</button>
        <hr className="divider" />
        <div className="field"><label htmlFor="sync_code">Já ativou em outro aparelho? Cole o código para puxar os mesmos dados</label>
          <div className="row"><input id="sync_code" placeholder="apex-xxxx-xxxx-xxxx" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <button type="button" className="btn quiet" onClick={join}>Conectar</button></div></div>
      </Card>
    );
  }
  const c = E.getSyncCode();
  return (
    <Card>
      <CardH icon={<IconRefresh {...IC} />} title="Sincronizar entre aparelhos" right={badge} />
      <p className="apoio muted">Este aparelho está sincronizado. No outro aparelho, vá em Mais › Configurações › Sincronizar e use “Já ativou em outro aparelho?” com o código abaixo.</p>
      <div className="row wrap"><code className="tn" style={{ fontSize: 16, fontWeight: 500, padding: '8px 12px', borderRadius: 8, background: 'var(--superficie-2)', color: 'var(--ciano)' }}>{c}</code>
        <button type="button" className="btn quiet" onClick={() => { try { navigator.clipboard.writeText(c); toast('Código copiado'); } catch { prompt('Copie seu código:', c); } }}><IconCopy size={18} stroke={1.75} aria-hidden="true" />Copiar</button></div>
      <div className="row wrap">
        <button type="button" className="btn" onClick={() => syncNow(false)}>Sincronizar agora</button>
        <button type="button" className="btn danger" onClick={() => { if (confirm('Desativar a sincronização NESTE aparelho? Os dados continuam salvos aqui e na nuvem; só param de atualizar entre si.')) { E.setSyncCode(null); toast('Sincronização desativada'); refresh(); } }}>Desativar neste aparelho</button>
      </div>
    </Card>
  );
}

// ---------------- dados ----------------
function Dados() {
  const [bks, setBks] = useState<BackupRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { listBackups().then(setBks).catch((e) => setErr(String(e?.message || e))); }, []);
  const exportData = () => {
    const s = getState();
    const payload = JSON.stringify({ athlete: s.athlete, workouts: s.workouts, daily: s.daily || [] }, null, 2);
    download('apex-treinos-' + new Date().toISOString().slice(0, 10) + '.json', payload); toast('Backup exportado');
  };
  // importData do app antigo: mesma regra (workouts/daily/athlete do arquivo; updatedAt = agora)
  const importData = (file: File | undefined | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const p = JSON.parse(String(r.result)); const s = getState(); const now = new Date().toISOString();
        if (p.workouts) s.workouts = p.workouts.map((w: any) => { if (!w.updatedAt) w.updatedAt = now; return w; });
        if (p.daily) s.daily = p.daily.map((d: any) => { if (!d.updatedAt) d.updatedAt = now; return d; });
        if (p.athlete) { s.athlete = Object.assign({}, E.DEFAULT_ATHLETE, p.athlete); s.athlete.updatedAt = now; }
        commit(); toast('Dados importados');
      } catch (e: any) { alert('Arquivo inválido: ' + (e && e.message ? e.message : e)); }
    };
    r.readAsText(file);
  };
  const reseed = () => { if (confirm('Substituir tudo pelos dados de exemplo (baseline do Lucas)?')) { const s = getState(); s.workouts = E.seedWorkouts(); s.daily = E.seedDaily(); s.athlete = Object.assign({}, E.DEFAULT_ATHLETE); s.athlete.updatedAt = new Date().toISOString(); commit(); } };
  const wipe = () => { if (confirm('Apagar TODOS os treinos? Isto não pode ser desfeito.')) { const s = getState(); const now = new Date().toISOString(); s.deleted = (s.deleted || []).concat(s.workouts.map((w: any) => ({ id: w.id, at: now }))); s.workouts = []; commit(); } };
  return (
    <Card>
      <CardH icon={<IconDatabase {...IC} />} title="Dados" />
      <p className="apoio muted">Tudo fica neste aparelho. Exporte para guardar uma cópia — ou ligue a sincronização para os dados aparecerem no celular e no computador.</p>
      <div className="row wrap">
        <button type="button" className="btn" onClick={exportData}><IconDownload size={18} stroke={1.75} aria-hidden="true" />Exportar JSON</button>
        <button type="button" className="btn quiet" onClick={() => fileRef.current?.click()}><IconUpload size={18} stroke={1.75} aria-hidden="true" />Importar JSON</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" id="importFile" aria-label="Escolher o arquivo JSON para importar" onChange={(e) => { importData(e.target.files && e.target.files[0]); e.target.value = ''; }} />
      </div>
      <hr className="divider" />
      <h3 className="lead" style={{ fontSize: 15 }}>Backup automático</h3>
      <p className="apoio muted">Antes de a versão nova gravar qualquer coisa, guardei uma cópia exata dos seus dados (com data) neste aparelho, e guardo mais uma por dia de uso (as 7 mais recentes). O arquivo baixado pode ser lido por “Importar JSON”.</p>
      {!backupStatus.ok && backupStatus.error ? <p className="apoio" style={{ color: 'var(--alerta)' }}>Backup automático indisponível neste navegador: {backupStatus.error}</p> : null}
      {err ? <p className="apoio" style={{ color: 'var(--alerta)' }}>{err}</p> : null}
      {bks && !bks.length ? <p className="apoio muted">Nenhum backup ainda (este aparelho não tinha dados do app antigo).</p> : null}
      {bks && bks.length ? (
        <div className="list">
          {bks.map((b) => (
            <div key={b.id} className="item-row">
              <div className="grow stack" style={{ gap: 0 }}>
                <b style={{ fontWeight: 500 }}>{b.kind === 'migracao' ? 'Cópia da migração' : 'Cópia diária'} · {dayMonYear(b.at.slice(0, 10))} {b.at.slice(11, 16)}</b>
                <span className="s">{b.nWorkouts != null ? b.nWorkouts + ' treinos · ' : ''}{Math.round(b.bytes / 1024)} KB</span>
              </div>
              <button type="button" className="btn quiet" onClick={() => download(backupFileName(b), b.data)} aria-label={'Baixar ' + (b.kind === 'migracao' ? 'cópia da migração' : 'cópia diária') + ' de ' + dayMonYear(b.at.slice(0, 10))}><IconDownload size={18} stroke={1.75} aria-hidden="true" />Baixar</button>
            </div>
          ))}
        </div>
      ) : null}
      <hr className="divider" />
      <div className="row wrap">
        <button type="button" className="btn quiet" onClick={reseed}><IconRotate size={18} stroke={1.75} aria-hidden="true" />Restaurar dados de exemplo</button>
        <button type="button" className="btn danger" onClick={wipe}><IconTrash size={18} stroke={1.75} aria-hidden="true" />Apagar todos os treinos</button>
      </div>
      <p className="hint">A versão anterior do app continua disponível em <a href="../analise-v1/">/analise-v1/</a> até o fim da Fase 1, com os mesmos dados.</p>
    </Card>
  );
}

export function Config() {
  useApex();
  return (<>
    <PageHead title="Configurações" back={href('mais')} right={null} />
    <div className="cols">
      <div className="col"><Atleta /><ZonasBike /></div>
      <div className="col"><NovoCiclo /><GarminLink /><Mapa /><PrivacidadePadrao /><Aparencia /><Sync /><Dados /></div>
    </div>
  </>);
}
