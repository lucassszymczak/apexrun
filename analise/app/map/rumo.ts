// Rumo do trajeto num ponto (para o cursor "corredor" e a câmera em 3ª pessoa do replay).
// Só desenho: nenhum número do treino usa isto.
import type { Track } from '../track';

// rumo (0 = norte, sentido horário) do trecho em volta do ponto i, ~15 amostras para cada lado
export function rumo(tr: Track, i: number, k = 15): number | null {
  let a = i, b = i;
  for (let j = i; j >= Math.max(0, i - k); j--) if (tr.lat[j] != null) a = j;
  for (let j = i; j <= Math.min(tr.lat.length - 1, i + k); j++) if (tr.lat[j] != null) b = j;
  if (a === b || tr.lat[a] == null || tr.lat[b] == null) return null;
  const la1 = (tr.lat[a]! * Math.PI) / 180, la2 = (tr.lat[b]! * Math.PI) / 180, dl = ((tr.lon[b]! - tr.lon[a]!) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(la2), x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
