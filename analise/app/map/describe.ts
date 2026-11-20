// Descrição textual do trajeto para leitor de tela: distância, sentido, largada/chegada.
import { type Track, totalDist, haversine } from '../track';

export function describeRoute(tr: Track): string {
  const d = tr.draw;
  if (d.length < 2) return 'Treino sem trajeto com GPS.';
  const km = (totalDist(tr) / 1000).toFixed(2).replace('.', ',');
  const a = d[0], b = d[d.length - 1];
  const gap = haversine(tr.lat[a]!, tr.lon[a]!, tr.lat[b]!, tr.lon[b]!);
  // sentido pela área com sinal (fórmula do laço) — só faz sentido em circuito
  let area = 0;
  for (let k = 0; k < d.length; k++) { const i = d[k], j = d[(k + 1) % d.length]; area += tr.lon[i]! * tr.lat[j]! - tr.lon[j]! * tr.lat[i]!; }
  const loop = gap < 300;
  const sentido = loop ? (area > 0 ? 'circuito no sentido anti-horário' : 'circuito no sentido horário') : 'percurso de ida';
  const dir = (() => {
    const dLat = tr.lat[b]! - tr.lat[a]!, dLon = tr.lon[b]! - tr.lon[a]!;
    const ang = (Math.atan2(dLon, dLat) * 180) / Math.PI;
    const P = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
    return P[(Math.round(((ang + 360) % 360) / 45)) % 8];
  })();
  return `Mapa do trajeto: ${km} km, ${sentido}. ` + (loop ? `Largada e chegada no mesmo ponto (a ${Math.round(gap)} m).` : `A chegada fica a ${(gap / 1000).toFixed(1).replace('.', ',')} km da largada, a ${dir}.`);
}
