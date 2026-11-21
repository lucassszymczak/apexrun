// "AMANHÃ CEDO" (Fase 4 · item 6 aprovado em 21/11, docs/fase4-formulas.md). Módulo puro.
// Para cada hora cheia da janela de treino: custo do clima (regra temperatura + orvalho; 0 em
// clima padrão), chance de chuva e vento. Chuva ≥ 50% descarta a hora; vento ≥ 20 km/h só avisa;
// vence o menor custo e, no empate, a hora mais cedo.
import { correcaoDaHora } from './plano.mjs';

export const CHUVA_DESCARTA = 50;  // %
export const VENTO_AVISA = 20;     // km/h (o mesmo limite das etiquetas de clima do app)
export const JANELA_PADRAO = { de: '05:00', ate: '10:00' };
export const MEIO_DIA = 12;        // o card aparece do meio-dia à meia-noite

const hInt = (s) => +String(s).slice(0, 2);
// horas cheias da janela, inclusive o início e o fim (5h a 10h = 5, 6, 7, 8, 9 e 10)
export function horasDaJanela(janela = JANELA_PADRAO) {
  const a = hInt(janela.de), b = hInt(janela.ate), out = [];
  for (let h = a; h <= b; h++) out.push(h);
  return out;
}
export function melhorHorario(horasPrevisao, janela = JANELA_PADRAO, athlete = null) {
  const hs = horasDaJanela(janela);
  const linhas = hs.map((h) => {
    const p = (horasPrevisao || []).find((x) => hInt(x.hora) === h);
    if (!p) return { h, semDado: true };
    const custo = correcaoDaHora(p, athlete); // null = calor extremo (sem número)
    const chuva = p.chuvaPct != null && p.chuvaPct >= CHUVA_DESCARTA;
    const vento = p.ventoKmh != null && p.ventoKmh >= VENTO_AVISA;
    return { h, tempC: p.tempC, dewC: p.dewC, chuvaPct: p.chuvaPct, ventoKmh: p.ventoKmh, custo, chuva, vento, extremo: custo == null, padrao: custo === 0 };
  });
  const validas = linhas.filter((l) => !l.semDado && !l.chuva && !l.extremo);
  const melhor = validas.length ? validas.reduce((b, l) => (l.custo < b.custo ? l : b), validas[0]) : null; // reduce mantém a mais cedo no empate
  // a hora descartada pela chuva que teria vencido (para a frase "5h também…")
  const descartada = linhas.filter((l) => l.chuva && !l.extremo && melhor && l.custo <= melhor.custo)[0] || null;
  return { linhas, melhor, descartada, todasComChuva: !validas.length && linhas.some((l) => l.chuva) };
}
// o card aparece do meio-dia à meia-noite
export const mostraAgora = (agora) => agora.getHours() >= MEIO_DIA;
export function amanhaIso(agora) { const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// Ponto automático: de onde a maioria dos últimos 10 treinos começou (células de ~1 km),
// calculado no aparelho. Devolve a média dos pontos da célula mais comum.
export function pontoAutomatico(workouts) {
  const ws = (workouts || []).filter((w) => w && w.geo && w.geo.lat != null && w.geo.lon != null)
    .slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 10);
  if (!ws.length) return null;
  const cel = new Map();
  for (const w of ws) { const k = Math.round(w.geo.lat * 100) + ':' + Math.round(w.geo.lon * 100); const c = cel.get(k) || []; c.push(w.geo); cel.set(k, c); }
  const melhor = [...cel.values()].sort((a, b) => b.length - a.length)[0];
  return { lat: melhor.reduce((s, g) => s + g.lat, 0) / melhor.length, lon: melhor.reduce((s, g) => s + g.lon, 0) / melhor.length, n: melhor.length, de: ws.length };
}
