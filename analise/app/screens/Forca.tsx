// FORÇA E CANELA (Mais). Porta de renderForca (app antigo): alerta clínico, semana
// (fase 1/2), programa de exercícios, como progredir e como saber se funciona.
// O app atual não registra sessão de força — a tela é só de leitura (sem ação principal).
import { useState } from 'react';
import { IconAlertTriangle, IconCalendarWeek, IconChevronRight } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Card, CardH, Seg, IC } from '../ui';

const TAG_COLOR: Record<string, string> = { corrida: 'var(--ciano)', forcaA: 'var(--magenta)', forcaB: 'var(--zona-3)', canela: 'var(--texto-3)', descanso: 'var(--linha)' };

function Ex({ ex }: { ex: any }) {
  return (
    <details className="acc" style={{ background: 'var(--superficie-2)' }}>
      <summary>
        <span className="tn faint" style={{ minWidth: 20 }}>{ex.n}</span>
        <span className="stack grow" style={{ gap: 0 }}><span>{ex.nome}</span>{ex.detalhe ? <span className="apoio muted" style={{ fontWeight: 400 }}>{ex.detalhe}</span> : null}{ex.flagText ? <span className={'badge ' + (ex.flag === 'key' ? 'ciano' : 'atencao')}>{ex.flagText}</span> : null}</span>
        <span className="apoio tn">{ex.reps}</span><IconChevronRight size={18} stroke={1.75} className="chev" aria-hidden="true" />
      </summary>
      <div className="body">
        <p className="apoio"><b>Onde sentir: </b>{ex.sentir}</p>
        <p className="apoio"><b>Evolução · exercício: </b>{ex.evoEx}</p>
        <p className="apoio"><b>Evolução · corrida: </b>{ex.evoCorrida}</p>
      </div>
    </details>
  );
}
function Sec({ n, title, children }: { n: string; title: string; children: any }) {
  return <details className="acc"><summary><span className="tn faint">{n}</span>{title}<IconChevronRight size={18} stroke={1.75} className="chev" aria-hidden="true" /></summary><div className="body">{children}</div></details>;
}

export function Forca() {
  const [fase, setFase] = useState<'1' | '2'>('1');
  const days = fase === '1' ? E.FC_FASE1 : E.FC_FASE2;
  return (<>
    <PageHead title="Força e canela" sub="Reforço estrutural + protocolo de canela — seu programa de consulta" back={href('mais')} />
    <Card className="alert" role="note" style={{ flexDirection: 'column' }}>
      <div className="row"><IconAlertTriangle size={20} stroke={1.75} color="var(--alerta)" aria-hidden="true" /><b>Alerta clínico</b></div>
      <p className="apoio">Sensibilidade na borda medial interna da tíbia, à palpação, estagnada. Tratada como <b>estresse tibial medial inicial (sintomático)</b>, não prevenção.</p>
      <p className="apoio"><b>Regra da canela:</b> dor na corrida/exercício ≤ 2/10 e sem piorar em 24 h. Só progride de carga quando a palpação melhorar; até lá, tudo leve e bipodal.</p>
      <p className="apoio"><b>Avaliação presencial:</b> se virar ponto único milimétrico que dói ao pular num pé só, ou não melhorar em 10–14 dias apesar do ajuste → descartar fratura por estresse com imagem.</p>
    </Card>
    <Card>
      <CardH icon={<IconCalendarWeek {...IC} />} title="Sua semana" right={<span className="badge neutro">{fase === '1' ? 'corre Qua + Sáb' : 'corre Ter + Qui + Sáb'}</span>} />
      <Seg value={fase} onChange={setFase} label="Fase" options={[['1', 'Fase 1 · sem 1–4'], ['2', 'Fase 2 · sem 5+']]} />
      <div className="grid-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))' }}>
        {days.map((d: any) => (
          <div key={d.dow} className="stat" style={{ alignItems: 'flex-start', textAlign: 'left', gap: 4 }}>
            <b>{d.dow}</b>
            {d.tags.map((t: any, i: number) => <span key={i} className="apoio row" style={{ gap: 6 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: TAG_COLOR[t.kind] }} aria-hidden="true" />{t.t}</span>)}
            {d.sub ? <span className="l">{d.sub}</span> : null}
          </div>
        ))}
      </div>
      <p className="hint"><b>Regra de ouro:</b> força pesada de pernas <b>nunca na véspera</b> do longo de sábado. Canela é <b>diária</b>, depois de correr. No dia: <b>corre primeiro, força depois</b>.</p>
      <details><summary className="link">Por que esses dias?</summary><p className="apoio muted">{fase === '1' ? 'Segunda dá margem antes de quarta; quinta longe de sábado; sexta livre = pernas descansadas para o longo. Nenhum treino de perna na véspera do sábado.' : '“Dias difíceis difíceis, dias fáceis fáceis” — força junto da corrida em ter/qui preserva seg/qua/sex como recuperação real. Se a tíbia reclamar na quinta, o Circuito B pode ir para um dia leve (exceção). Nunca sacrifique o sábado.'}</p></details>
    </Card>
    <Sec n="02" title="Treino de força completo">
      <p className="hint">Carga em que as <b>últimas 2 reps</b> são difíceis, mas com técnica perfeita. Descanso 60–90 s. Toque num exercício para ver onde sentir e como evoluir.</p>
      <h3 className="cap">Circuito A — cadeia posterior e quadril</h3>{E.FC_CIRCUITO_A.map((ex: any) => <Ex key={ex.n} ex={ex} />)}
      <h3 className="cap">Quadril / glúteo médio — correção principal</h3>{E.FC_QUADRIL.map((ex: any) => <Ex key={ex.n} ex={ex} />)}
      <h3 className="cap">Circuito B — empurrar / puxar / core</h3>{E.FC_CIRCUITO_B.map((ex: any) => <Ex key={ex.n} ex={ex} />)}
    </Sec>
    <Sec n="03" title="Canela (sintomática)">
      <p className="hint">Baixa carga, <b>diária</b>. Excêntrico de panturrilha + tibial anterior + pé/tornozelo. Sem dor durante. Gelo 10–15 min após correr se houver sensibilidade.</p>
      {E.FC_CANELA.map((ex: any) => <Ex key={ex.n} ex={ex} />)}
      <p className="apoio"><b>Cortado por ora: </b>toe raises com impacto e progressões em degrau — voltam quando a palpação melhorar. Na fase sintomática, a panturrilha do Circuito A fica bipodal; evite o búlgaro se reproduzir a sensibilidade.</p>
    </Sec>
    <Sec n="04" title="Como progredir">
      <p className="hint">Carga fixa vira sub-estímulo em 3–4 semanas. Ao completar todas as séries com a última rep ainda com boa técnica, suba um degrau — nesta ordem:</p>
      <ol className="apoio" style={{ margin: 0, paddingLeft: 20 }}><li>Mais repetições (3×8 → 3×10 → 3×12)</li><li>Elástico mais forte (leve → médio → forte)</li><li>Dificuldade (bipodal → unipodal → degrau)</li></ol>
      <p className="apoio"><b>A canela tem regra própria:</b> só progride quando a palpação melhorar; até lá, leve e bipodal.</p>
    </Sec>
    <Sec n="05" title="Como saber que está funcionando">
      <p className="apoio"><b>O marcador real: </b>ao longo de 4–6 semanas com a base fixa, os 10 km de sábado terminam com <b>FC mais baixa no mesmo pace</b> (ou <b>pace melhor na mesma FC</b>), e panturrilha/tíbia reclamando menos. Um treino ruim não desmente — conta o padrão repetido.</p>
    </Sec>
  </>);
}
