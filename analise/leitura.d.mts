// Tipos dos módulos da leitura do treino (Fase 2 · Etapa 5). JS puro, sem tipagem.
/* eslint-disable */
export declare const LEITURA_V: number;
export declare const FAIXAS: string[];
export declare function correcaoHadley(tempC: number | null, dewC: number | null): any;
export declare function climaPadrao(w: any, athlete: any): any;
export declare function inicioDeriva(w: any): any;
export declare function custoSubida(tr: any): any;
export declare function computeLeitura(o: { w: any; tr: any; laps: any[]; wind: any; athlete: any }): any;
export declare function historia(w: any, ctx?: any): { tom: 'ok' | 'atencao' | 'ciano'; texto: string }[];
export declare function pc(s: number): string;
export declare function voltasParaLaps(voltas: any[]): any[];
export declare function curvaSubida(ws: any[]): { faixa: string; n: number; custoSkm: number | null }[];
export declare function melhoresDoPeriodo(ws: any[]): Record<string, { t: number; id: string; date: string }>;
