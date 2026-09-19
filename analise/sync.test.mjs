import * as S from "./sync.mjs";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}` + (got !== undefined ? `  (${got})` : "")); } else { fail++; console.log(`  ✗ ${n}  GOT ${got}`); } };

console.log("== merge de treinos (união por id, mais novo vence) ==");
const A = {
  updatedAt: "2026-09-14T10:00:00Z",
  athlete: { name: "Lucas", fcMax: 198, updatedAt: "2026-09-10T00:00:00Z" },
  workouts: [
    { id: "r1", date: "2026-09-07", type: "teste", distKm: 5, durationSec: 1910, updatedAt: "2026-09-07T12:00:00Z" },
    { id: "b1", date: "2026-09-10", modal: "bike", durationSec: 3600, hrAvg: 124, updatedAt: "2026-09-10T09:00:00Z" },
  ],
  daily: [{ date: "2026-09-08", restingHR: 70, updatedAt: "2026-09-08T06:00:00Z" }],
  deleted: [],
};
const B = {
  updatedAt: "2026-09-15T10:00:00Z",
  athlete: { name: "Lucas", fcMax: 195, updatedAt: "2026-09-15T08:00:00Z" }, // mais novo → vence
  workouts: [
    { id: "r1", date: "2026-09-07", type: "teste", distKm: 5, durationSec: 1905, updatedAt: "2026-09-14T20:00:00Z" }, // edição mais nova
    { id: "b2", date: "2026-09-13", modal: "bike", distKm: 32, durationSec: 4200, hrAvg: 138, updatedAt: "2026-09-13T18:00:00Z" }, // só no B
  ],
  daily: [{ date: "2026-09-08", hrv: 55, updatedAt: "2026-09-08T07:00:00Z" }], // mesma data, campo novo
  deleted: [],
};

const m = S.mergeStates(A, B);
ok("união: 3 treinos (r1, b1, b2)", m.workouts.length === 3, m.workouts.map((w) => w.id).join(","));
ok("treino do notebook (b1) aparece na união", m.workouts.some((w) => w.id === "b1"), "sim");
ok("treino do celular (b2) aparece na união", m.workouts.some((w) => w.id === "b2"), "sim");
const r1 = m.workouts.find((w) => w.id === "r1");
ok("conflito r1: vence a edição mais nova (durationSec 1905)", r1.durationSec === 1905, r1.durationSec);
ok("athlete: vence o mais novo (fcMax 195)", m.athlete.fcMax === 195, m.athlete.fcMax);
const d8 = m.daily.find((d) => d.date === "2026-09-08");
ok("daily mescla campos por data (restingHR + hrv)", d8.restingHR === 70 && d8.hrv === 55, JSON.stringify(d8));

console.log("\n== comutatividade (merge(A,B) == merge(B,A)) ==");
const m2 = S.mergeStates(B, A);
const idsA = m.workouts.map((w) => w.id).sort().join(",");
const idsB = m2.workouts.map((w) => w.id).sort().join(",");
ok("mesma união dos dois lados", idsA === idsB, idsA + " | " + idsB);
ok("r1 resolve igual nos dois sentidos", m2.workouts.find((w) => w.id === "r1").durationSec === 1905, m2.workouts.find((w) => w.id === "r1").durationSec);

console.log("\n== tombstones (delete propaga) ==");
const withDelete = S.mergeStates(m, { deleted: [{ id: "b1", at: "2026-09-16T10:00:00Z" }] });
ok("treino deletado (b1) some após tombstone mais novo", !withDelete.workouts.some((w) => w.id === "b1"), withDelete.workouts.map((w) => w.id).join(","));
ok("tombstone fica registrado", withDelete.deleted.some((d) => d.id === "b1"), "sim");
// re-importar o MESMO id com edição mais nova que o delete → ressuscita (edição posterior vence)
const reAdd = S.mergeStates(withDelete, { workouts: [{ id: "b1", date: "2026-09-10", modal: "bike", durationSec: 3600, updatedAt: "2026-09-17T10:00:00Z" }] });
ok("edição posterior ao delete traz o treino de volta", reAdd.workouts.some((w) => w.id === "b1"), "sim");

console.log("\n== estado vazio / robustez ==");
ok("merge com null não quebra", S.mergeStates(null, A).workouts.length === 2, S.mergeStates(null, A).workouts.length);
ok("merge de dois vazios → vazio", S.mergeStates({}, {}).workouts.length === 0, S.mergeStates({}, {}).workouts.length);

console.log("\n== código de sincronização ==");
let seed = 0.123456789;
const rng = () => { seed = (seed * 9301 + 49297) % 233280 / 233280; return seed; };
const code = S.newSyncCode(rng);
ok("formato apex-XXXX-XXXX-XXXX", /^apex-[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/.test(code), code);
ok("sem caracteres ambíguos (0/o/1/i/l)", !/[01oil]/.test(code.replace("apex-", "")), code);
ok("normalizeSyncCode limpa espaços/caixa", S.normalizeSyncCode("  APEX-7F3K-92MX-abcd ") === "apex-7f3k-92mx-abcd", S.normalizeSyncCode("  APEX-7F3K-92MX-abcd "));
const codes = new Set();
for (let i = 0; i < 200; i++) codes.add(S.newSyncCode());
ok("200 códigos aleatórios sem colisão", codes.size === 200, codes.size);

console.log(`\n=== RESULTADO: ${pass} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
