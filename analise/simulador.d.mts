/* eslint-disable */
import type { Realista } from './plano.mjs';
export declare const QUENTE: { tempC: number; dewC: number };
export declare function climaQuentePct(): number;
export declare const PASSO_ALVO_S: number;
export type Passo = { id: 'riegel' | 'maratona' | 'margem' | 'percurso' | 'clima'; rapido: number; lento: number };
export declare function passos(o: { anchor: any; distKm: number; kmsPercurso?: any[] | null; climaPct?: number }): { realista: Realista; passos: Passo[]; rapidoS: number; lentoS: number } | null;
export declare function veredito(alvoS: number, faixa: { rapidoS: number; lentoS: number } | null): { id: 'abaixo' | 'dentro' | 'acima'; texto: string; tom: 'ok' | 'atencao' } | null;
export declare function arredonda5(s: number): number;
