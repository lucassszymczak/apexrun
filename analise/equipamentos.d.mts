/* eslint-disable */
export declare const EQUIP_V: number, LIMITE_PADRAO: number, PCT_AVISO: number;
export declare const PECAS: string[];
export type Peca = { trocas: string[]; limiteKm?: number | null };
export type Equip = { id: string; tipo: 'tenis' | 'bike'; nome: string; criadoEm: string; kmInicial?: number; limiteKm?: number | null; aposentado?: boolean; aposentadoEm?: string; pecas?: Record<string, Peca>; v: number };
export type Estado = 'ok' | 'atencao' | 'limite' | null;
export declare function ativos(lista: Equip[] | undefined, tipo: 'tenis' | 'bike'): Equip[];
export declare function kmTenis(t: Equip, workouts: any[]): { km: number; corridas: number };
export declare function desdeDe(bike: Equip, peca: string): string | null;
export declare function kmPeca(bike: Equip, peca: string, workouts: any[]): { km: number; pedais: number; desde: string | null };
export declare function estado(km: number, limite: number | null | undefined): Estado;
export declare function padraoPara(modal: string, lista: Equip[] | undefined, workouts: any[]): string | null;
export declare function avisosHoje(lista: Equip[] | undefined, workouts: any[]): { t: Equip; km: number; corridas: number }[];
export declare function comEsteTreino(t: Equip, workouts: any[], distKm: number, wid?: string | null): { km: number; estado: Estado };
export declare function novoTenis(lista: Equip[] | undefined, o: { nome: string; kmInicial?: number; limiteKm?: number | null; hoje: string }): Equip[];
export declare function novaBike(lista: Equip[] | undefined, o: { nome?: string; hoje: string }): Equip[];
export declare function editar(lista: Equip[] | undefined, id: string, campos: Partial<Equip>): Equip[];
export declare function aposentar(lista: Equip[] | undefined, id: string, hoje: string): Equip[];
export declare function troquei(lista: Equip[] | undefined, bikeId: string, peca: string, hoje: string): Equip[];
