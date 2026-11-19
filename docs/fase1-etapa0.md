# Fase 1 · Etapa 0 — Rede de segurança

Nesta etapa a interface não mudou: nenhum arquivo de `analise/index.html`, dos módulos `analise/*.mjs`, dos testes existentes ou de `src/` foi alterado.

## 1. O que foi extraído

### Mapa do motor

`analise/index.html` tem **um único `<script>`** (linhas 973–5233) com 397 funções. Ele **não importa** os módulos `analise/*.mjs`: tem cópias próprias, inline, de quase tudo o que eles fazem, mais muita lógica que só existe nele.

| Área | Na página | Nos módulos `.mjs` |
|---|---|---|
| KPIs do Livro de fórmulas (GAP, EF, decoupling, TRIMP, zonas, CTL/ATL/TSB, A:C, score, prontidão…) | sim | `kpi.mjs` (com 3 divergências, ver §3) |
| Motor por amostra (pré-processamento, pace-GAP@FC, eficiência, mecânica, IMP, Teste do Motor) | sim | `stream.mjs` (equivalente) |
| Leitura do .FIT | sim, completa | `fit-ingest.mjs` (**subconjunto**, ver §3) |
| Clima, Apple Saúde, merge de sync | sim | `weather.mjs`, `health-ingest.mjs`, `sync.mjs` (equivalentes) |
| Estado e armazenamento (`load`/`save`, seed, sono↔treino) | **só na página** | — |
| Hoje/Coach (`coachContext`, veredito, linhas do Coach, `coachInsight`) | **só na página** | — |
| Progresso (`progContext`, recordes, árvore do EF, perfil de inclinação) | **só na página** | — |
| Maratona (bloco/fase, plano da semana, status planejado × feito, resumo do ciclo, pace por zona) | **só na página** | — |
| Hidratação, prontidão da semana, heatmap de consistência | **só na página** | — |

### O módulo novo: `analise/engine.mjs`

- Foi **gerado automaticamente** por `scripts/extract-engine.mjs`, não copiado à mão.
- O script faz o parse do `<script>` da página e parte de cerca de 120 funções de cálculo usadas pelas telas. Daí puxa tudo de que elas dependem: **224 declarações, 225 nomes**.
- Cada declaração é **cópia byte a byte** da página.
- O único código novo é a "cola" de módulo:
  - `setState`/`getState`, porque o estado era uma variável global;
  - `setToast`, porque o `save()` avisa quando o armazenamento enche.
- `load()`/`save()` usam a mesma chave `apex.analise.v1` e o mesmo formato. É isso que garante que o app novo abra os dados que já estão no aparelho.
- `analise/engine.test.mjs` falha se:
  - qualquer função divergir da página;
  - faltar ou sobrar uma declaração em relação ao que o extrator selecionaria hoje;
  - existir código novo além da cola.

**O app novo deve importar `engine.mjs`** para os números. Os módulos `.mjs` continuam intactos e testados, mas em 4 pontos não fazem o mesmo que a página (§3).

**Ficou de fora de propósito**, porque está acoplado ao DOM ou à rede e será portado na Etapa 1 com a mesma lógica:
- `handleFitFile` (o leitor do .FIT vinha do CDN; no app novo vem do `@garmin/fitsdk` do npm);
- `recalcKpis` (o núcleo de cálculo dele já está no módulo);
- `backfillWeather`, `importData`/`exportData` e os `render*`;
- os textos do Livro de fórmulas (`KPI_DOCS`), que entram com a Folha do KPI na Etapa 1.

## 2. Golden master — as comparações feitas

### Como funciona (`scripts/golden-capture.mjs`)

- O app antigo roda num Chromium real, com relógio congelado em **19/11/2026 12:00** e fuso **America/Sao_Paulo**. Toda a rede externa fica bloqueada.
- Depois da mesma sequência de abertura do app (`load` → salva o seed → vincula o sono), um snapshot chama o motor exatamente como as telas chamam.
- **No mesmo navegador**, uma segunda página roda o **motor novo** a partir do mesmo `localStorage` e tira o mesmo snapshot. Os dois são comparados **valor a valor, sem tolerância**.
- Também é gravado o **texto de cada tela** do app antigo:
  - as 10 abas;
  - os 6 sistemas do Progresso;
  - o detalhe de cada treino.
  
  Esse texto é a referência que as telas novas da Etapa 1 têm de bater.

`analise/golden.test.mjs` refaz o snapshot com o motor novo no Node e compara com o golden.

### Cenários

| Cenário | Conteúdo | Treinos | Comparações por treino | Mesmo navegador |
|---|---|---|---|---|
| **seed** | Os dados de exemplo do app | 9 | 144 | idêntico |
| **sintético** | Gerado com semente fixa (detalhe abaixo) | 27 | 468 | idêntico |
| **backup do Lucas** | `fixtures/privado/backup.json` | — | — | **pendente: o arquivo ainda não existe** |

O cenário sintético cobre o que o seed não tem:
- 23 corridas geradas por .FIT sintético, passando pelo leitor de .FIT do próprio motor, com pausas, gravação inteligente, morros e deriva de FC;
- Teste do Motor, 2 bikes com histograma de FC e 1 treino manual com splits;
- clima, hidratação, sono, dor muscular e dor articular;
- 75 dias de diário de recuperação;
- prova com início de ciclo, 3 semanas de plano (incluindo sessões estruturadas e adaptadas) e um ciclo arquivado.

Já testei o fluxo do backup de ponta a ponta com um arquivo simulado no formato do export do app. Captura e comparação passaram, e o arquivo foi apagado em seguida.

### O que é comparado

**Por treino (16 grupos):**
- `computeGap`, `computeEF`, `computeDecoupling`, `computePacing`, `computePaceStability`;
- `computeTrimp`, `computeHrCostKm`, `zoneSeconds`, `hillPerformance`, `kmH`;
- `workoutDayReadiness` (prontidão do dia do treino), `typeLabel`;
- hidratação: total, taxa, status, plano, metas antes/durante/depois e recuperação no dia seguinte;
- clima: etiquetas e se está dentro do padrão;
- **stream**: pace-GAP@145, eficiência, decoupling mecânico, IMP, cadência, defasagem de FC e Teste do Motor.

**Painel (28 blocos):**
- `coachContext` completo: prontidão, recuperação, score, TSB/CTL, A:C, distribuição, tendência, EF, cadência, deriva, VO₂ e km/semana;
- `progContext` completo;
- veredito, ação e linhas do Hoje; `coachInsight`, `focusLine`; prévia do próximo treino;
- árvore do EF, matriz de decoupling cardíaco × mecânico, previsões de prova (Riegel);
- perfil de inclinação, custo de FC do morro;
- série de forma completa, A:C, polarização, distribuição 80/20, consistência, subida agregada, resumo da bike;
- km em 7 dias, prontidão da semana, heatmap de 18 semanas;
- sugestão de PACE_REF, defasagem mediana, sono unificado, faixa do VO₂, médias de hidratação.

**Maratona (11 blocos):**
- zonas de FC e pace por zona (geral e do ciclo);
- semana atual, dias até a prova, bloco, fase;
- resumo do ciclo e texto de compartilhar; ciclos arquivados;
- **plano da semana**, sessão a sessão: minutos, km, zona de pico, resumo, status e análise planejado × feito.

### Resultado

- **Mesmo navegador:** idêntico valor a valor nos 3 cenários.
- **Node × Chromium:** idêntico, exceto **2 valores** do cenário sintético, as previsões de maratona do Riegel. Eles diferem na **última casa binária**, por exemplo `14218.478427470298` contra `14218.4784274703`. O código é o mesmo; muda o `Math.pow` do motor JS.
  - O Safari do iPhone também tem o seu próprio `Math.pow`, e isso já acontecia com o app antigo.
  - O teste aceita no máximo 4 ULP **só nesse caso Node × navegador** e lista cada ocorrência.

## 3. Divergências entre a página e os módulos `.mjs`

`analise/modules-vs-engine.test.mjs` roda **63 pares de funções** com os mesmos dados (seed, sintético, streams, mensagens .FIT, XML do Saúde, estados de sync).

- **59 são equivalentes.** Comecei achando que `computeDecoupling`, `performanceScore` e `readiness` divergiam; o teste mostrou que não.
- **4 divergem de verdade.** Ficam documentadas e o teste falha se aparecer uma nova:

| Função | Página (o que o app mostra hoje) | Módulo |
|---|---|---|
| `kpi.fitnessSeries` | Estende CTL/ATL/TSB até **hoje**, com carga zero nos dias de descanso | Para no último treino |
| `kpi.acuteChronic` | Janela aguda contada a partir de **hoje** | Contada a partir do último treino |
| `kpi.consistency` | Crédito parcial por semana e devolve `metWeeks` | Conta só semanas cumpridas (a adesão muda) |
| `fit-ingest.messagesToWorkout` | Gera `hrHist`, `geo`, stream, qualidade e KPIs por amostra | Subconjunto (nos campos em comum, igual) |

Nada foi alterado nos módulos. O app novo segue a página, e é ela que o Lucas vê hoje.

## 4. Testes

| Comando | Resultado |
|---|---|
| `npm test` (Vitest) | 3 arquivos, 19 testes verdes |
| `npm run test:analise` (todos os `node analise/*.test.mjs`) | 9 arquivos verdes, incluindo os 6 originais sem nenhuma alteração |
| `tsc --noEmit` e `npm run build` | ok |

Sobre o `npm test`: antes ele dava **6 arquivos falhando**. O Vitest pegava os testes `node analise/*.test.mjs`, que terminam com `process.exit`. Não era falha real.
- **Correção:** um `vitest.config.ts` que restringe o Vitest a `tests/`, sem tocar em nenhum teste.
- Os testes do motor rodam com `npm run test:analise`.

## 5. Arquivos novos

```
analise/engine.mjs                  motor extraído (gerado — não editar à mão)
analise/engine.test.mjs             paridade byte a byte com a página
analise/golden.test.mjs             golden master (seed, sintético, backup)
analise/modules-vs-engine.test.mjs  diferencial página × módulos
analise/golden/env.mjs              relógio/fuso congelados, RNG, comparação profunda
analise/golden/snapshot.mjs         o snapshot (roda na página antiga e no Node)
analise/golden/synthetic.mjs        gerador do cenário sintético
analise/golden/*.engine.json        goldens do motor (seed, sintético)
analise/golden/*.views.json         texto das telas do app antigo (referência p/ Etapa 1)
analise/golden/sintetico.state.json estado do cenário sintético (~2 MB, determinístico)
scripts/extract-engine.mjs          npm run engine:extract
scripts/golden-capture.mjs          npm run golden:capture [seed|sintetico|backup]
scripts/test-analise.mjs            npm run test:analise
vitest.config.ts                    Vitest só em tests/
docs/fase1-etapa0.md                este relatório
```

`.gitignore`: `fixtures/privado/` (backup, .FIT e fotos do Lucas, mais os goldens gerados a partir deles).

## 6. Pontos em aberto

1. **Falta o pacote de design.** `CLAUDE.md`, `design/` (tokens, marca, telas) e `docs/roteiro-fase1.md` não estão no repositório.
   - Esta etapa não dependia deles.
   - A **Etapa 1 depende**: é preciso copiar a pasta do pacote para a raiz.
2. **Backup real.** Salve `fixtures/privado/backup.json` (Config › Dados › Exportar) e rode:

   ```
   npm run golden:capture backup && node analise/golden.test.mjs
   ```

3. **O export do app não leva prova, plano da semana nem ciclos arquivados.** Só leva `athlete`, `workouts` e `daily`.
   - Para o golden cobrir isso com os seus dados, rode no console do navegador, com o app aberto, `copy(localStorage.getItem('apex.analise.v1'))` e cole num arquivo `fixtures/privado/backup.json`.
   - O script aceita os dois formatos.
4. **Branch.** O roteiro pede `fase-1`. Esta sessão trabalha em `claude/new-session-842fjl`, que é a branch configurada para ela. Nada foi commitado.
5. **.FIT e fotos de teste** (corrida com GPS, pedal, treino sem GPS, 2 fotos) só são necessários na Etapa 2 e na Etapa 3.
