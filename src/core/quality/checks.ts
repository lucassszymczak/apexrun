// =============================================================================
// CAMADA DE CONFERÊNCIA (núcleo da v1)
// -----------------------------------------------------------------------------
// Roda validações determinísticas sobre os streams e gera um quality_report +
// lista de issues. NUNCA "conserta" o dado — apenas detecta e descreve, para o
// usuário confirmar antes de persistir como oficial (regra do treinador).
//
// Severidade → status: 'error' derruba para 'rejected'; 'warning' → 'warning';
// só 'info'/nada → 'ok'.
// =============================================================================

import type {
  DeviceSummary,
  QualityIssue,
  QualityMetrics,
  QualityReport,
  SourceFormat,
  SplitResult,
  StreamSample,
} from '../types';
import { haversineM } from '../geo';

// --- Limiares (documentados; ajustáveis) -------------------------------------
const GPS_MAX_SPEED_MPS = 12; // ~43 km/h: acima disso é salto de GPS, não corrida
const GPS_TIME_GAP_S = 30; // buraco de gravação entre pontos
const PAUSE_MIN_S = 30; // tempo parado (com relógio correndo) que vira alerta
const PAUSE_FRACTION = 0.05; // ou > 5% do tempo total parado
const HR_MAX_PLAUSIVEL = 210; // bpm acima disso é impossível/spike
const HR_STUCK_S = 60; // mesma FC por ~1min = cinta travada (tolerante a smart recording)
const HR_JUMP_BPM = 40; // salto abrupto entre pontos = mau contato
const DIST_TOL_FRAC = 0.01; // 1%
const DIST_TOL_MIN_M = 50; // ou 50m absolutos
const ELEV_NOISE_RATIO = 8; // variação total / ganho líquido acima disso = ruído
const DRIFT_BPM_NOTE = 5; // delta de FC que merece nota de deriva

export function runQualityChecks(
  samples: StreamSample[],
  splits: SplitResult[],
  metrics: QualityMetrics,
  device: DeviceSummary,
  sourceFormat: SourceFormat,
): QualityReport {
  const issues: QualityIssue[] = [];
  const checagens: Record<string, unknown> = {};

  checagens.gps = checkGps(samples, issues);
  checagens.pausas = checkPauses(metrics, issues);
  checagens.fc = checkHeartRate(samples, issues);
  checagens.distancia = checkDistance(splits, metrics, device, issues);
  checagens.elevacao = checkElevation(samples, metrics, issues);
  checagens.splits = checkSplits(splits, issues);
  checagens.cardiac_drift = checkDrift(metrics, issues);

  const status = deriveStatus(issues);
  return {
    status,
    gerado_em: new Date().toISOString(),
    source_format: sourceFormat,
    metrics,
    checagens,
    issues,
  };
}

// --- GPS: saltos de distância implausíveis -----------------------------------
function checkGps(samples: StreamSample[], issues: QualityIssue[]) {
  let suspeitos = 0;
  let buracos = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    const dt = b.time_s - a.time_s;
    if (dt <= 0) continue;
    const dd = b.distance_m - a.distance_m;
    // Distância pelo GPS (linha reta) quando há coordenadas.
    let hav = 0;
    if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
      hav = haversineM(a.lat, a.lng, b.lat, b.lng);
    }
    const maxMovimento = Math.max(dd, hav);
    if (maxMovimento / dt > GPS_MAX_SPEED_MPS) suspeitos += 1;
    if (dt > GPS_TIME_GAP_S) buracos += 1;
  }
  if (suspeitos > 0) {
    issues.push({
      tipo: 'gps_gap',
      severidade: 'warning',
      descricao: `${suspeitos} salto(s) de distância implausível(is) entre pontos (velocidade > ${GPS_MAX_SPEED_MPS} m/s).`,
    });
  }
  if (buracos > 0) {
    issues.push({
      tipo: 'gps_buraco_tempo',
      severidade: 'info',
      descricao: `${buracos} intervalo(s) de gravação acima de ${GPS_TIME_GAP_S}s (possível pausa ou perda de sinal).`,
    });
  }
  return { segmentos_suspeitos: suspeitos, buracos_tempo: buracos };
}

// --- Pausas / auto-pause distorcendo o pace ----------------------------------
function checkPauses(metrics: QualityMetrics, issues: QualityIssue[]) {
  const total = metrics.duracao_total_s ?? 0;
  const movel = metrics.duracao_movel_s ?? 0;
  const parado = Math.max(0, total - movel);
  const fracParado = total > 0 ? parado / total : 0;
  if (parado >= PAUSE_MIN_S && fracParado >= PAUSE_FRACTION) {
    issues.push({
      tipo: 'pausa',
      severidade: 'warning',
      descricao: `~${Math.round(parado)}s parado(s) com o relógio correndo (${Math.round(
        fracParado * 100,
      )}% do tempo). Isso distorce o pace médio; confira se houve pausa/auto-pause.`,
    });
  }
  return { tempo_parado_s: Math.round(parado), fracao_parado: round(fracParado, 3) };
}

// --- FC: ausente, travada, spikes --------------------------------------------
function checkHeartRate(samples: StreamSample[], issues: QualityIssue[]) {
  const n = samples.length;
  const comHr = samples.filter((s) => s.hr != null).length;
  const fracAusente = n > 0 ? 1 - comHr / n : 1;

  if (comHr === 0) {
    issues.push({
      tipo: 'fc_ausente',
      severidade: 'warning',
      descricao: 'Sem dados de FC nesta atividade. Métricas de FC ficam indisponíveis.',
    });
    return { com_hr: 0, frac_ausente: 1, travada_s_max: 0, spikes: 0, saltos: 0 };
  }
  if (fracAusente > 0.1) {
    issues.push({
      tipo: 'fc_parcial',
      severidade: 'info',
      descricao: `FC ausente em ${Math.round(fracAusente * 100)}% das amostras.`,
    });
  }

  // Travada: mesma FC por muitos segundos seguidos.
  let travadaMax = 0;
  let runStart = 0;
  for (let i = 1; i <= n; i++) {
    const same =
      i < n && samples[i].hr != null && samples[i].hr === samples[runStart].hr;
    if (!same) {
      if (samples[runStart].hr != null) {
        const dur = samples[Math.min(i, n) - 1].time_s - samples[runStart].time_s;
        travadaMax = Math.max(travadaMax, dur);
      }
      runStart = i;
    }
  }
  if (travadaMax >= HR_STUCK_S) {
    issues.push({
      tipo: 'fc_travada',
      severidade: 'warning',
      descricao: `FC travada no mesmo valor por ~${Math.round(travadaMax)}s (possível cinta com mau contato).`,
    });
  }

  // Spikes impossíveis e saltos abruptos.
  let spikes = 0;
  let saltos = 0;
  for (let i = 0; i < n; i++) {
    const hr = samples[i].hr;
    if (hr != null && hr > HR_MAX_PLAUSIVEL) spikes += 1;
    if (i > 0 && hr != null && samples[i - 1].hr != null) {
      if (Math.abs(hr - (samples[i - 1].hr as number)) >= HR_JUMP_BPM) saltos += 1;
    }
  }
  if (spikes > 0) {
    issues.push({
      tipo: 'fc_spike',
      severidade: 'warning',
      descricao: `${spikes} leitura(s) de FC acima de ${HR_MAX_PLAUSIVEL} bpm (impossível).`,
    });
  }
  if (saltos > 0) {
    issues.push({
      tipo: 'fc_salto',
      severidade: 'info',
      descricao: `${saltos} salto(s) abrupto(s) de FC (≥ ${HR_JUMP_BPM} bpm entre pontos).`,
    });
  }
  return {
    com_hr: comHr,
    frac_ausente: round(fracAusente, 3),
    travada_s_max: Math.round(travadaMax),
    spikes,
    saltos,
  };
}

// --- Distância total vs soma dos splits vs dispositivo ------------------------
function checkDistance(
  splits: SplitResult[],
  metrics: QualityMetrics,
  device: DeviceSummary,
  issues: QualityIssue[],
) {
  const total = metrics.distancia_total_m ?? 0;
  const somaSplits = splits.reduce((s, sp) => s + sp.distancia_m, 0);
  const tol = Math.max(DIST_TOL_MIN_M, total * DIST_TOL_FRAC);
  const deltaSplits = Math.abs(total - somaSplits);
  if (deltaSplits > tol) {
    issues.push({
      tipo: 'distancia_divergente',
      severidade: 'warning',
      descricao: `Distância total (${round(total, 1)}m) diverge da soma dos splits (${round(
        somaSplits,
        1,
      )}m) em ${round(deltaSplits, 1)}m (tolerância ${round(tol, 1)}m).`,
    });
  }
  let deltaDispositivo: number | null = null;
  if (device.total_distance_m != null) {
    deltaDispositivo = Math.abs(total - device.total_distance_m);
    if (deltaDispositivo > tol) {
      issues.push({
        tipo: 'distancia_vs_dispositivo',
        severidade: 'info',
        descricao: `Distância calculada (${round(total, 1)}m) diverge da declarada pelo dispositivo (${round(
          device.total_distance_m,
          1,
        )}m).`,
      });
    }
  }
  return {
    total_m: round(total, 1),
    soma_splits_m: round(somaSplits, 1),
    delta_splits_m: round(deltaSplits, 1),
    delta_dispositivo_m: deltaDispositivo != null ? round(deltaDispositivo, 1) : null,
    tolerancia_m: round(tol, 1),
  };
}

// --- Elevação: ausente / ruidosa ---------------------------------------------
function checkElevation(
  samples: StreamSample[],
  metrics: QualityMetrics,
  issues: QualityIssue[],
) {
  const comAlt = samples.filter((s) => s.altitude_m != null).length;
  if (comAlt === 0) {
    issues.push({
      tipo: 'elevacao_ausente',
      severidade: 'info',
      descricao: 'Sem dados de elevação; GAP e ganho por km ficam indisponíveis.',
    });
    return { com_altitude: 0, variacao_total_m: null, ganho_m: null, ratio_ruido: null };
  }
  // Variação total (subidas+descidas em módulo) vs ganho líquido → proxy de ruído.
  let variacaoTotal = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i].altitude_m;
    const b = samples[i + 1].altitude_m;
    if (a != null && b != null) variacaoTotal += Math.abs(b - a);
  }
  const ganho = metrics.elevacao_ganho_m ?? 0;
  const ratio = ganho > 0 ? variacaoTotal / ganho : null;
  if (ratio != null && ratio > ELEV_NOISE_RATIO) {
    issues.push({
      tipo: 'elevacao_ruidosa',
      severidade: 'info',
      descricao: `Sinal de elevação ruidoso (variação total ${round(
        variacaoTotal,
        1,
      )}m para ganho líquido ${round(ganho, 1)}m). GAP pode estar superestimado.`,
    });
  }
  return {
    com_altitude: comAlt,
    variacao_total_m: round(variacaoTotal, 1),
    ganho_m: round(ganho, 1),
    ratio_ruido: ratio != null ? round(ratio, 1) : null,
  };
}

// --- Splits incompletos ------------------------------------------------------
function checkSplits(splits: SplitResult[], issues: QualityIssue[]) {
  const parcial = splits.find((s) => s.parcial);
  if (parcial) {
    issues.push({
      tipo: 'split_incompleto',
      severidade: 'info',
      descricao: `Último km é parcial (${round(parcial.distancia_m, 0)}m). Sinalizado, não misturado aos kms completos.`,
      km_index: parcial.km_index,
    });
  }
  return { n_splits: splits.length, ultimo_parcial: !!parcial };
}

// --- Deriva cardíaca (nota de análise) ---------------------------------------
function checkDrift(metrics: QualityMetrics, issues: QualityIssue[]) {
  const d = metrics.cardiac_drift;
  if (!d || d.delta_bpm == null) return { avaliado: false };
  if (d.pace_estavel && d.delta_bpm >= DRIFT_BPM_NOTE) {
    issues.push({
      tipo: 'cardiac_drift',
      severidade: 'info',
      descricao: `Deriva cardíaca: FC média ${d.fc_media_1a_metade}→${d.fc_media_2a_metade} bpm (Δ ${d.delta_bpm}) com pace estável (var. ${d.variacao_pace_s_por_km}s/km).`,
    });
  }
  return { avaliado: true, ...d };
}

function deriveStatus(issues: QualityIssue[]): 'ok' | 'warning' | 'rejected' {
  if (issues.some((i) => i.severidade === 'error')) return 'rejected';
  if (issues.some((i) => i.severidade === 'warning')) return 'warning';
  return 'ok';
}

function round(x: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}
