/* eslint-disable */
export declare const FAIXAS_CORPO: number[][];
export declare function faixaCorpo(n: number): number;
export declare function contagem(workouts: any[], o?: { de?: string | null; ate?: string | null }): { treinos: number; vezes: Record<string, number>; linhas: Record<string, { date: string; int: number; wid: string }[]>; top: { k: string; n: number } | null };
