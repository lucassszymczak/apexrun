// =============================================================================
// Tipos do banco (espelham as migrations em supabase/migrations).
// Fonte única de verdade compartilhada entre frontend e Edge Functions.
// Se o schema mudar, atualize AQUI (ou gere com `supabase gen types typescript`).
// =============================================================================

export type ActivitySource = 'strava' | 'fit_upload' | 'manual';

// 'pending' = extraído, aguardando confirmação do usuário (regra do treinador).
export type QualityStatus = 'pending' | 'ok' | 'warning' | 'rejected';

export type IssueSeverity = 'info' | 'warning' | 'error';

export interface HrZone {
  zona: number;
  nome: string;
  fc_min: number;
  fc_max: number;
}

export interface Athlete {
  id: string;
  user_id: string | null;
  nome: string;
  idade: number | null;
  sexo: string | null;
  altura_cm: number | null;
  peso_inicial_kg: number | null;
  cidade: string | null;
  fc_max_estimada: number | null;
  zonas_fc: HrZone[];
  // Formato flexível — ver comentário na migration.
  pace_calibracao: Record<string, unknown>;
  meta_prova: Record<string, unknown>;
  flags_clinicas: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AthleteNote {
  id: string;
  athlete_id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  dados: Record<string, unknown>;
  created_at: string;
}

export interface Activity {
  id: string;
  athlete_id: string;
  external_id: string | null;
  source: ActivitySource;
  data: string; // ISO timestamp
  tipo: string | null;
  distancia_m: number | null;
  duracao_s: number | null;
  pace_medio: number | null; // s/km
  fc_media: number | null;
  fc_max: number | null;
  elevacao_ganho_m: number | null;
  rpe: number | null;
  dor_flag: boolean;
  dor_desc: string | null;
  obs: string | null;
  quality_status: QualityStatus;
  quality_report: Record<string, unknown>;
  confirmed_at: string | null;
  raw_streams: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Split {
  id: string;
  activity_id: string;
  km_index: number;
  distancia_m: number;
  parcial: boolean;
  duracao_s: number | null;
  pace_s_por_km: number | null;
  fc_media: number | null;
  fc_max: number | null;
  elevacao_ganho_m: number | null;
  gap_s_por_km: number | null; // null = dados insuficientes
  created_at: string;
}

export interface DataIssue {
  id: string;
  activity_id: string;
  tipo: string;
  severidade: IssueSeverity;
  descricao: string;
  km_index: number | null;
  resolvido: boolean;
  created_at: string;
}
