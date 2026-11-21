/* eslint-disable */
export declare const CONSIST_V: number, PCT_META: number, DESCANSOS_MIN: number, SEMANAS_META: number, META_MIN_H: number, FUSO: string;
export type Dia = { iso: string; tipos: string[]; descanso: boolean; futuro: boolean };
export type Semana = { seg: string; dom: string; horas: number; meta: number; metaOrigem: 'sua' | 'padrao'; pct: number; descansos: number; dias: Dia[]; estado: 'consistente' | 'parcial' | 'sem' | 'andamento' };
export declare function addDias(iso: string, n: number): string;
export declare function segundaDe(iso: string): string;
export declare function hojeEm(agora?: Date, fuso?: string): string;
export declare function tipoDoTreino(w: any): 'corrida' | 'pedal' | 'forca' | null;
export declare function semanas(workouts: any[], o?: { hoje: string; n?: number; metaH?: number | null }): Semana[];
export declare function sequencias(lista: Semana[]): { atual: number; maior: number };
export declare function resumo(lista: Semana[], ultimas?: number): { consistentes: number; de: number; atual: number; maior: number };
