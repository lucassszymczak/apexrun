// =============================================================================
// Persistência de uma atividade revisada no Supabase (sob RLS, cliente do
// browser autenticado). Insere activities → splits → data_issues.
//
// O cliente é injetado (parâmetro) para permitir testar o MAPEAMENTO dos dados
// sem um Supabase ao vivo.
//
// Atomicidade: o JS client não abre transação entre tabelas. Se a gravação dos
// filhos (splits/issues) falhar, removemos a activity recém-criada (compensação)
// para não deixar registro órfão.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IngestResult, ParsedActivity } from '@/core/types';

/** Campos que o usuário revisa/anota antes de registrar. */
export interface ReviewInput {
  data: string; // ISO (data/hora do treino)
  tipo: string | null;
  rpe: number | null;
  dor_flag: boolean;
  dor_desc: string | null;
  obs: string | null;
}

export interface PersistArgs {
  parsed: ParsedActivity;
  result: IngestResult;
  input: ReviewInput;
  /** true = aprovar (oficial); false = rejeitar (guardado como 'rejected'). */
  official: boolean;
}

export async function persistIngest(
  client: SupabaseClient,
  { parsed, result, input, official }: PersistArgs,
): Promise<string> {
  // Atleta do usuário logado (o RLS já devolve só o dele).
  const { data: athlete, error: athErr } = await client
    .from('athletes')
    .select('id')
    .limit(1)
    .maybeSingle();
  if (athErr) throw new Error(`Erro ao buscar o atleta: ${athErr.message}`);
  if (!athlete) {
    throw new Error(
      'Nenhum atleta encontrado para este usuário. Rode o seed / crie o perfil antes de registrar.',
    );
  }

  const { metrics, report, splits } = result;

  const activityRow = {
    athlete_id: athlete.id,
    // Todo upload de arquivo (.FIT/.TCX/.GPX) usa 'fit_upload' (via de arquivo).
    // O formato exato fica em quality_report.source_format.
    source: 'fit_upload' as const,
    data: input.data,
    tipo: input.tipo,
    distancia_m: metrics.distancia_total_m,
    duracao_s: metrics.duracao_movel_s,
    pace_medio: metrics.pace_medio_s_por_km,
    fc_media: metrics.fc_media,
    fc_max: metrics.fc_max,
    elevacao_ganho_m: metrics.elevacao_ganho_m,
    rpe: input.rpe,
    dor_flag: input.dor_flag,
    dor_desc: input.dor_desc,
    obs: input.obs,
    // Aprovar → veredito automático (ok/warning); Rejeitar → 'rejected'.
    quality_status: official ? report.status : 'rejected',
    quality_report: report,
    confirmed_at: official ? new Date().toISOString() : null,
    raw_streams: {
      source_format: parsed.source_format,
      device: parsed.device,
      samples: parsed.samples,
    },
  };

  const { data: activity, error: actErr } = await client
    .from('activities')
    .insert(activityRow)
    .select('id')
    .single();
  if (actErr) throw new Error(`Erro ao salvar a atividade: ${actErr.message}`);
  const activityId = activity.id as string;

  // Filhos: splits + issues. Em caso de erro, compensa removendo a activity.
  try {
    if (splits.length > 0) {
      const splitRows = splits.map((s) => ({
        activity_id: activityId,
        km_index: s.km_index,
        distancia_m: s.distancia_m,
        parcial: s.parcial,
        duracao_s: s.duracao_s,
        pace_s_por_km: s.pace_s_por_km,
        fc_media: s.fc_media,
        fc_max: s.fc_max,
        elevacao_ganho_m: s.elevacao_ganho_m,
        gap_s_por_km: s.gap_s_por_km,
      }));
      const { error } = await client.from('splits').insert(splitRows);
      if (error) throw new Error(`Erro ao salvar os splits: ${error.message}`);
    }

    if (report.issues.length > 0) {
      const issueRows = report.issues.map((i) => ({
        activity_id: activityId,
        tipo: i.tipo,
        severidade: i.severidade,
        descricao: i.descricao,
        km_index: i.km_index ?? null,
      }));
      const { error } = await client.from('data_issues').insert(issueRows);
      if (error) throw new Error(`Erro ao salvar os problemas detectados: ${error.message}`);
    }
  } catch (childErr) {
    // Compensação: desfaz a activity órfã (best-effort).
    await client.from('activities').delete().eq('id', activityId);
    throw childErr;
  }

  return activityId;
}
