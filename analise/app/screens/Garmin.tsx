// CONFIGURAÇÕES › GARMIN (Fase 2 · Etapa 1). design/telas-fase2/GarminConectar e GarminConectado.
// A chave é colada uma vez, vai para a função "garmin" e o campo é limpo na hora.
import { useEffect, useState } from 'react';
import { IconDeviceWatch, IconEye, IconEyeOff, IconLock, IconRefresh, IconCircleFilled, IconAlertTriangle, IconCircleCheck, IconExternalLink } from '@tabler/icons-react';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, CardH, IC } from '../ui';
import { toast } from '../store';
import { dayMon } from '../fmt';
import { garminReady, garminStatus, garminConnect, garminSettings, garminDisconnect, garminList, sinceDate, diasParaVencer, VALIDADES, GarminError, type GarminStatus, type Desde } from '../garmin';

const KEY_PAGE = 'https://connect.garmin.com/app/settings/personalApiToken';
const brDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
function haQuanto(iso: string | null | undefined): string {
  if (!iso) return 'ainda não sincronizado';
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? 'sincronizado agora' : m < 60 ? 'sincronizado há ' + m + ' min' : m < 1440 ? 'sincronizado há ' + Math.round(m / 60) + ' h' : 'sincronizado em ' + brDate(iso);
}

export function Garmin() {
  const [st, setSt] = useState<GarminStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [trocar, setTrocar] = useState(false);
  const load = () => { setErr(null); garminStatus().then(setSt).catch((e) => { setErr(e.message); setSt({ conectado: false }); }); };
  useEffect(() => { if (garminReady()) load(); }, []);

  const head = <PageHead title="Garmin" sub="Configurações" back={href('mais', 'config')} right={null} />;
  if (!garminReady()) return (<>{head}
    <Card><CardH icon={<IconRefresh {...IC} />} title="Ligue a sincronização primeiro" />
      <p className="apoio muted">O Garmin usa o mesmo código de sincronização entre aparelhos. Ligue em Configurações › Sincronizar e volte aqui.</p>
      <a className="btn" href={href('mais', 'config')}>Ir para Configurações</a></Card>
  </>);
  if (!st) return (<>{head}<Card><p className="apoio muted" aria-busy="true">Conferindo a conexão…</p></Card></>);
  return (<>{head}
    {err ? <Card className="alert" role="alert"><IconAlertTriangle size={20} stroke={1.75} color="var(--atencao)" aria-hidden="true" /><span>{err}</span></Card> : null}
    {st.conectado && !trocar ? <Conectado st={st} reload={load} onTrocar={() => setTrocar(true)} /> : <Conectar trocando={trocar} onDone={() => { setTrocar(false); load(); }} onCancel={trocar ? () => setTrocar(false) : undefined} />}
  </>);
}

function Conectar({ trocando, onDone, onCancel }: { trocando: boolean; onDone: () => void; onCancel?: () => void }) {
  const [chave, setChave] = useState('');
  const [ver, setVer] = useState(false);
  const [desde, setDesde] = useState<Desde>('ciclo');
  const [validade, setValidade] = useState(365);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const conectar = async () => {
    const k = chave.trim();
    if (!k) { setErro('Cole a chave pessoal do Garmin.'); return; }
    setBusy(true); setErro(null);
    try {
      const r = await garminConnect(k, sinceDate(desde), validade);
      setChave(''); // a chave sai do aparelho e o campo é limpo na hora
      toast('Garmin conectado · chave vence em ' + brDate(r.keyExpiresAt));
      onDone();
    } catch (e: any) {
      setChave('');
      setErro(e instanceof GarminError ? e.message : 'Não deu para conectar agora.');
    } finally { setBusy(false); }
  };
  return (<>
    <Card className="row" style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 12 }}>
      <IconDeviceWatch size={24} stroke={1.75} color="var(--ciano)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <div className="stack" style={{ gap: 4 }}><h2 className="lead">Seus treinos chegam sozinhos</h2><p className="apoio muted">Ao abrir o app, os treinos novos do relógio aparecem em "Para completar" no Hoje.</p></div>
    </Card>
    <ol className="g-passos">
      <li><span className="g-n" aria-hidden="true">1</span><span>No computador, abra a <a href={KEY_PAGE} target="_blank" rel="noopener noreferrer">página da chave pessoal no Garmin Connect<IconExternalLink size={14} stroke={1.75} aria-label="(abre em outra aba)" /></a> e crie uma chave de 1 ano.</span></li>
      <li><span className="g-n" aria-hidden="true">2</span><span>Copie a chave. Ela aparece uma vez só: guarde como uma senha.</span></li>
      <li><span className="g-n" aria-hidden="true">3</span><span>Cole aqui embaixo e toque em Conectar.</span></li>
    </ol>
    <form className="col" onSubmit={(e) => { e.preventDefault(); conectar(); }} noValidate>
      <div className="field">
        <label htmlFor="g-chave">Chave pessoal</label>
        <div className="g-chave">
          <input id="g-chave" type={ver ? 'text' : 'password'} autoComplete="off" spellCheck={false} autoCapitalize="off" autoCorrect="off" placeholder="Cole a chave aqui" value={chave} onChange={(e) => setChave(e.target.value)} disabled={busy} />
          <button type="button" className="iconbtn" aria-pressed={ver} aria-label={ver ? 'Esconder a chave' : 'Mostrar a chave'} onClick={() => setVer(!ver)}>{ver ? <IconEyeOff size={20} stroke={1.75} /> : <IconEye size={20} stroke={1.75} />}</button>
        </div>
      </div>
      <div className="col">
        <div className="field">
          <label htmlFor="g-validade">Validade que você escolheu no Garmin</label>
          <select id="g-validade" value={validade} onChange={(e) => setValidade(+e.target.value)}>{VALIDADES.map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select>
          <span className="help">O Garmin não informa a validade pela API: o app usa esta para avisar 30 dias antes.</span>
        </div>
        <div className="field">
          <label htmlFor="g-desde">Trazer treinos desde</label>
          <select id="g-desde" value={desde} onChange={(e) => setDesde(e.target.value as Desde)}>
            <option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option>
            <option value="ciclo">Início do ciclo da maratona</option><option value="tudo">Todo o histórico</option>
          </select>
        </div>
      </div>
      {erro ? <Card className="alert" role="alert"><IconAlertTriangle size={20} stroke={1.75} color="var(--alerta)" aria-hidden="true" /><span>{erro}</span></Card> : null}
      <p className="apoio muted row" style={{ alignItems: 'flex-start', gap: 8 }}><IconLock size={18} stroke={1.75} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />A chave fica guardada criptografada no servidor do app e nunca volta para o aparelho. Treinos que você já importou à mão são reconhecidos e não duplicam.</p>
      <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Conectando…' : trocando ? 'Trocar chave' : 'Conectar Garmin'}</button>
      {onCancel ? <button type="button" className="btn quiet" onClick={onCancel}>Cancelar</button> : null}
    </form>
  </>);
}

function Conectado({ st, reload, onTrocar }: { st: GarminStatus; reload: () => void; onTrocar: () => void }) {
  const [busy, setBusy] = useState(false);
  const [achados, setAchados] = useState<{ n: number; ult: { tipo: string; data: string; km: string }[] } | null>(null);
  const [filtros, setFiltros] = useState(st.filtros || { corrida: true, bike: true });
  const dias = diasParaVencer(st.keyExpiresAt);
  const vencida = st.status === 'chave_vencida' || st.status === 'chave_invalida' || (dias != null && dias < 0);
  const perto = !vencida && dias != null && dias <= 30;
  const sincronizar = async () => {
    setBusy(true);
    try {
      const r = await garminList({ force: true });
      const at = r.atividades.slice().sort((a, b) => String(b.inicio).localeCompare(String(a.inicio)));
      setAchados({ n: at.length, ult: at.slice(0, 5).map((a) => ({ tipo: a.tipo === 'bike' ? 'Pedal' : 'Corrida', data: dayMon(String(a.inicioLocal || a.inicio).slice(0, 10)), km: a.distanciaM ? (a.distanciaM / 1000).toFixed(2).replace('.', ',') + ' km' : '—' })) });
      reload();
    } catch (e: any) { toast(e.message || 'Não deu para sincronizar agora.'); reload(); }
    finally { setBusy(false); }
  };
  const salvarFiltros = (f: { corrida: boolean; bike: boolean }) => { setFiltros(f); garminSettings({ filtros: f }).then(() => toast('Preferência salva')).catch((e) => toast(e.message)); };
  const desconectar = async () => {
    if (!confirm('Desconectar o Garmin? A chave e o acesso são apagados do servidor do app. Você também pode excluir a chave no Garmin Connect.')) return;
    try { await garminDisconnect(); toast('Garmin desconectado. Se quiser, exclua a chave no Garmin Connect.'); reload(); } catch (e: any) { toast(e.message); }
  };
  return (<>
    <Card>
      <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
        {vencida ? <IconAlertTriangle size={20} stroke={1.75} color="var(--alerta)" aria-hidden="true" /> : <IconCircleFilled size={12} color="var(--ok)" aria-hidden="true" style={{ marginTop: 5 }} />}
        <div className="stack grow" style={{ gap: 2 }}>
          <span className="lead">{vencida ? (st.status === 'chave_invalida' ? 'Chave recusada pelo Garmin' : 'Chave vencida') : 'Conectado'}</span>
          <span className="apoio muted">{haQuanto(st.lastListAt)} · chave {vencida ? 'venceu' : 'vence'} em <b style={{ color: vencida ? 'var(--alerta)' : perto ? 'var(--atencao)' : undefined, fontWeight: 500 }}>{brDate(st.keyExpiresAt)}</b></span>
        </div>
      </div>
      {perto ? <p className="apoio row" style={{ gap: 8, color: 'var(--atencao)' }}><IconAlertTriangle size={18} stroke={1.75} aria-hidden="true" />Faltam {dias} dias para a chave vencer. Gere outra no Garmin Connect e troque aqui.</p> : null}
      {vencida ? <button type="button" className="btn-primary" onClick={onTrocar}>Renovar chave</button>
        : <button type="button" className="btn-primary" onClick={sincronizar} disabled={busy}><IconRefresh size={20} stroke={1.75} aria-hidden="true" />{busy ? 'Sincronizando…' : 'Sincronizar agora'}</button>}
    </Card>
    {achados ? (
      <Card>
        <CardH title="Última sincronização" right={<span className="apoio muted">{achados.n} no Garmin</span>} />
        {achados.ult.length ? <ul className="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>{achados.ult.map((a, i) => (
          <li key={i} className="item-row" style={{ minHeight: 44 }}><IconCircleCheck size={18} stroke={1.75} color="var(--ok)" aria-hidden="true" /><span className="grow">{a.tipo} · {a.data}</span><span className="tn apoio">{a.km}</span></li>))}</ul>
          : <p className="apoio muted">Nenhum treino no período escolhido.</p>}
        <p className="hint">Nesta etapa o app só confere a conexão. Na próxima, os treinos novos entram em "Para completar".</p>
      </Card>
    ) : null}
    <Card>
      <CardH title="O que trazer" />
      <label className="switch"><span>Corridas</span><input type="checkbox" role="switch" checked={filtros.corrida} onChange={(e) => salvarFiltros({ ...filtros, corrida: e.target.checked })} /></label>
      <label className="switch"><span>Pedais</span><input type="checkbox" role="switch" checked={filtros.bike} onChange={(e) => salvarFiltros({ ...filtros, bike: e.target.checked })} /></label>
    </Card>
    <p className="apoio muted">O app avisa 30 dias antes de a chave vencer. A Garmin também manda e-mail uma semana antes.</p>
    <div className="row" style={{ gap: 8 }}>
      <button type="button" className="btn quiet grow" onClick={onTrocar}>Trocar chave</button>
      <button type="button" className="btn danger grow" onClick={desconectar}>Desconectar</button>
    </div>
  </>);
}
