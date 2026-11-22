import { useEffect, type ReactNode } from 'react';
import { useRoute } from './route';
import { Shell, PageHead } from './Shell';
import { KpiProvider, Card } from './ui';
import { Hoje } from './screens/Hoje';
import * as S from './screens/index';

function Stub({ title }: { title: string }): ReactNode {
  return (<><PageHead title={title} /><Card><p className="muted">Em construção.</p></Card></>);
}

function Screen() {
  const r = useRoute();
  switch (r.name) {
    case 'hoje': return <Hoje />;
    case 'coach': return S.Coach ? <S.Coach /> : <Stub title="Leitura do Coach" />;
    case 'treinos': return S.Treinos ? <S.Treinos /> : <Stub title="Treinos" />;
    case 'treino': if (r.parts[2] === 'resumo') return <S.Resumo id={r.arg || ''} />; return S.Treino ? <S.Treino id={r.arg || ''} /> : <Stub title="Treino" />;
    case 'completar': return <S.Completar id={r.arg || ''} />;
    case 'compartilhar': return <S.Compartilhar id={r.arg || ''} />;
    case 'importar': return S.Importar ? <S.Importar /> : <Stub title="Importar treino" />;
    case 'editar': return S.TreinoForm ? <S.TreinoForm id={r.arg} /> : <Stub title="Editar treino" />;
    case 'progresso': if (r.arg === 'consistencia') return <S.Consistencia />; if (r.arg === 'calor') return <S.MapaCalor />; if (r.arg === 'corpo') return <S.ProgressoCorpo />; if (r.arg === 'segmentos') return <S.Segmentos id={r.parts[2] || null} />; return S.Progresso ? <S.Progresso sys={r.arg} /> : <Stub title="Progresso" />;
    case 'mais': {
      const m: Record<string, any> = { maratona: S.Maratona, relatorio: S.Relatorio, recuperacao: S.Recuperacao, forca: S.Forca, livro: S.Livro, config: S.Config, garmin: S.Garmin, ciclo: S.EditarCiclo, percurso: S.Percurso, plano: S.PlanoProva, simulador: S.Simulador, treino: S.ConfigTreino, equipamentos: S.Equipamentos, retrospectiva: S.Retrospectiva };
      if (!r.arg) return S.Mais ? <S.Mais /> : <Stub title="Mais" />;
      const C = m[r.arg];
      return C ? <C sub={r.parts[2] || null} /> : <Stub title="Mais" />;
    }
    default: return <Hoje />;
  }
}

export function App() {
  const r = useRoute();
  // título da aba do navegador acompanha a tela
  useEffect(() => { document.title = 'Apex Performance'; }, [r.name]);
  return (
    <KpiProvider>
      <Shell><Screen /></Shell>
    </KpiProvider>
  );
}
