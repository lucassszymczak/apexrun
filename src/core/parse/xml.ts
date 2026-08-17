// Helpers compartilhados para os parsers XML (GPX/TCX).

/** Garante um array: fast-xml-parser devolve objeto único quando há 1 filho. */
export function toArray<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

/** Converte para número finito ou null. */
export function num(x: unknown): number | null {
  if (x == null) return null;
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Procura, de forma tolerante a namespace, a primeira chave cujo nome (após o
 * prefixo `ns:`) termina com `suffix` (case-insensitive), em profundidade.
 * Usado para achar FC/cadência dentro de <extensions> de GPX (gpxtpx:hr, ns3:hr…).
 */
export function findBySuffix(obj: unknown, suffix: string): number | null {
  if (obj == null || typeof obj !== 'object') return null;
  const re = new RegExp(`(^|:)${suffix}$`, 'i');
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (re.test(key)) {
      const n = num(value);
      if (n != null) return n;
    }
    if (value && typeof value === 'object') {
      const found = findBySuffix(value, suffix);
      if (found != null) return found;
    }
  }
  return null;
}
