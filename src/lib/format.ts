// Helpers de formatação para exibição (pace, tempo, distância).

/** Pace em s/km → "m:ss/km". Trata o arredondamento de 60s corretamente. */
export function formatPace(sPerKm: number | null | undefined): string {
  if (sPerKm == null) return '—';
  let m = Math.floor(sPerKm / 60);
  let s = Math.round(sPerKm - m * 60);
  if (s === 60) {
    s = 0;
    m += 1;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Segundos → "H:MM:SS" (ou "M:SS" se < 1h). */
export function formatDuration(totalS: number | null | undefined): string {
  if (totalS == null) return '—';
  const s = Math.round(totalS);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Metros → "x,xx km". */
export function formatKm(m: number | null | undefined): string {
  if (m == null) return '—';
  return `${(m / 1000).toFixed(2)} km`;
}
