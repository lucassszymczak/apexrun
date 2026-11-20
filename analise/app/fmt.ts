// Formatação para a tela. Regra: o VALOR e o ARREDONDAMENTO são os mesmos do app
// antigo (mesmo toFixed/Math.round); só muda a apresentação brasileira
// (vírgula decimal, "h" e "km" com espaço) e somem os emojis.
import * as E from '../engine.mjs';

// toFixed(n) com vírgula — mesmo arredondamento do app antigo
export function dec(x: number | null | undefined, n = 1): string {
  if (x == null || !isFinite(x)) return '—';
  return x.toFixed(n).replace('.', ',');
}
// com sinal (+/−) como o app antigo fazia com (x>0?"+":"")
export function signed(x: number | null | undefined, n = 0): string {
  if (x == null || !isFinite(x)) return '—';
  return (x > 0 ? '+' : '') + x.toFixed(n).replace('.', ',');
}
export const pace = (s: number | null | undefined): string => E.paceStr(s);
export const km = (x: number | null | undefined): string => E.mKmTxt(x);
export const hms = (s: number | null | undefined): string => E.hms(s);
// "2h42" / "45min" (hmsShort do app antigo)
export const dur = (s: number | null | undefined): string => E.hmsShort(s);

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DOW_L = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
// "29 ago"
export function dayMon(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.getDate() + ' ' + MES[d.getMonth()];
}
// "29 ago 2026"
export function dayMonYear(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.getDate() + ' ' + MES[d.getMonth()] + ' ' + d.getFullYear();
}
export function monthYear(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return MES_L[d.getMonth()].replace(/^./, (c) => c.toUpperCase()) + ' ' + d.getFullYear();
}
// "Qui, 19 de novembro" (celular) / "Quinta, 19 de novembro" (computador)
export function todayLabel(long = false): string {
  const d = new Date();
  return (long ? DOW_L : DOW)[d.getDay()] + ', ' + d.getDate() + ' de ' + MES_L[d.getMonth()];
}
export const dowShort = (i: number) => DOW[i];

// Remove emojis e símbolos pictográficos (a interface não usa emoji).
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;
export function noEmoji(s: string | null | undefined): string {
  return String(s ?? '').replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').replace(/^\s+|\s+$/g, '');
}

// Textos do motor trazem <b>, <br> e <small>. Exibe só essas marcações (o resto é
// escapado) e tira os emojis.
export function safeRich(html: string | null | undefined): string {
  const esc = String(html ?? '').replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return noEmoji(esc)
    .replace(/&lt;(\/?)(b|strong|small|br|i)\s*\/?&gt;/g, '<$1$2>')
    .replace(/&lt;span class="lead"&gt;(.*?)&lt;\/span&gt;/g, '<b>$1</b>')
    .replace(/&lt;\/?span[^&]*&gt;/g, '');
}

// Rótulo do tipo de treino. Igual ao typeLabel do app antigo, mais o nome que faltava
// lá ("teste_motor" aparecia cru) — só apresentação.
export function typeName(t: string): string {
  if (t === 'teste_motor') return 'Teste do Motor';
  return E.typeLabel(t);
}

// Nome do treino como o app antigo (notas antes do "·", senão o tipo)
export function workoutTitle(w: any): string {
  const n = noEmoji((w.notes || '').split('·')[0].trim());
  if (n) return n;
  return E.isBike(w) ? (w.indoor ? 'Bike indoor' : 'Bike') : typeName(w.type);
}

// Prontidão: rótulo e estado de cor (readyBand do app antigo: hi / mid / lo)
const BAND_PT: Record<string, string> = { 'Peak Ready': 'Pico', Ready: 'Pronto', Moderate: 'Moderada', Caution: 'Cautela', Recovery: 'Recuperar' };
export type Tone = 'ok' | 'atencao' | 'alerta' | 'neutro';
export function readyTone(score: number): { label: string; tone: Tone } {
  const rb = E.readyBand(score);
  return { label: BAND_PT[rb[0]] || rb[0], tone: rb[1] === 'hi' ? 'ok' : rb[1] === 'mid' ? 'atencao' : 'alerta' };
}
export function bandPt(b: string | null | undefined): string { return b ? BAND_PT[b] || b : '—'; }
const REC_PT: Record<string, string> = { Good: 'Boa', Moderate: 'Moderada', 'Needs Recovery': 'Precisa recuperar' };
export function recoveryPt(l: string | null | undefined): string { return l ? REC_PT[l] || l : '—'; }
export function recoveryTone(score: number): Tone { return score >= 75 ? 'ok' : score >= 55 ? 'atencao' : 'alerta'; }
// cores antigas (var(--good|warn|crit|…)) → estado novo
export function toneOfVar(c: string | null | undefined): Tone {
  const s = String(c || '');
  if (/good|ok/.test(s)) return 'ok';
  if (/warn|serious/.test(s)) return 'atencao';
  if (/crit|alerta/.test(s)) return 'alerta';
  return 'neutro';
}
export const TSB_PT = (t: number | null) => (t == null ? '—' : E.tsbState(t));
