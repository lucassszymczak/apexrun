// "AMANHÃ CEDO" (Hoje) e CONFIGURAÇÕES › TREINO (Fase 4 · Etapa 5; design/telas-fase4/HojeAmanha
// e ConfigTreino). Estimativa, não garantia: é a previsão do Open-Meteo, hora a hora.
import { lazy, Suspense, useState } from 'react';
import { IconSunrise, IconCloudRain, IconWind, IconMapPin, IconCurrentLocation } from '@tabler/icons-react';
import { useApex, commit, getState, toast } from '../store';
import { href, go } from '../route';
import { PageHead } from '../Shell';
import { Card } from '../ui';
import { dec } from '../fmt';
import { useAmanha, prefsTreino, pontoManual, salvarPontoManual } from '../amanha-app';
import { pontoAutomatico } from '../../amanha.mjs';

const hTxt = (h: number) => h + 'h';
const jTxt = (j: { de: string; ate: string }) => 'das ' + +j.de.slice(0, 2) + 'h às ' + +j.ate.slice(0, 2) + 'h';

export function AmanhaCard() {
  const { st } = useApex();
  const a = useAmanha(st);
  if (!a) return null;
  const { linhas, melhor, descartada, todasComChuva, prefs } = a;
  const max = Math.max(1, ...linhas.map((l) => (l.custo != null ? l.custo : 0)));
  const titulo = melhor ? 'Melhor horário amanhã: ' + hTxt(melhor.h) : todasComChuva ? 'Chuva provável em toda a janela' : 'Sem um horário bom amanhã na janela';
  const frase = melhor ? Math.round(melhor.tempC!) + ' °C, orvalho ' + Math.round(melhor.dewC!) + ' °C: ' + (melhor.padrao ? 'clima padrão, sem custo no ritmo.' : 'calor e umidade pesam cerca de ' + dec(melhor.custo!, 2).replace(/,?0+$/, '') + '% no ritmo.') : null;
  return (
    <Card className="amanha">
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <span className="cap row" style={{ gap: 6 }}><IconSunrise size={14} stroke={1.75} aria-hidden="true" />Amanhã cedo · janela {jTxt(prefs.janela)}</span>
        <a className="link" href={href('mais', 'treino')}>Ajustar</a>
      </div>
      <h2 className="lead">{titulo}</h2>
      {frase ? <p className="apoio">{frase}</p> : null}
      <div className="barras-h" role="img" aria-label={'Custo do clima por hora: ' + linhas.map((l) => hTxt(l.h) + ' ' + (l.semDado ? 'sem dado' : l.custo == null ? 'calor extremo' : dec(l.custo, 2).replace(/,?0+$/, '') + '%' + (l.chuva ? ', chuva ' + l.chuvaPct + '%' : ''))).join('; ')}>
        {linhas.map((l) => {
          const alt = l.custo != null ? Math.max(2, (l.custo / max) * 100) : 100;
          const best = melhor && l.h === melhor.h;
          return (
            <div key={l.h} className={'bh' + (best ? ' best' : '')}>
              <span className="v tn">{l.semDado ? '—' : l.custo == null ? '!' : l.custo === 0 ? '0' : '+' + dec(l.custo, 1).replace(',0', '')}</span>
              <span className="trilho"><i style={{ height: alt + '%', background: l.chuva ? 'var(--superficie-2)' : best ? 'var(--ciano)' : 'var(--texto-3)' }} /></span>
              <span className="h tn">{hTxt(l.h)}</span>
              {l.chuva ? <span className="chuva"><IconCloudRain size={12} stroke={2} aria-hidden="true" />chuva</span> : l.vento ? <span className="vento"><IconWind size={12} stroke={2} aria-hidden="true" />vento</span> : <span className="sp" />}
            </div>
          );
        })}
      </div>
      {descartada ? <p className="apoio" style={{ color: 'var(--atencao)' }}>{hTxt(descartada.h)} {descartada.padrao ? 'também tem clima padrão' : 'teria um custo parecido'}, mas com chuva provável ({descartada.chuvaPct}%).</p> : null}
      {melhor && melhor.vento ? <p className="apoio" style={{ color: 'var(--atencao)' }}>Vento forte às {hTxt(melhor.h)} ({Math.round(melhor.ventoKmh!)} km/h).</p> : null}
      <p className="hint">Barras: quanto o calor e a umidade pesam no ritmo, em relação ao clima padrão (%). Previsão do Open-Meteo: estimativa, não garantia.</p>
    </Card>
  );
}

// ---------------- Configurações › Treino ----------------
const PontoMapa = lazy(() => import('../map/PontoMapa').then((m) => ({ default: m.PontoMapa })));

export function ConfigTreino() {
  const { st } = useApex();
  const p0 = prefsTreino(st.athlete);
  const [de, setDe] = useState(p0.janela.de), [ate, setAte] = useState(p0.janela.ate);
  const [local, setLocal] = useState<'auto' | 'mapa'>(p0.local);
  const [mostrar, setMostrar] = useState(p0.mostrar);
  const [ponto, setPonto] = useState(() => pontoManual());
  const [meta, setMeta] = useState(p0.metaSemanalH != null ? String(p0.metaSemanalH).replace('.', ',') : '');
  const auto = pontoAutomatico(st.workouts);
  const salvar = () => {
    if (!(de < ate)) { alert('O fim da janela precisa ser depois do início.'); return; }
    if (local === 'mapa' && !ponto) { alert('Escolha o ponto no mapa, ou use "Automático".'); return; }
    const mt = meta.trim() ? Number(meta.trim().replace(',', '.')) : null;
    if (mt != null && !(mt > 0 && mt <= 40)) { alert('A meta semanal precisa ficar entre 0,5 e 40 horas, ou em branco.'); return; }
    const S = getState(); const a: any = S.athlete;
    const t = { ...(a.treino || {}), janela: { de, ate }, mostrarAmanha: mostrar, local };
    if (mt != null) t.metaSemanalH = Math.round(mt * 2) / 2; else delete t.metaSemanalH;
    a.treino = t; // sem coordenadas: elas ficam só no aparelho
    a.updatedAt = new Date().toISOString();
    salvarPontoManual(local === 'mapa' ? ponto : null);
    commit(); toast('Preferências de treino salvas'); go('mais', 'config');
  };
  const usarLocalizacao = () => {
    if (!navigator.geolocation) { alert('Este aparelho não informa a localização.'); return; }
    navigator.geolocation.getCurrentPosition((p) => setPonto({ lat: p.coords.latitude, lon: p.coords.longitude }), () => alert('Não consegui a sua localização.'), { timeout: 10000 });
  };
  return (<>
    <PageHead title="Treino" sub="Configurações" back={href('mais', 'config')} />
    <fieldset className="grupo">
      <legend>Meta semanal</legend>
      <div className="field"><label htmlFor="t_meta">Meta semanal (horas)</label><input id="t_meta" inputMode="decimal" placeholder="Em branco: automática" value={meta} onChange={(e) => setMeta(e.target.value)} /></div>
      <span className="hint">Usada na Consistência. Em branco, a meta é a média das 4 semanas anteriores com treino (mínimo de 1 h). Corrida, pedal e força contam.</span>
    </fieldset>
    <fieldset className="grupo">
      <legend>Janela de horário</legend>
      <div className="form-grid">
        <div className="field"><label htmlFor="t_de">Das</label><input id="t_de" type="time" step={3600} value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div className="field"><label htmlFor="t_ate">Até</label><input id="t_ate" type="time" step={3600} value={ate} onChange={(e) => setAte(e.target.value)} /></div>
      </div>
      <span className="hint">O card "Amanhã cedo" procura o melhor horário dentro dessa janela, de hora em hora.</span>
    </fieldset>
    <fieldset className="grupo">
      <legend>Local da previsão</legend>
      <div className="seg full" role="radiogroup" aria-label="Local da previsão">
        {([['auto', 'Automático'], ['mapa', 'Escolher no mapa']] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={local === k} onClick={() => setLocal(k)}>{l}</button>)}
      </div>
      {local === 'auto' ? <span className="hint">{auto ? 'Usa o ponto de onde a maioria dos seus últimos 10 treinos começou (' + auto.n + ' de ' + auto.de + '), calculado neste aparelho.' : 'Ainda não há treinos com local: escolha o ponto no mapa.'}</span> : (
        <div className="stack" style={{ gap: 8 }}>
          <Suspense fallback={<div className="ponto-mapa" aria-busy="true" />}><PontoMapa ponto={ponto || auto} onPonto={setPonto} /></Suspense>
          <div className="row wrap" style={{ gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn quiet" onClick={usarLocalizacao}><IconCurrentLocation size={18} stroke={1.75} aria-hidden="true" />Usar minha localização</button>
            <span className="apoio muted tn">{ponto ? <><IconMapPin size={14} stroke={1.75} aria-hidden="true" style={{ verticalAlign: -2 }} /> ponto escolhido</> : 'toque no mapa para escolher'}</span>
          </div>
          <span className="hint">O ponto escolhido fica só neste aparelho: ele não vai para a sincronização.</span>
        </div>
      )}
    </fieldset>
    <label className="opcao toggle">
      <input type="checkbox" role="switch" checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} />
      <span className="stack" style={{ gap: 2 }}><span className="t">Mostrar "Amanhã cedo" no Hoje</span><span className="apoio muted">Do meio-dia à meia-noite</span></span>
    </label>
    <p className="hint">A previsão envia ao Open-Meteo só a coordenada e a data, como já acontece com o clima dos treinos.</p>
    <button type="button" className="btn-primary" onClick={salvar}>Salvar</button>
  </>);
}

// Linha do plano no card do ciclo (Hoje): "Plano de prova: X/km no plano"
import { usePlano } from '../plano-app';
import * as E from '../../engine.mjs';
export function PlanoLinha() {
  const { st } = useApex();
  const P = usePlano(st);
  if (!P || !P.plano) return null;
  return <a className="link" href={href('mais', 'plano')}>Plano de prova: {E.paceStr(P.plano.P)}/km no plano</a>;
}
