import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { IconAlertTriangle, IconCircleCheck, IconAlertCircle, IconInfoCircle, IconX, IconBook2 } from '@tabler/icons-react';
import * as E from '../engine.mjs';
import { safeRich, noEmoji, type Tone } from './fmt';
import { href } from './route';
import simbolo from '../../design/marca/apex-simbolo-fundo-escuro-transparente.svg';

export const IC = { size: 20, stroke: 1.75 } as const;

// Símbolo oficial (arquivo de design/marca — nunca redesenhado).
export function Simbolo({ size = 28, className }: { size?: number; className?: string }) {
  return <img src={simbolo} width={size} height={Math.round(size * 0.9)} alt="" aria-hidden="true" className={className} />;
}

export function Rich({ html, as: Tag = 'span', className }: { html: string; as?: any; className?: string }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: safeRich(html) }} />;
}

export function Card({ children, className = '', as: Tag = 'section', ...rest }: { children: ReactNode; className?: string; as?: any; [k: string]: any }) {
  return <Tag className={'card ' + className} {...rest}>{children}</Tag>;
}
export function CardH({ title, icon, right, level = 2 }: { title: ReactNode; icon?: ReactNode; right?: ReactNode; level?: 2 | 3 }) {
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <div className="card-h">
      <div className="left">{icon ? <span className="ic">{icon}</span> : null}<H>{title}</H></div>
      {right}
    </div>
  );
}

const TONE_ICON = { ok: IconCircleCheck, atencao: IconAlertCircle, alerta: IconAlertTriangle, neutro: IconInfoCircle };
// Estado = ícone + palavra (a cor nunca aparece sozinha)
export function StateBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const I = TONE_ICON[tone];
  return <span className={'badge ' + tone}><I size={12} stroke={2} aria-hidden="true" />{children}</span>;
}
export function Conf({ level }: { level: string | null | undefined }) {
  if (!level) return null;
  const l = String(level).replace('*', '');
  const tone: Tone = /alta/i.test(l) ? 'ok' : /m[ée]dia|moderada|estimada/i.test(l) ? 'atencao' : /baixa|insuf|plano|sem dados/i.test(l) ? 'alerta' : 'neutro';
  return <span className={'badge ' + (tone === 'neutro' ? 'neutro' : tone)} title="Confiança">confiança {l}</span>;
}

export function Ring({ value, tone, label, size = 92, stroke = 8, lg }: { value: number; tone: Tone; label: string; size?: number; stroke?: number; lg?: boolean }) {
  const r = (size - stroke) / 2 - 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, value)) / 100;
  const col = tone === 'ok' ? 'var(--ok)' : tone === 'atencao' ? 'var(--atencao)' : tone === 'alerta' ? 'var(--alerta)' : 'var(--ciano)';
  return (
    <div className={'ring' + (lg ? ' lg' : '')} style={lg ? undefined : { width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${value} de 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--superficie-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="in" aria-hidden="true"><b>{value}</b><small>{label === 'de 100' ? '/100' : label}</small></div>
    </div>
  );
}

export function Bar({ pct, color }: { pct: number; color?: string }) {
  return <div className="bar" role="presentation"><i style={{ width: Math.max(0, Math.min(100, pct)) + '%', background: color }} /></div>;
}

export function Empty({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return <div className="empty">{icon ? <span className="ic">{icon}</span> : null}<div>{children}</div></div>;
}

// ---------------- Folha do KPI ----------------
// Abre ao tocar em qualquer número: o que significa, o seu valor e faixa, a
// confiança e "Ver no Livro de fórmulas". Textos = Livro de fórmulas atual.
export type KpiInfo = { doc: string; value?: ReactNode; band?: ReactNode; conf?: string | null; title?: string };
const KpiCtx = createContext<(k: KpiInfo) => void>(() => {});
export const useKpi = () => useContext(KpiCtx);

export function KpiProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<KpiInfo | null>(null);
  const last = useRef<HTMLElement | null>(null);
  const show = (k: KpiInfo) => { last.current = document.activeElement as HTMLElement; setOpen(k); };
  const close = () => { setOpen(null); setTimeout(() => last.current?.focus?.(), 0); };
  return (
    <KpiCtx.Provider value={show}>
      {children}
      {open ? <KpiSheet info={open} onClose={close} /> : null}
    </KpiCtx.Provider>
  );
}

function firstSentence(html: string): string {
  const plain = String(html).replace(/<[^>]+>/g, '');
  const m = /^(.+?[.!?])(\s|$)/.exec(plain);
  return m ? m[1] : plain;
}

export function Sheet({ title, onClose, children, labelId = 'sheet-title' }: { title: ReactNode; onClose: () => void; children: ReactNode; labelId?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && box.current) {
        const f = box.current.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    box.current?.querySelector<HTMLElement>('button')?.focus();
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="sheet-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelId} ref={box}>
        <div className="grip" aria-hidden="true" />
        <div className="sheet-h">
          <h2 id={labelId}>{title}</h2>
          <button className="iconbtn" onClick={onClose} aria-label="Fechar"><IconX size={22} stroke={1.75} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Apelidos de busca no Livro: "gap" casava primeiro com "Pace-GAP @ FC_REF (145)" (KPI
// retirado da interface a pedido do Lucas, 20/11); o certo é o ritmo ajustado à inclinação.
const DOC_ALIAS: Record<string, string> = { gap: 'ritmo ajustado' };
export const docFor = (k: string) => E.kpiDoc(DOC_ALIAS[k] || k);

function KpiSheet({ info, onClose }: { info: KpiInfo; onClose: () => void }) {
  const doc = docFor(info.doc);
  const name = noEmoji(info.title || (doc ? doc.name : info.doc));
  const conf = info.conf ?? (doc ? doc.conf : null);
  const todo: string[][] | undefined = E.KPI_TODO[info.doc];
  const livro = doc ? href('mais', 'livro') + '?k=' + encodeURIComponent(doc.key || doc.name) : href('mais', 'livro');
  return (
    <Sheet title={name} onClose={onClose} labelId="kpi-sheet-title">
      {doc ? <p className="lead">{firstSentence(doc.desc)}</p> : null}
      {info.value != null ? (
        <div className="card" style={{ background: 'var(--superficie-2)' }}>
          <span className="cap">Seu valor</span>
          <div className="big">{info.value}</div>
          {info.band ? <div className="muted">{info.band}</div> : null}
        </div>
      ) : null}
      <div className="row wrap"><Conf level={conf} /></div>
      {doc ? <Rich as="p" className="hint" html={doc.desc} /> : null}
      {doc && doc.formula ? <pre className="formula">{doc.formula}</pre> : null}
      {doc && doc.fields ? <p className="hint">De onde vem o dado: {doc.fields}</p> : null}
      {todo ? (
        <ul className="insights">
          {todo.map((t, i) => <li key={i}><span className="dot ciano" /><span><b>{t[1]}:</b> {noEmoji(t[2])}</span></li>)}
        </ul>
      ) : null}
      <a className="btn quiet" href={livro} onClick={onClose}><IconBook2 {...IC} aria-hidden="true" />Ver no Livro de fórmulas</a>
    </Sheet>
  );
}

// Número tocável. `doc` = chave/nome do Livro de fórmulas.
export function Kpi({ doc, value, band, conf, title, children, className = '', label }: { doc: string; value?: ReactNode; band?: ReactNode; conf?: string | null; title?: string; children: ReactNode; className?: string; label?: string }) {
  const show = useKpi();
  return (
    <button type="button" className={'kpi ' + className} onClick={() => show({ doc, value: value ?? children, band, conf, title })}
      aria-label={label ? label + ' — o que significa' : undefined}>
      {children}
    </button>
  );
}

export function Stat({ v, l, doc, band, conf, title }: { v: ReactNode; l: string; doc?: string; band?: ReactNode; conf?: string | null; title?: string }) {
  const body = <><span className="v">{v}</span><span className="l">{l}</span></>;
  if (!doc) return <div className="stat">{body}</div>;
  return <Kpi doc={doc} value={v} band={band} conf={conf} title={title} className="stat" label={l}>{body}</Kpi>;
}

export function KV({ k, v, doc, band }: { k: ReactNode; v: ReactNode; doc?: string; band?: ReactNode }) {
  return <div className="kv"><span>{k}</span><b>{doc ? <Kpi doc={doc} value={v} band={band}>{v}</Kpi> : v}</b></div>;
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

// Régua com faixas e marcador (scaleWidget do app antigo). segs: até onde vai cada faixa.
export function Scale({ min, max, val, valText, segs }: { min: number; max: number; val: number; valText: string; segs: { to: number; label: string; c: string }[] }) {
  const pos = (x: number) => Math.max(0, Math.min(100, ((x - min) / (max - min)) * 100));
  let from = min;
  const cur = segs.find((s) => val <= s.to) || segs[segs.length - 1];
  return (
    <div className="scale" role="img" aria-label={`Você: ${valText} — faixa ${cur.label}`}>
      <div className="scale-track">
        {segs.map((s, i) => { const l = pos(from), w = pos(s.to) - l; from = s.to; return <i key={i} style={{ left: l + '%', width: w + '%', background: s.c }} />; })}
        <b className="scale-mk" style={{ left: pos(val) + '%' }} />
      </div>
      <div className="scale-labels">{segs.map((s, i) => <span key={i} style={{ color: s === cur ? 'var(--texto)' : undefined, fontWeight: s === cur ? 500 : 400 }}>{s.label}</span>)}</div>
      <span className="apoio muted">você · <b className="tn" style={{ color: 'var(--texto)' }}>{valText}</b> · {cur.label.toLowerCase()}</span>
    </div>
  );
}
