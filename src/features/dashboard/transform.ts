// =============================================================================
// Transformações puras para os dashboards. Sem React, sem I/O — fáceis de testar.
// Leem dados JÁ persistidos (activities, splits, zonas do atleta, streams) e
// produzem as séries que os gráficos consomem. Não recalculam splits no front.
// =============================================================================

export interface DashActivity {
  id: string;
  data: string; // ISO
  tipo: string | null;
  distancia_m: number | null;
  duracao_s: number | null;
  pace_medio: number | null; // s/km
  fc_media: number | null;
  fc_max: number | null;
  rpe: number | null;
  dor_flag: boolean;
  quality_status: string;
  confirmed_at: string | null;
  source: string;
}

export interface DashSplit {
  activity_id: string;
  km_index: number;
  distancia_m: number;
  parcial: boolean;
  pace_s_por_km: number | null;
  fc_media: number | null;
  fc_max: number | null;
  gap_s_por_km: number | null;
}

export interface HrZone {
  zona: number;
  nome: string;
  fc_min: number;
  fc_max: number;
}

export interface StreamSampleLite {
  time_s: number;
  hr: number | null;
}

// -----------------------------------------------------------------------------
// Tendência semanal: pace médio, FC média e eficiência (pace/FC) por semana.
// Só treinos de corrida (com pace e FC). Escalas diferentes → o gráfico usa
// small multiples (um mini-gráfico por métrica), nunca eixo duplo.
// -----------------------------------------------------------------------------
export interface WeekPoint {
  weekStart: string; // ISO date (segunda-feira)
  label: string; // "dd/mm"
  n: number; // nº de treinos na semana
  pace: number | null; // s/km médio
  fc: number | null; // bpm médio
  efic: number | null; // pace/FC (s/km por bpm); menor = mais eficiente
}

/** Segunda-feira (00:00 UTC) da semana de uma data ISO. */
function mondayOf(iso: string): Date {
  const d = new Date(iso);
  const u = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = u.getUTCDay(); // 0=dom..6=sáb
  const diff = (dow + 6) % 7; // dias desde a segunda
  u.setUTCDate(u.getUTCDate() - diff);
  return u;
}

function ddmm(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`;
}

export function weeklyTrend(activities: DashActivity[]): WeekPoint[] {
  const buckets = new Map<string, { start: Date; paces: number[]; fcs: number[] }>();
  for (const a of activities) {
    // Só CORRIDAS (têm pace). Exclui bike/força/mobilidade, que não têm pace e
    // cuja FC (mais baixa) distorceria a média de FC da semana.
    if (a.pace_medio == null) continue;
    const mon = mondayOf(a.data);
    const key = mon.toISOString().slice(0, 10);
    let b = buckets.get(key);
    if (!b) {
      b = { start: mon, paces: [], fcs: [] };
      buckets.set(key, b);
    }
    if (a.pace_medio != null) b.paces.push(a.pace_medio);
    if (a.fc_media != null) b.fcs.push(a.fc_media);
  }
  const rows = [...buckets.values()]
    .sort((x, y) => x.start.getTime() - y.start.getTime())
    .map((b) => {
      const pace = avg(b.paces);
      const fc = avg(b.fcs);
      return {
        weekStart: b.start.toISOString().slice(0, 10),
        label: ddmm(b.start),
        n: Math.max(b.paces.length, b.fcs.length),
        pace,
        fc,
        efic: pace != null && fc != null && fc > 0 ? round(pace / fc, 3) : null,
      };
    });
  return rows;
}

// -----------------------------------------------------------------------------
// Comparativo por km: sobrepõe treinos do mesmo tipo (ex: longões), cada um uma
// linha ao longo dos kms. Mais antigo com opacidade menor, mais recente em
// destaque — automático, sem seleção manual. Kms parciais são excluídos da
// linha (pace de trecho curto distorce).
// -----------------------------------------------------------------------------
export interface KmSeries {
  activityId: string;
  dateISO: string;
  label: string; // "dd/mm"
  isLatest: boolean;
  opacity: number; // 0.35 (antigo) .. 1 (recente)
  points: { km: number; pace: number | null; fc: number | null }[];
}

/** Conta atividades que casam com `match` mas NÃO têm splits (não plotáveis). */
export function countWithoutSplits(
  activities: DashActivity[],
  splitsByActivity: Map<string, DashSplit[]>,
  match: (a: DashActivity) => boolean,
): number {
  return activities.filter(
    (a) => match(a) && (splitsByActivity.get(a.id)?.length ?? 0) === 0,
  ).length;
}

export function kmSeries(
  activities: DashActivity[],
  splitsByActivity: Map<string, DashSplit[]>,
  match: (a: DashActivity) => boolean,
): KmSeries[] {
  const withSplits = activities
    .filter((a) => match(a) && (splitsByActivity.get(a.id)?.length ?? 0) > 0)
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  const n = withSplits.length;
  return withSplits.map((a, i) => {
    const splits = [...(splitsByActivity.get(a.id) ?? [])]
      .filter((s) => !s.parcial)
      .sort((x, y) => x.km_index - y.km_index);
    const isLatest = i === n - 1;
    // Rampa linear de opacidade; o mais recente vai a 1.
    const opacity = n <= 1 ? 1 : round(0.35 + (0.65 * i) / (n - 1), 2);
    const d = new Date(a.data);
    return {
      activityId: a.id,
      dateISO: a.data,
      label: ddmm(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))),
      isLatest,
      opacity: isLatest ? 1 : opacity,
      points: splits.map((s) => ({
        km: s.km_index,
        pace: s.pace_s_por_km,
        fc: s.fc_media,
      })),
    };
  });
}

/** Junta séries de vários treinos num formato "wide" para o Recharts:
 *  cada linha = um km; cada treino = uma coluna paceOf(id)/fcOf(id). */
export function toWideByKm(
  series: KmSeries[],
  metric: 'pace' | 'fc',
): { rows: Array<Record<string, number | null>>; keys: string[] } {
  const maxKm = series.reduce(
    (m, s) => Math.max(m, s.points.reduce((mm, p) => Math.max(mm, p.km), 0)),
    0,
  );
  const keys = series.map((s) => s.activityId);
  const rows: Array<Record<string, number | null>> = [];
  for (let km = 1; km <= maxKm; km++) {
    const row: Record<string, number | null> = { km };
    for (const s of series) {
      const pt = s.points.find((p) => p.km === km);
      row[s.activityId] = pt ? pt[metric] : null;
    }
    rows.push(row);
  }
  return { rows, keys };
}

// -----------------------------------------------------------------------------
// Tempo em cada zona de FC, a partir dos streams (hr por segundo) de UM treino.
// Usa as zonas do atleta. Some entre treinos com aggregateZones().
// -----------------------------------------------------------------------------
export interface ZoneTime {
  zona: number;
  nome: string;
  fc_min: number;
  fc_max: number;
  segundos: number;
}

export function timeInZones(samples: StreamSampleLite[], zonas: HrZone[]): ZoneTime[] {
  const base: ZoneTime[] = zonas
    .slice()
    .sort((a, b) => a.zona - b.zona)
    .map((z) => ({ ...z, segundos: 0 }));
  if (base.length === 0) return base;

  const zoneOf = (hr: number): ZoneTime | null => {
    for (let i = 0; i < base.length; i++) {
      const z = base[i];
      const isLast = i === base.length - 1;
      if (hr >= z.fc_min && (hr < z.fc_max || (isLast && hr <= z.fc_max))) return z;
    }
    // Abaixo da Z1 → conta na Z1; acima da última → última.
    if (hr < base[0].fc_min) return base[0];
    return base[base.length - 1];
  };

  for (let i = 0; i < samples.length - 1; i++) {
    const dt = samples[i + 1].time_s - samples[i].time_s;
    const hr = samples[i].hr;
    if (dt <= 0 || hr == null) continue;
    const z = zoneOf(hr);
    if (z) z.segundos += dt;
  }
  return base;
}

/** Soma tempos em zona de vários treinos (mesmas zonas). */
export function aggregateZones(list: ZoneTime[][]): ZoneTime[] {
  const acc = new Map<number, ZoneTime>();
  for (const zt of list) {
    for (const z of zt) {
      const cur = acc.get(z.zona);
      if (cur) cur.segundos += z.segundos;
      else acc.set(z.zona, { ...z });
    }
  }
  return [...acc.values()].sort((a, b) => a.zona - b.zona);
}

// -----------------------------------------------------------------------------
function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return round(xs.reduce((s, v) => s + v, 0) / xs.length, 2);
}
function round(x: number, d: number): number {
  const f = 10 ** d;
  return Math.round(x * f) / f;
}
