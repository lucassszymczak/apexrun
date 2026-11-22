// CONFIGURAÇÕES › GARMIN (Fase 2 · Etapa 1). design/telas-fase2/GarminConectar e GarminConectado.
// A chave é colada uma vez, vai para a função "garmin" e o campo é limpo na hora.
import { useEffect, useState } from 'react';
import { IconDeviceWatch, IconEye, IconEyeOff, IconLock, IconRefresh, IconCircleFilled, IconAlertTriangle, IconExternalLink, IconRoute } from '@tabler/icons-react';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, CardH, IC } from '../ui';
import { toast, getState } from '../store';
import { ehNovo } from '../perfil';
import { dayMon } from '../fmt';
import { useGarminSync, useGarminQueue, runGarminSync, resumoTexto, garminLocal, RECENTE_DIAS, buscarTrajetos, semTrajetoGarmin, pausarGarmin } from '../garmin-sync';
import { garminReady, garminStatus, garminConnect, garminSettings, garminDisconnect, sinceDate, diasParaVencer, VALIDADES, GarminError, type GarminStatus, type Desde } from '../garmin';

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
  // quem é novo traz os treinos pelo .FIT (a conexão automática passa pelo servidor do dono do app)
  if (ehNovo(getState()) && !garminReady()) return (<>{head}
    <Card><CardH icon={<IconDeviceWatch {...IC} />} title="Traga os treinos pelo arquivo .FIT" />
      <p className="apoio">O relógio grava cada treino num arquivo .FIT. Você exporta do Garmin Connect e importa aqui; nada passa por outro servidor.</p>
      <ol className="tour-passos">
        <li>Abra <b>connect.garmin.com</b> no navegador e entre na sua conta.</li>
        <li>Em <b>Atividades</b>, abra o treino.</li>
        <li>Toque na engrenagem e escolha <b>Exportar original</b>. Vem um arquivo .zip.</li>
        <li>No iPhone, toque no .zip no app Arquivos para abrir: dentro está o .FIT.</li>
        <li>Toque em <b>Importar .FIT</b> e escolha o arquivo. Dá para escolher vários de uma vez.</li>
      </ol>
      <a className="btn-primary" href={href('importar')}>Importar .FIT</a></Card>
  </>);
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
  const [filtros, setFiltros] = useState(st.filtros || { corrida: true, bike: true });
  const dias = diasParaVencer(st.keyExpiresAt);
  const vencida = st.status === 'chave_vencida' || st.status === 'chave_invalida' || (dias != null && dias < 0);
  const perto = !vencida && dias != null && dias <= 30;
  const sync = useGarminSync();
  const fila = useGarminQueue();
  const resumo = garminLocal().resumo;
  const sincronizar = async () => {
    setBusy(true);
    try {
      const r = await runGarminSync({ force: true });
      const err = garminLocal().erro;
      if (r) toast('Garmin: ' + resumoTexto(r)); else if (err) toast(err.msg);
      reload();
    } finally { setBusy(false); }
  };
  const [semTraj, setSemTraj] = useState<number | null>(null);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => { semTrajetoGarmin().then(setSemTraj); }, [sync.rodando]);
  const buscar = async () => {
    setBuscando(true);
    try {
      const r = await buscarTrajetos();
      if (r) toast(r.ok + ' trajeto' + (r.ok === 1 ? '' : 's') + ' adicionado' + (r.ok === 1 ? '' : 's') + (r.faltam ? ' · ' + r.faltam + ' para depois' : '') + '. Nenhum número mudou.');
    } finally { setBuscando(false); }
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
        : <button type="button" className="btn-primary" onClick={sincronizar} disabled={busy || sync.rodando}><IconRefresh size={20} stroke={1.75} aria-hidden="true" />{busy || sync.rodando ? (sync.total ? 'Baixando ' + sync.feito + ' de ' + sync.total + '…' : 'Sincronizando…') : 'Sincronizar agora'}</button>}
    </Card>
    {resumo || fila.length || garminLocal().erro ? (
      <Card>
        <CardH title="Última sincronização" right={resumo ? <span className="apoio muted">{haQuanto(resumo.at)}</span> : undefined} />
        {garminLocal().erro && !vencida ? <p className="apoio row" style={{ gap: 8, color: 'var(--atencao)' }}><IconAlertTriangle size={18} stroke={1.75} aria-hidden="true" />{garminLocal().erro!.msg}</p> : null}
        {resumo ? <p className="apoio">{resumoTexto(resumo)}{resumo.salvos ? ' · ' + resumo.salvos + ' antigo' + (resumo.salvos === 1 ? '' : 's') + ' salvo' + (resumo.salvos === 1 ? '' : 's') + ' direto' : ''}</p> : null}
        {fila.length ? <ul className="list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>{fila.slice(0, 5).map((q) => (
          <li key={q.id}><a className="item-row" href={href('completar', q.id)} style={{ minHeight: 44 }}><span className="grow">{(q.w && q.w.modal === 'bike' ? 'Pedal' : 'Corrida') + ' · ' + dayMon(q.w && q.w.date)}</span><span className="tn apoio">{q.w && q.w.distKm ? String(q.w.distKm.toFixed(2)).replace('.', ',') + ' km' : ''}</span><span className="badge atencao">Para completar</span></a></li>))}</ul> : null}
        <p className="hint">Treinos dos últimos {RECENTE_DIAS} dias vão para "Para completar" (sono e dor). Os mais antigos entram já salvos, com o RPE do Garmin.</p>
      </Card>
    ) : null}
    <Card>
      <CardH title="O que trazer" />
      <label className="switch"><span>Corridas</span><input type="checkbox" role="switch" checked={filtros.corrida} onChange={(e) => salvarFiltros({ ...filtros, corrida: e.target.checked })} /></label>
      <label className="switch"><span>Pedais</span><input type="checkbox" role="switch" checked={filtros.bike} onChange={(e) => salvarFiltros({ ...filtros, bike: e.target.checked })} /></label>
      <button type="button" className="item-row g-buscar" onClick={buscar} disabled={sync.rodando}>
        <span className="grow stack" style={{ gap: 0, textAlign: 'left' }}><span className="t">Buscar trajeto dos treinos antigos</span>
          <span className="s">{sync.rodando && buscando ? 'Baixando ' + sync.feito + ' de ' + sync.total + '… · toque em Pausar para parar' : semTraj == null ? 'Mapa e replay para os treinos que ainda não têm' : semTraj ? semTraj + ' treino' + (semTraj === 1 ? '' : 's') + ' do Garmin sem trajeto neste aparelho' : 'Todos os treinos do Garmin já têm trajeto'}</span></span>
        <IconRoute size={20} stroke={1.75} aria-hidden="true" />
      </button>
      {sync.rodando && buscando ? <button type="button" className="btn quiet" onClick={() => pausarGarmin()}>Pausar</button> : null}
    </Card>
    <p className="apoio muted">O app avisa 30 dias antes de a chave vencer. A Garmin também manda e-mail uma semana antes.</p>
    <div className="row" style={{ gap: 8 }}>
      <button type="button" className="btn quiet grow" onClick={onTrocar}>Trocar chave</button>
      <button type="button" className="btn danger grow" onClick={desconectar}>Desconectar</button>
    </div>
  </>);
}
