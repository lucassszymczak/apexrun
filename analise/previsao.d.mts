/* eslint-disable */
export declare const TIMEOUT_MS: number;
export type Hora = { hora: string; tempC: number | null; dewC: number | null; chuvaPct: number | null; ventoKmh: number | null; ventoDe: number | null };
export declare function fetchPrevisao(geo: { lat: number; lon: number } | null, dataIso: string, fetchFn?: any): Promise<{ data: string; horas: Hora[]; fuso: string | null; buscadaEm: string } | null>;
