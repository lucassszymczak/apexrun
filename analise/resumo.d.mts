/* eslint-disable */
export declare const RESUMO_V: number;
export type Item = { tipo: 'recorde' | 'ciclo' | 'seg-melhor' | 'seg' | 'semana' | 'forma' | 'equip'; texto: string; tom?: string | null; segId?: string; [k: string]: any };
export declare function oQueMudou(o: { w: any; workouts: any[]; athlete?: any; race?: any; segmentos?: any[]; metaH?: number | null }): Item[];
export declare function titulo(itens: Item[], o: { tipoNome: string; distKm?: number; historiaOk?: string | null }): string;
