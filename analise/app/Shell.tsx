import type { ReactNode } from 'react';
import { IconHome, IconRoute, IconTrendingUp, IconDots, IconPlus, IconChevronLeft } from '@tabler/icons-react';
import { href, useRoute } from './route';
import { Simbolo, IC } from './ui';
import { useToasts, useApex } from './store';

export const MAIS = [
  ['maratona', 'Maratona'],
  ['relatorio', 'Relatório semanal'],
  ['recuperacao', 'Recuperação'],
  ['forca', 'Força e canela'],
  ['livro', 'Livro de fórmulas'],
  ['config', 'Configurações'],
] as const;

function section(name: string): string {
  if (name === 'treino' || name === 'treinos' || name === 'editar' || name === 'compartilhar') return 'treinos';
  if (name === 'progresso') return 'progresso';
  if (name === 'mais' || name === 'coach') return 'mais';
  if (name === 'importar' || name === 'novo') return 'importar';
  return 'hoje';
}

export function Shell({ children }: { children: ReactNode }) {
  const r = useRoute();
  const sec = section(r.name);
  const cur = (s: string) => (sec === s ? 'page' : undefined);
  const curMais = (k: string) => (r.name === 'mais' && r.arg === k ? 'page' : undefined);
  const toasts = useToasts();
  return (
    <div className={'app' + (r.name === 'treino' ? ' immersive' : r.name === 'compartilhar' ? ' focus' : '')}>
      <a href="#conteudo" className="sr-only">Pular para o conteúdo</a>
      <nav className="rail" aria-label="Navegação principal">
        <a className="logo" href={href('hoje')}><Simbolo size={30} /><span>Apex <em>Performance</em></span></a>
        <a className="item" href={href('hoje')} aria-current={cur('hoje')}><IconHome {...IC} aria-hidden="true" />Hoje</a>
        <a className="item" href={href('treinos')} aria-current={cur('treinos')}><IconRoute {...IC} aria-hidden="true" />Treinos</a>
        <a className="item" href={href('progresso')} aria-current={cur('progresso')}><IconTrendingUp {...IC} aria-hidden="true" />Progresso</a>
        <span className="grp">Mais</span>
        {MAIS.map(([k, l]) => <a key={k} className="item sm" href={href('mais', k)} aria-current={curMais(k)}>{l}</a>)}
        <a className="btn-primary" href={href('importar')}><IconPlus size={18} stroke={2.25} aria-hidden="true" />Importar treino</a>
      </nav>
      <main id="conteudo" className="main" tabIndex={-1}>{children}</main>
      <nav className="bottomnav" aria-label="Navegação principal">
        <a href={href('hoje')} aria-current={cur('hoje')}><IconHome size={22} stroke={1.75} aria-hidden="true" />Hoje</a>
        <a href={href('treinos')} aria-current={cur('treinos')}><IconRoute size={22} stroke={1.75} aria-hidden="true" />Treinos</a>
        <a href={href('importar')} className="plus" aria-label="Importar treino"><IconPlus size={24} stroke={2.25} aria-hidden="true" /></a>
        <a href={href('progresso')} aria-current={cur('progresso')}><IconTrendingUp size={22} stroke={1.75} aria-hidden="true" />Progresso</a>
        <a href={href('mais')} aria-current={cur('mais')}><IconDots size={22} stroke={1.75} aria-hidden="true" />Mais</a>
      </nav>
      <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>
    </div>
  );
}

// Cabeçalho de página: símbolo + título + subtítulo; no celular, avatar à direita.
// Com `back`, mostra o botão voltar no lugar do símbolo.
export function PageHead({ title, sub, back, right }: { title: ReactNode; sub?: ReactNode; back?: string; right?: ReactNode }) {
  const { st } = useApex();
  const initial = ((st && st.athlete && st.athlete.name) || 'A').trim().charAt(0).toUpperCase();
  return (
    <header className="topbar page">
      <div className="brand">
        {back ? <a className="back" href={back} aria-label="Voltar"><IconChevronLeft size={24} stroke={1.75} /></a> : <Simbolo size={28} className="mark" />}
        <div className="stack" style={{ gap: 0, minWidth: 0 }}>
          <h1>{title}</h1>
          {sub ? <span className="sub">{sub}</span> : null}
        </div>
      </div>
      {right !== undefined ? right : <a className="avatar" href={href('mais', 'config')} aria-label="Seu perfil e configurações">{initial}</a>}
    </header>
  );
}
