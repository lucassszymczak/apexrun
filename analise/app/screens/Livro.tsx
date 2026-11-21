// LIVRO DE FÓRMULAS (Mais). Porta de renderKpis (app antigo) + busca. Textos = KPI_DOCS
// e EXTRA_DOCS atuais. É o destino do "Ver no Livro de fórmulas" da Folha do KPI (?k=…).
import { useEffect, useMemo, useRef, useState } from 'react';
import { LEITURA_DOCS } from '../leitura-docs';
import { IconSearch, IconChevronRight } from '@tabler/icons-react';
import * as E from '../../engine.mjs';
import { href } from '../route';
import { PageHead } from '../Shell';
import { Conf, Rich } from '../ui';
import { noEmoji } from '../fmt';

const CATS = ['Motor', 'Mecânica', 'Carga', 'Forma', 'Proprietário', 'Leitura do treino', 'Plano de prova', 'Evolução'];
const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function Livro() {
  const target = useMemo(() => { const m = /[?&]k=([^&]+)/.exec(location.hash); return m ? decodeURIComponent(m[1]) : null; }, []);
  const [q, setQ] = useState('');
  const openRef = useRef<HTMLDetailsElement | null>(null);
  const docs: any[] = useMemo(() => [
    // Pace-GAP @ FC_REF (145) saiu da interface a pedido do Lucas (20/11)
    ...E.KPI_DOCS.filter((d: any) => !/^Pace-GAP/.test(d.name)),
    ...Object.keys(E.EXTRA_DOCS).map((k) => Object.assign({ key: k, cat: 'Extras' }, E.EXTRA_DOCS[k])),
    ...LEITURA_DOCS,
  ], []);
  const isTarget = (d: any) => !!target && (d.key === target || d.name === target);
  useEffect(() => { if (openRef.current) openRef.current.scrollIntoView({ block: 'center' }); }, []);
  const qq = norm(q.trim());
  const match = (d: any) => !qq || norm(d.name + ' ' + d.desc + ' ' + d.formula + ' ' + (d.fields || '')).includes(qq);
  const cats = [...CATS, 'Extras'];
  return (<>
    <PageHead title="Livro de fórmulas" sub="Conceito, fórmula e o que cada KPI precisa" back={href('mais')} />
    <div className="field">
      <label htmlFor="busca-kpi" className="sr-only">Buscar no Livro de fórmulas</label>
      <div style={{ position: 'relative' }}>
        <IconSearch size={18} stroke={1.75} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--texto-3)' }} aria-hidden="true" />
        <input id="busca-kpi" type="search" placeholder="Buscar: EF, TSB, decoupling, sono…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 38 }} />
      </div>
    </div>
    {cats.map((cat) => {
      const list = docs.filter((d) => (d.cat || 'Extras') === cat && match(d));
      if (!list.length) return null;
      return (
        <section key={cat} className="stack">
          <h2 className="section-title">{cat === 'Extras' ? 'Recuperação e outros' : cat}</h2>
          {list.map((k) => (
            <details key={k.key || k.name} className="acc" open={isTarget(k) || (!!qq && list.length <= 3)} ref={isTarget(k) ? openRef : undefined} id={'kpi-' + norm(k.key || k.name).replace(/[^a-z0-9]+/g, '-')}>
              <summary><span className="grow">{noEmoji(k.name)}</span><Conf level={k.conf} /><IconChevronRight size={18} stroke={1.75} className="chev" aria-hidden="true" /></summary>
              <div className="body">
                <Rich as="p" className="apoio" html={k.desc} />
                {k.formula ? <pre className="formula">{k.formula}</pre> : null}
                {k.fields ? <p className="hint">Precisa de: {k.fields}</p> : null}
                {k.fonte ? <p className="hint">Fonte: {k.fonte}</p> : null}
              </div>
            </details>
          ))}
        </section>
      );
    })}
  </>);
}
