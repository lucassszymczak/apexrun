// =============================================================================
// Orquestrador da ingestão: streams normalizados → métricas + splits + relatório
// de conferência. Puro e determinístico (mesmo resultado no browser e na Edge).
// =============================================================================

import { computeAggregate } from './metrics/aggregate';
import { computeSplits } from './metrics/splits';
import { parseActivityBytes } from './parse';
import { runQualityChecks } from './quality/checks';
import type { IngestResult, ParsedActivity } from './types';

/** Roda os cálculos + conferência sobre uma atividade já parseada. */
export function ingestParsed(parsed: ParsedActivity): IngestResult {
  const metrics = computeAggregate(parsed.samples);
  const splits = computeSplits(parsed.samples);
  const report = runQualityChecks(
    parsed.samples,
    splits,
    metrics,
    parsed.device,
    parsed.source_format,
  );
  return { metrics, splits, report, device: parsed.device };
}

/** Conveniência: parseia os bytes de um arquivo e já roda a ingestão. */
export async function ingestActivityBytes(
  filename: string,
  bytes: ArrayBuffer,
): Promise<{ parsed: ParsedActivity; result: IngestResult }> {
  const parsed = await parseActivityBytes(filename, bytes);
  return { parsed, result: ingestParsed(parsed) };
}
