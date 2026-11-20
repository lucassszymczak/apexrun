// CORREÇÃO DOS SPLITS ESTICADOS (decisão do Lucas, 20/11/2026: corrigir também os treinos
// anteriores). A regra antiga do formulário relia os splits como texto e "esticava" o último
// km até a distância total (ex.: 1,00 → 1,09 km), o que mudava decoupling, GAP, pacing etc.
//
// Por que dá para desfazer sem o .FIT: o leitor de .FIT (fitBuildSplits) só cria um split
// final "picado" quando sobram MAIS de 150 m; se sobram menos, o último split tem exatamente
// 1 km. Logo, num treino vindo de .FIT, um último split > 1 km e ≤ 1,15 km que vale
// exatamente "distância total − (n−1)" só pode ter sido esticado — e o valor certo é 1 km.
// Por segurança, só mexe em treinos com marca de .FIT (histograma de FC, stream, qualidade
// ou esporte); treinos digitados à mão e os de exemplo ficam como estão.
export function isStretched(w: any): boolean {
  const sp = w && w.splits;
  if (!Array.isArray(sp) || sp.length < 2 || !(w.distKm > 0)) return false;
  if (!(w.hrHist || w.stream || w.quality || w.sport || w.streamPruned)) return false;
  const n = sp.length, last = sp[n - 1];
  if (!sp.slice(0, -1).every((s: any) => s && s.distKm === 1)) return false;
  const expected = Math.max(0.05, w.distKm - (n - 1));
  return last && Math.abs(last.distKm - expected) < 1e-9 && last.distKm > 1 && last.distKm <= 1.15 + 1e-9;
}

// Devolve os treinos corrigidos (mutando os splits) — idempotente: depois de corrigido,
// o último split vale 1 e a condição deixa de valer.
export function fixStretchedSplits(workouts: any[], now = new Date().toISOString()): any[] {
  const fixed: any[] = [];
  for (const w of workouts || []) {
    if (!isStretched(w)) continue;
    w.splits[w.splits.length - 1].distKm = 1;
    w.updatedAt = now; // a sincronização leva a correção para o outro aparelho
    fixed.push(w);
  }
  return fixed;
}
