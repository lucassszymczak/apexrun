// "DIGA COMO FOI" e MAPA DO CORPO (Fase 5 · Etapa 3; design/telas-fase5/Completar e CompletarDesktop).
// A frase só é lida ao tocar em "Preencher pela frase" (analise/fala.mjs) e nada é salvo sem o
// Lucas conferir. O mapa tem as 19 regiões da tela, cada uma um <button> com nome, lado e dor;
// também dá para usar só pela lista e pelo teclado. Sem diagnóstico e sem alerta.
import { useState } from 'react';
import { IconMicrophone, IconMinus, IconPlus, IconAlertTriangle } from '@tabler/icons-react';
import { lerFrase, textoEntendi, textoPendente, nomeRegiao, chave, type Leitura, type Pendente } from '../../fala.mjs';

// as 19 regiões: [chave, nome, x, y, largura, altura] no desenho de 340 × 410 (frente à esquerda,
// costas à direita; na frente, o lado direito do corpo fica à esquerda do desenho)
export const R19: [string, string, number, number, number, number][] = [
  ['quadril_d', 'Quadril direito', 57, 158, 28, 32], ['quadril_e', 'Quadril esquerdo', 85, 158, 28, 32],
  ['coxa_d', 'Coxa direita (frente)', 58, 192, 25, 86], ['coxa_e', 'Coxa esquerda (frente)', 87, 192, 25, 86],
  ['joelho_d', 'Joelho direito', 59, 280, 23, 22], ['joelho_e', 'Joelho esquerdo', 88, 280, 23, 22],
  ['canela_d', 'Canela direita', 60, 304, 21, 60], ['canela_e', 'Canela esquerda', 89, 304, 21, 60],
  ['pe_d', 'Tornozelo e pé direito', 58, 366, 24, 16], ['pe_e', 'Tornozelo e pé esquerdo', 88, 366, 24, 16],
  ['lombar', 'Lombar', 233, 128, 44, 28],
  ['gluteo_e', 'Glúteo esquerdo', 227, 158, 28, 32], ['gluteo_d', 'Glúteo direito', 255, 158, 28, 32],
  ['posterior_e', 'Posterior da coxa esquerda', 228, 192, 25, 86], ['posterior_d', 'Posterior da coxa direita', 257, 192, 25, 86],
  ['panturrilha_e', 'Panturrilha esquerda', 230, 304, 21, 60], ['panturrilha_d', 'Panturrilha direita', 259, 304, 21, 60],
  ['aquiles_e', 'Tendão de Aquiles esquerdo', 231, 366, 19, 16], ['aquiles_d', 'Tendão de Aquiles direito', 260, 366, 19, 16],
];
export const NOME_R: Record<string, string> = Object.fromEntries(R19.map((r) => [r[0], r[1]]));
export type Regs = Record<string, number>;
// dorRegioes (salvo no treino) ↔ mapa
export const regsDe = (lista: any[] | null | undefined): Regs => Object.fromEntries((lista || []).filter((x) => x && x.regiao).map((x) => [chave(x.regiao, x.lado || null), +x.int || 0]));
export const listaDe = (regs: Regs) => Object.entries(regs).filter(([, v]) => v > 0).map(([k, v]) => { const [regiao, l] = k.split('_'); return { regiao, lado: (l as 'd' | 'e') || null, int: v }; });
export const corDor = (v: number) => (!v ? 'transparent' : v <= 3 ? 'color-mix(in srgb, var(--atencao) 50%, transparent)' : v <= 6 ? 'var(--atencao)' : 'var(--alerta)');

function Silhueta() {
  const B = (dx: number) => (<>
    <circle cx={85 + dx} cy={26} r={17} /><rect x={79 + dx} y={42} width={12} height={12} /><rect x={55 + dx} y={52} width={60} height={108} rx={14} /><rect x={57 + dx} y={152} width={56} height={40} rx={10} />
    <rect x={37 + dx} y={56} width={15} height={100} rx={7} /><rect x={35 + dx} y={152} width={13} height={58} rx={6} /><rect x={118 + dx} y={56} width={15} height={100} rx={7} /><rect x={122 + dx} y={152} width={13} height={58} rx={6} />
    <rect x={58 + dx} y={188} width={25} height={92} rx={10} /><rect x={87 + dx} y={188} width={25} height={92} rx={10} /><rect x={59 + dx} y={278} width={23} height={26} rx={8} /><rect x={88 + dx} y={278} width={23} height={26} rx={8} />
    <rect x={60 + dx} y={302} width={21} height={64} rx={8} /><rect x={89 + dx} y={302} width={21} height={64} rx={8} /><rect x={57 + dx} y={364} width={26} height={18} rx={6} /><rect x={87 + dx} y={364} width={26} height={18} rx={6} />
  </>);
  return (
    <svg width="340" height="410" viewBox="0 0 340 410" aria-hidden="true" className="corpo-svg">
      <g fill="var(--superficie-2)" stroke="var(--linha)" strokeWidth="1">{B(0)}{B(170)}</g>
      <g className="corpo-rot" textAnchor="middle"><text x="85" y="404">Frente</text><text x="255" y="404">Costas</text>
        <text x="18" y="240">D</text><text x="152" y="240">E</text><text x="188" y="240">E</text><text x="322" y="240">D</text></g>
    </svg>
  );
}

// mapa do corpo para marcar (Completar) ou para ver a frequência (Progresso › Corpo)
export function MapaCorpo({ regs, setRegs, sel, setSel, valorDe, rotuloDe, corDe }: { regs?: Regs; setRegs?: (r: Regs) => void; sel: string | null; setSel: (k: string | null) => void; valorDe?: (k: string) => number; rotuloDe?: (k: string) => string; corDe?: (k: string) => string }) {
  const val = valorDe || ((k: string) => (regs && regs[k]) || 0);
  const muda = (d: number) => { if (!sel || !regs || !setRegs) return; setRegs({ ...regs, [sel]: Math.max(0, Math.min(10, (regs[sel] || 0) + d)) }); };
  return (<>
    <div className="corpo-box">
      <Silhueta />
      {R19.map(([k, nome, x, y, w, h]) => { const v = val(k); return (
        <button key={k} type="button" className={'corpo-r' + (sel === k ? ' on' : '') + (v ? ' tem ' + (v <= 3 ? 'i1' : 'i2') : '')} aria-pressed={sel === k}
          aria-label={rotuloDe ? rotuloDe(k) : nome + (v ? ', dor ' + v : ', sem dor')}
          style={{ left: x, top: y, width: w, height: h, background: corDe ? corDe(k) : corDor(v) }} onClick={() => setSel(sel === k ? null : k)}>
          {v && h >= 22 ? <span>{v}</span> : null}
        </button>); })}
    </div>
    <div className="field corpo-lista-sel">
      <label htmlFor="corpo-sel">Ou escolha a região na lista</label>
      <select id="corpo-sel" value={sel || ''} onChange={(e) => setSel(e.target.value || null)}>
        <option value="">—</option>
        {R19.map(([k, nome]) => <option key={k} value={k}>{nome}{val(k) ? ' · ' + (rotuloDe ? val(k) : 'dor ' + val(k)) : ''}</option>)}
      </select>
    </div>
    {sel && regs && setRegs ? (
      <div className="corpo-int" role="group" aria-label={'Dor: ' + NOME_R[sel]}>
        <span className="grow">{NOME_R[sel]}</span>
        <button type="button" className="corpo-pm" aria-label="Diminuir a dor" onClick={() => muda(-1)}><IconMinus size={18} stroke={2} /></button>
        <span className="corpo-v tn" aria-live="polite">{regs[sel] || 0}</span>
        <button type="button" className="corpo-pm" aria-label="Aumentar a dor" onClick={() => muda(1)}><IconPlus size={18} stroke={2} /></button>
      </div>) : null}
  </>);
}
export function listaMarcadas(regs: Regs): string {
  const m = R19.filter(([k]) => regs[k] > 0).map(([k, n]) => n + ' ' + regs[k]);
  return m.length ? 'Marcadas: ' + m.join(' · ') : 'Nenhuma região marcada.';
}

// "Diga como foi"
export function DigaComoFoi({ equipamentos, onFill }: { equipamentos: any[]; onFill: (r: Leitura) => void }) {
  const [frase, setFrase] = useState('');
  const [res, setRes] = useState<Leitura | null>(null);
  const preencher = () => { const r = lerFrase(frase, { equipamentos }); setRes(r); onFill(r); };
  return (
    <section className="card diga" aria-labelledby="h-diga">
      <h2 id="h-diga" className="lead">Diga como foi</h2>
      <div className="field">
        <label htmlFor="diga-frase" className="row" style={{ gap: 6 }}><IconMicrophone size={16} stroke={1.75} aria-hidden="true" />Toque no microfone do teclado e fale</label>
        <textarea id="diga-frase" rows={2} value={frase} onChange={(e) => setFrase(e.target.value)} placeholder="Ex.: RPE 7, dormi 7 e meia, canela esquerda 3" />
      </div>
      <button type="button" className="btn quiet" onClick={preencher} disabled={!frase.trim()}>Preencher pela frase</button>
      <div aria-live="polite" className="diga-res">
        {res ? <p className="apoio">{textoEntendi(res)}</p> : null}
        {res && res.pendentes.length ? <p className="apoio diga-pend">{res.pendentes.map(textoPendente).join(' · ')}</p> : null}
        {res && res.avisos.length ? <p className="apoio diga-aviso"><IconAlertTriangle size={14} stroke={1.75} aria-hidden="true" />{res.avisos.join(' · ')}.</p> : null}
      </div>
      <span className="hint">Nada é salvo sem você conferir e tocar em salvar.</span>
    </section>
  );
}
// botões para resolver uma região pendente da frase
export function Pendencias({ pend, onLado, onSel }: { pend: Pendente[]; onLado: (p: Pendente, l: 'd' | 'e') => void; onSel: (k: string) => void }) {
  if (!pend.length) return null;
  return (
    <div className="diga-pends" role="group" aria-label="Regiões para completar">
      {pend.map((p, i) => (
        <div key={i} className="row wrap" style={{ gap: 6, alignItems: 'center' }}>
          <span className="apoio grow">{textoPendente(p)}</span>
          {p.falta === 'lado'
            ? (['e', 'd'] as const).map((l) => <button key={l} type="button" className="chip" onClick={() => onLado(p, l)}>{l === 'e' ? 'Esquerda' : 'Direita'}</button>)
            : <button type="button" className="chip" onClick={() => onSel(chave(p.id, p.lado))}>Marcar no mapa</button>}
        </div>))}
    </div>
  );
}
export { nomeRegiao };
