// Seletor do período de análise (o mesmo botão-menu da lista de Treinos), usado no topo das
// telas de análise. Mostra também o aviso quando a tela só aceita períodos atuais.
import * as E from '../../engine.mjs';
import { useApex } from '../store';
import { PeriodoMenu } from './Treinos';
import { usePeriodo, setPeriodo, opcoes, ehAtual } from '../periodo';

export function PeriodoSel({ soAtual = false }: { soAtual?: boolean }) {
  const { st } = useApex();
  const p = usePeriodo();
  const all = E.sortedWorkouts();
  let o = opcoes(all, st);
  if (soAtual) o = o.filter(([k]) => ehAtual(k, st));
  const val = o.some(([k]) => k === p) ? p : '12m';
  return <PeriodoMenu value={val} onChange={setPeriodo} options={o} label="Período de análise" />;
}
