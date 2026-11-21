/* eslint-disable */
export declare const FALA_V: number;
export declare const REGIOES: [string, string, boolean][];
export type Regiao = { id: string; lado: 'd' | 'e' | null; int: number };
export type Pendente = { id: string; lado: 'd' | 'e' | null; int: number | null; falta: 'lado' | 'intensidade' };
export type Leitura = { rpe: number | null; sono: number | null; regioes: Regiao[]; pendentes: Pendente[]; gearId: string | null; gearNome?: string; avisos: string[]; entendi: string[]; articular: boolean };
export declare function nomeRegiao(id: string, lado: 'd' | 'e' | null): string;
export declare function chave(id: string, lado: 'd' | 'e' | null): string;
export declare function lerFrase(frase: string, o?: { equipamentos?: any[] }): Leitura;
export declare function textoEntendi(r: Leitura): string;
export declare function textoPendente(p: Pendente): string;
