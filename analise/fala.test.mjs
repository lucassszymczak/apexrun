// Testes de "Diga como foi" (Fase 5 · Etapa 3): as 24 frases aprovadas em docs/fase5-formulas.md.
// Roda com: node analise/fala.test.mjs
import { lerFrase, textoEntendi, chave } from './fala.mjs';

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) pass++; else fail++; console.log(`  ${c ? '✓' : '✗'} ${n}` + (got !== undefined ? `  (${got})` : '')); };
const EQ = [{ id: 't1', tipo: 'tenis', nome: 'Azulão' }, { id: 't0', tipo: 'tenis', nome: 'Velho', aposentado: true }];
// resumo compacto do resultado, para comparar com a tabela aprovada
function res(frase) {
  const r = lerFrase(frase, { equipamentos: EQ });
  const p = [];
  if (r.rpe != null) p.push('RPE ' + r.rpe);
  if (r.sono != null) p.push('sono ' + String(r.sono).replace('.', ','));
  for (const g of r.regioes) p.push(chave(g.id, g.lado) + ' ' + g.int);
  for (const g of r.pendentes) p.push(g.id + (g.lado ? '_' + g.lado : '') + ' pendente(' + g.falta + ')');
  if (r.gearId) p.push('tenis ' + r.gearId);
  return { r, s: p.join(' · ') };
}
const T = [
  [1, 'RPE 7, dormi 7 e meia, canela esquerda 3', 'RPE 7 · sono 7,5 · canela_e 3'],
  [2, 'rpe sete dormi sete e meia canela esquerda três', 'RPE 7 · sono 7,5 · canela_e 3'],
  [3, 'Esforço 6. Dormi 8 horas.', 'RPE 6 · sono 8'],
  [4, 'dormi 6h30', 'sono 6,5'],
  [5, 'Dormi 7:30, RPE 5', 'RPE 5 · sono 7,5'],
  [6, 'dormi 7 horas e 20', 'sono 7,3'],
  [7, 'panturrilha direita 2 e canela esquerda 4', 'panturrilha_d 2 · canela_e 4'],
  [8, 'dor 3 no joelho direito', 'joelho_d 3'],
  [9, 'canela 3', 'canela pendente(lado)'],
  [10, 'joelho esquerdo', 'joelho_e pendente(intensidade)'],
  [11, 'lombar 4', 'lombar 4'],
  [12, 'panturrilhas nas duas 2', 'panturrilha_d 2 · panturrilha_e 2'],
  [13, 'dor nos dois joelhos 3', 'joelho_d 3 · joelho_e 3'],
  [14, 'tornozelo direito 1, sola do pé esquerdo 2', 'pe_d 1 · pe_e 2'],
  [15, 'tendão de aquiles esquerdo 5', 'aquiles_e 5'],
  [16, 'bumbum direito 2', 'gluteo_d 2'],
  [17, 'RPE 12', ''],
  [18, 'dormi mal', ''],
  [19, 'foi um treino bom, calor forte', ''],
  [20, 'dor articular no joelho direito', 'joelho_d pendente(intensidade)'],
  [21, 'RP 8 dormi 6', 'RPE 8 · sono 6'],
  [22, 'rpe 7, com o Azulão', 'RPE 7 · tenis t1'],
  [23, 'erre pê é 4', 'RPE 4'],
  [24, 'dormi 7,5 horas, canela direita 0', 'sono 7,5 · canela_d 0'],
];
console.log('\n== as 24 frases da tabela aprovada ==');
for (const [n, f, esp] of T) { const { s } = res(f); ok(String(n).padStart(2) + '. "' + f + '"', s === esp, s || '(nada)'); }

console.log('\n== avisos e regras ==');
ok('17: RPE fora de 0 a 10 avisa', lerFrase('RPE 12').avisos.includes('RPE fora de 0 a 10'));
ok('18: sono sem número avisa', lerFrase('dormi mal').avisos.includes('sono sem número de horas'));
ok('19: "Não entendi nenhum campo; preencha abaixo."', textoEntendi(lerFrase('foi um treino bom, calor forte')) === 'Não entendi nenhum campo; preencha abaixo.');
const art = lerFrase('dor articular no joelho direito');
ok('20: dor articular só gera aviso; nada liga o interruptor (não existe campo "pain" no resultado)', art.articular === true && !('pain' in art) && art.avisos.some((a) => /interruptor/.test(a)));
ok('1: a linha "Entendi" em palavras', textoEntendi(lerFrase('RPE 7, dormi 7 e meia, canela esquerda 3')) === 'Entendi: RPE 7, sono 7,5 h, canela esquerda 3.');
ok('tênis aposentado não é escolhido pela frase', lerFrase('rpe 6 com o Velho', { equipamentos: EQ }).gearId === null);
ok('maiúsculas, acentos e pontuação não atrapalham', res('CANELA ESQUERDA, 3!').s === 'canela_e 3' || res('CANELA ESQUERDA 3!').s === 'canela_e 3');
const t0 = performance.now(); for (let i = 0; i < 200; i++) lerFrase('RPE 7, dormi 7 e meia, canela esquerda 3 e panturrilha direita 2, com o Azulão', { equipamentos: EQ }); const ms = (performance.now() - t0) / 200;
ok('entende a frase em até 20 ms', ms < 20, ms.toFixed(2) + ' ms');

console.log('\n== sincronização ==');
{
  const { syncMergeStates } = await import('./engine.mjs');
  const w = { id: 'x1', date: '2026-11-20', modal: 'corrida', distKm: 6, durationSec: 1980, updatedAt: '2026-11-20T10:00:00Z', dorRegioes: [{ regiao: 'canela', lado: 'e', int: 3 }] };
  const a = { athlete: {}, workouts: [], daily: [], deleted: [], race: {}, planWeeks: {} }, b = { ...a, workouts: [w] };
  const m = syncMergeStates(a, b); const x = m.workouts.find((o) => o.id === 'x1');
  ok('dorRegioes vai junto com o treino na sincronização', !!x && JSON.stringify(x.dorRegioes) === JSON.stringify(w.dorRegioes));
}

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
