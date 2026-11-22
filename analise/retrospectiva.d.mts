/* eslint-disable */
export declare const RETRO_V: number;
export type Bloco = { tipo: 'capa' | 'volume' | 'consistencia' | 'recordes' | 'prova' | 'segmentos' | 'tenis'; rotulo: string; titulo: string; numero: string; unidade: string; [k: string]: any };
export type Retro = { ini: string; fim: string; parcial: boolean; nome: string; blocos: Bloco[] };
export declare function ddmmm(iso: string): string;
export declare function hms(s: number): string;
export declare function hCurto(s: number): string;
export declare function tempoNoKm(w: any, km: number): number | null;
export declare function provaDoCiclo(race: any, workouts: any[]): any | null;
export declare function retrospectiva(o: { workouts: any[]; athlete?: any; race: any; hoje: string; segmentos?: any[]; planoPassagens?: { rotulo: string; km: number; tS: number }[] | null; metaH?: number | null; realNoKm?: ((km: number) => number | null) | null }): Retro | null;
export declare function cardsStories(R: Retro | null): Bloco[][];
export declare function mostraCardHoje(race: any, hoje: string): boolean;
