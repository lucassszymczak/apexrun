/* eslint-disable */
export declare const FANT_V: number, COBERTURA_MIN: number, DIF_DIST_MAX: number;
export type Cand = { w: any; cob: number; rotulo?: string | null };
export declare function cobertura(A: string[], B: string[]): number;
export declare function candidatos(alvo: { w: any; cells: string[] }, outros: { w: any; cells: string[] | null }[]): Cand[];
export declare function ordena(alvoW: any, cands: Cand[]): Cand[];
export declare function distNoTempo(tr: any, t: number): number | null;
export declare function tempoNaDist(tr: any, d: number): number | null;
export declare function distTotal(tr: any): number;
export declare function diferenca(trV: any, trF: any, tV: number, o?: { v0?: number; f0?: number }): number | null;
export declare function final(trV: any, trF: any, o?: { v0?: number; f0?: number; v1?: number | null; f1?: number | null }): number | null;
export declare function textoDif(d: number | null, fim?: boolean): { t: string; tom: 'ok' | 'atencao' | 'neutro' } | null;
