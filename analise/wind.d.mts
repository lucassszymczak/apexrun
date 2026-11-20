/* eslint-disable */
export declare function fetchWind(geo: any, when: any, fetchFn?: any): Promise<any>;
export declare function rumo(lat1: number, lon1: number, lat2: number, lon2: number): number;
export declare function componente(kmh: number, deGraus: number, rumoGraus: number): number;
export declare const VENTO_FRACO_KMH: number;
export declare const LIMIAR_FRACAO: number;
export declare function classe(comp: number, kmh: number): -1 | 0 | 1;
export declare function custoContraSkm(vMs: number, contraKmh: number, paceSkm: number): number | null;
export declare function ventoDoTreino(tr: any, wind: any): any;
