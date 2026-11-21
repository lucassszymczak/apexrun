// Tipos do percurso da prova (Fase 4). JS puro, sem tipagem.
/* eslint-disable */
export declare const COURSE_V: number, PASSO_M: number, JANELA: number, TOL_OFICIAL: number, LIMIAR_SUBIDA: number, SALTO_AVISO_M: number, MAX_PARTES: number, MAX_ROTA: number;
export type Parte = { lat: number[]; lon: number[]; ele: (number | null)[]; d: (number | null)[] | null; inicio: number | null; esporte?: string; baro?: boolean; nome?: string | null };
export type Perfil = { d: number[]; lat: (number | null)[]; lon: (number | null)[]; ele: (number | null)[]; fator?: number };
export type Km = { km: number; de: number; ate: number; distKm: number; inclinacao: number; sobe: number; desce: number };
export declare function haversine(la1: number, lo1: number, la2: number, lo2: number): number;
export declare function parseGpx(texto: string): Parte & { temAltitude: boolean };
export declare function ordemPadrao(partes: Parte[]): number[];
export declare function juntaPartes(partes: Parte[], ordem?: number[]): any;
export declare function reamostra(tr: any, passo?: number): Perfil;
export declare function comparaOficial(kmGravados: number, kmOficiais: number): { diffPct: number | null; ajusta: boolean; pergunta: boolean };
export declare function ajustaDistancia(perfil: Perfil, kmOficiais: number): Perfil;
export declare function suaviza(ele: (number | null)[], janela?: number): (number | null)[];
export declare function kmAKm(perfil: Perfil): Km[];
export declare function desnivel(perfil: Perfil): { dMais: number; dMenos: number };
export declare function trechoMaisDuro(kms: Km[]): { de: number; ate: number; metros: number } | null;
export declare function confianca(fonte: string, baro?: boolean): 'Alta' | 'Moderada' | 'Baixa';
export declare function perfilDigitado(kms: { sobe: number; desce: number }[], kmOficiais: number, fonteTexto: string): Perfil;
export declare function paraLeve(perfil: Perfil): any;
export declare function deLeve(L: any): Perfil & { rota: { lat: number[]; lon: number[]; d: number[] } | null };
export declare function montaCourse(o: { fonte: string; perfilBruto: Perfil; partesInfo?: any[]; kmOficiais: number; ajustar?: boolean; fonteTexto?: string | null; baro?: boolean; digitados?: any[] | null; agora?: Date }): { course: any; resumo: Resumo; comparacao: { diffPct: number | null; ajusta: boolean; pergunta: boolean } };
export type Resumo = { km: number; dMais: number; dMenos: number; kms: Km[]; duro: { de: number; ate: number; metros: number } | null; comGps: boolean };
export declare function resumoCourse(course: any): Resumo;
