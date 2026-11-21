/* eslint-disable */
export declare const CHUVA_DESCARTA: number, VENTO_AVISA: number, MEIO_DIA: number;
export declare const JANELA_PADRAO: { de: string; ate: string };
export type HoraLinha = { h: number; semDado?: boolean; tempC?: number; dewC?: number; chuvaPct?: number | null; ventoKmh?: number | null; custo?: number | null; chuva?: boolean; vento?: boolean; extremo?: boolean; padrao?: boolean };
export declare function horasDaJanela(janela?: { de: string; ate: string }): number[];
export declare function melhorHorario(horas: any[] | null, janela?: { de: string; ate: string }, athlete?: any): { linhas: HoraLinha[]; melhor: HoraLinha | null; descartada: HoraLinha | null; todasComChuva: boolean };
export declare function mostraAgora(agora: Date): boolean;
export declare function amanhaIso(agora: Date): string;
export declare function pontoAutomatico(workouts: any[]): { lat: number; lon: number; n: number; de: number } | null;
