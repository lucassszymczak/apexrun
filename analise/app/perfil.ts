// PERFIL DE QUEM É NOVO (app para outras pessoas, 22/11/2026; docs/app-para-outros.md).
// O motor guarda um perfil padrão (DEFAULT_ATHLETE) com as medidas do Lucas e o usa por baixo
// de qualquer perfil. Para quem abre o app pela primeira vez, todo campo do padrão é gravado
// em branco (null), e o motor cai nos próprios padrões neutros (clima) ou mostra "—" (FC).
// Nenhuma fórmula muda: só o dado de partida. `novo: true` marca quem não é o dono do app:
// sem sincronização nem Garmin (nada passa pelos servidores do Lucas).
import * as E from '../engine.mjs';

export const TOUR_V = 1;
// campos que não podem ficar em null porque a tela espera lista ou texto
const VAZIOS: Record<string, any> = { alert: '', motorStages: [], showBaseline5k: false, fcMaxProv: false, cycleName: '', cycleWeeks: null };

export function perfilEmBranco(): Record<string, any> {
  const a: Record<string, any> = {};
  for (const k of Object.keys(E.DEFAULT_ATHLETE)) a[k] = k in VAZIOS ? VAZIOS[k] : null;
  a.novo = true;          // não é o dono do app
  a.tour = 'pendente';    // o tour de boas-vindas ainda não foi visto
  a.updatedAt = null;     // na sincronização, qualquer perfil salvo vence este
  return a;
}

// estado de quem é novo: nada do Lucas (sem os treinos, o sono e o ciclo de exemplo)
export function estadoNovo(): any {
  return { athlete: perfilEmBranco(), workouts: [], daily: [], deleted: [], race: null, races: [], planWeeks: {}, updatedAt: null, lastSyncAt: null };
}

export const ehNovo = (st: any) => !!(st && st.athlete && st.athlete.novo);
export const tourPendente = (st: any) => ehNovo(st) && st.athlete.tour === 'pendente';

// Altitude da cidade (para o ajuste de clima), pela busca de cidades do Open-Meteo, o mesmo
// serviço do clima. Vai só o nome da cidade, sem coordenada da pessoa. Sem resposta: null.
export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const UF_NOME: Record<string, string> = { AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins' };
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export async function altitudeDaCidade(cidade: string, uf: string): Promise<number | null> {
  if (!cidade.trim() || !UF_NOME[uf]) return null;
  try {
    const u = 'https://geocoding-api.open-meteo.com/v1/search?count=10&language=pt&format=json&countryCode=BR&name=' + encodeURIComponent(cidade.trim());
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(u, { signal: ctl.signal }); clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    const lista: any[] = (j && j.results) || [];
    const ok = lista.find((x) => sem(String(x.admin1 || '')) === sem(UF_NOME[uf]) && sem(String(x.name || '')) === sem(cidade));
    return ok && typeof ok.elevation === 'number' ? Math.round(ok.elevation) : null;
  } catch { return null; }
}
