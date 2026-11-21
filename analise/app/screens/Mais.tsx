// MAIS (celular): lista dos destinos que no computador ficam no trilho lateral.
import { IconDeviceWatch, IconFlag, IconReportAnalytics, IconMoon, IconBarbell, IconBook2, IconSettings, IconChevronRight, IconShoe } from '@tabler/icons-react';
import { href } from '../route';
import { useApex } from '../store';
import { noEmoji } from '../fmt';
import { PageHead } from '../Shell';
import { Card } from '../ui';

const ITEMS = [
  ['maratona', 'Ciclo de prova', 'Fases, plano da semana, ritmo de prova e estimativa', IconFlag],
  ['relatorio', 'Relatório semanal', 'Um card por semana, com a lição', IconReportAnalytics],
  ['recuperacao', 'Recuperação', 'Sono, FC de repouso, HRV e Apple Saúde', IconMoon],
  ['forca', 'Força e canela', 'Programa de reforço e protocolo de canela', IconBarbell],
  ['equipamentos', 'Equipamentos', 'Tênis e bike: km e quando trocar', IconShoe],
  ['livro', 'Livro de fórmulas', 'O que cada número significa', IconBook2],
  ['garmin', 'Garmin', 'Treinos do relógio entrando sozinhos', IconDeviceWatch],
  ['config', 'Configurações', 'Atleta, ciclo, zonas, aparência, sincronizar e dados', IconSettings],
] as const;

export function Mais() {
  const { st } = useApex();
  // o subtítulo do ciclo mostra a prova atual (São Silvestre, meia, maratona…)
  const sub = (k: string, s0: string) => (k === 'maratona' && st.race && st.race.name ? noEmoji(st.race.name) + ' · ' + s0.toLowerCase() : s0);
  return (<>
    <PageHead title="Mais" />
    <Card style={{ paddingTop: 4, paddingBottom: 4 }}>
      <nav className="list" aria-label="Mais">
        {ITEMS.map(([k, t, s, I]) => (
          <a key={k} className="item-row" href={href('mais', k)}>
            <I size={22} stroke={1.75} color="var(--ciano)" aria-hidden="true" />
            <div className="grow stack" style={{ gap: 0 }}><span className="t">{t}</span><span className="s">{sub(k, s)}</span></div>
            <IconChevronRight size={20} stroke={1.75} className="faint" aria-hidden="true" />
          </a>
        ))}
      </nav>
    </Card>
  </>);
}
