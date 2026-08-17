// Barrel do núcleo de ingestão.
export * from './types';
export { ingestParsed, ingestActivityBytes } from './ingest';
export { parseActivityBytes, detectFormat } from './parse';
export { computeSplits } from './metrics/splits';
export { computeAggregate, computeCardiacDrift } from './metrics/aggregate';
export { minettiCost, gradeAdjustFactor, gradeAdjustedDistance } from './metrics/gap';
export { runQualityChecks } from './quality/checks';
