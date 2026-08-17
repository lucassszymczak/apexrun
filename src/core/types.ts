// =============================================================================
// Tipos normalizados do núcleo de ingestão (parsing → splits → conferência).
// Runtime-agnóstico: roda igual no browser (preview) e numa Edge Function (Deno).
// =============================================================================

export type SourceFormat = 'fit' | 'gpx' | 'tcx';

/** Uma amostra pontual dos streams, já normalizada (unidades SI). */
export interface StreamSample {
  /** Segundos decorridos desde o início da atividade (tempo de relógio). */
  time_s: number;
  /** Distância acumulada em metros (ao longo do percurso). */
  distance_m: number;
  /** Frequência cardíaca instantânea (bpm) ou null se ausente. */
  hr: number | null;
  /** Altitude em metros ou null. */
  altitude_m: number | null;
  lat: number | null;
  lng: number | null;
  /** Velocidade instantânea em m/s (quando o formato fornece) ou null. */
  speed_mps: number | null;
  /** Cadência em passos/min (spm) ou null. */
  cadence_spm: number | null;
}

/**
 * Resumo declarado pelo dispositivo/arquivo (sessão FIT, <Lap> TCX, etc.).
 * Usado APENAS para cross-check na conferência — nunca como fonte dos cálculos
 * por km. A fonte de verdade das métricas são os `samples`.
 */
export interface DeviceSummary {
  sport: string | null;
  start_time: string | null; // ISO 8601
  total_distance_m: number | null;
  total_timer_s: number | null; // tempo em movimento declarado
  total_elapsed_s: number | null; // tempo total declarado
  total_ascent_m: number | null;
  total_descent_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_speed_mps: number | null;
  avg_cadence_spm: number | null;
}

export interface ParsedActivity {
  source_format: SourceFormat;
  samples: StreamSample[];
  device: DeviceSummary;
}

// -----------------------------------------------------------------------------
// Saídas dos cálculos
// -----------------------------------------------------------------------------

/** Split por km. NULL numa métrica = "dados insuficientes" (nunca inventamos). */
export interface SplitResult {
  km_index: number;
  distancia_m: number;
  /** true quando o km é incompleto (último trecho < 1000m). */
  parcial: boolean;
  duracao_s: number | null;
  pace_s_por_km: number | null;
  fc_media: number | null;
  fc_max: number | null;
  elevacao_ganho_m: number | null;
  /** GAP (Grade Adjusted Pace) em s/km via Minetti. NULL sem elevação. */
  gap_s_por_km: number | null;
}

export type IssueSeverity = 'info' | 'warning' | 'error';

/** Um achado da camada de conferência (vira uma linha em data_issues). */
export interface QualityIssue {
  tipo: string;
  severidade: IssueSeverity;
  descricao: string;
  km_index?: number | null;
}

export interface CardiacDrift {
  /** Só é confiável quando o pace se manteve estável entre as metades. */
  pace_estavel: boolean;
  variacao_pace_s_por_km: number | null;
  fc_media_1a_metade: number | null;
  fc_media_2a_metade: number | null;
  delta_bpm: number | null;
}

export interface QualityMetrics {
  distancia_total_m: number | null;
  duracao_movel_s: number | null;
  duracao_total_s: number | null;
  pace_medio_s_por_km: number | null;
  gap_medio_s_por_km: number | null;
  fc_media: number | null;
  fc_max: number | null;
  elevacao_ganho_m: number | null;
  cardiac_drift: CardiacDrift | null;
}

/** Relatório de conferência que vai para activities.quality_report (jsonb). */
export interface QualityReport {
  status: 'ok' | 'warning' | 'rejected';
  gerado_em: string; // ISO
  source_format: SourceFormat;
  metrics: QualityMetrics;
  /** Detalhe estruturado de cada checagem executada. */
  checagens: Record<string, unknown>;
  issues: QualityIssue[];
}

/** Resultado completo da ingestão de um arquivo (pré-persistência). */
export interface IngestResult {
  metrics: QualityMetrics;
  splits: SplitResult[];
  report: QualityReport;
  device: DeviceSummary;
}
