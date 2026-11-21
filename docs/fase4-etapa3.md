# Fase 4 · Etapa 3 — Plano de prova

## O que entrou

- **Plano de prova** (`#/mais/plano`). Abre pelo Ciclo de prova ("Ver plano de prova") e pela tela do percurso.
  - **Título-conclusão:**
    - com percurso: "Mire X/km no plano; do km A ao B, cerca de Y/km";
    - sem percurso: "Mire X/km do início ao fim".
  - **Chips:** meta (ou "Terminar bem · Xh"), estratégia e clima. Os dois primeiros levam a Editar ciclo, e o do clima abre a Folha do KPI.
  - **Gráficos:** perfil e pace alvo em degraus, no mesmo eixo de km. O trecho mais duro aparece a 12%, há tracejado na meia e no km 30, e o texto alternativo traz o pace no plano e na subida.
  - **Passagens:** Meia, km 30 e Chegada, com a chegada em magenta. Em provas de até 25 km, ficam Metade e Chegada.
  - **Blocos de 5 km em sanfona** (`<button aria-expanded>`): trecho, terreno, pace e a hora de passagem. Abertos, mostram o km a km. O km em subida tem o pace em `--atencao` e a palavra "subida" escrita.
  - **Clima:**
    - mais de 16 dias antes, clima padrão, com a data em que a previsão abre;
    - depois, a previsão hora a hora para o horário da largada, com o tempo que o calor soma;
    - se a previsão falhar ou o percurso não tiver mapa, clima padrão com o motivo.
  - **"Salvar no celular":** imagem 9:16 (1080×1920), gerada ao abrir a tela, com os 34% de cima e os 12% de baixo livres. No computador, o botão é "Baixar imagem do plano".
  - **Computador:** duas colunas, com o mapa do percurso e a subida destacada.
- **Módulos novos:**
  - `analise/plano.mjs`: pace por km, estratégia, clima por hora, passagens, blocos, título, tempo realista e "terminar bem";
  - `analise/previsao.mjs`: Open-Meteo hora a hora, com timeout de 10 s.
- **Previsão:** fica só no aparelho, em `apex.previsao.prova`, fora da sincronização. Ela tem cache de 3 h e no máximo uma busca por abertura. O local é a largada do percurso.
- **Livro de fórmulas:** nova seção "Plano de prova", com 4 verbetes: pace alvo, segunda metade, clima no plano e tempo realista.
- **Fontes conferidas e decisões do Lucas:** ±1% na segunda metade; faixa da maratona de Riegel a Riegel + 20 min (Vickers e Vertosick, 2016). Estão em `docs/fase4-formulas.md`.

## Critérios verificados

| # | Critério | Situação | Como foi verificado |
|---|---|---|---|
| 1 | Testes atuais, golden e paridade do motor | ok | Os 7 testes do motor, `test:analise` (12 arquivos), `npm test` (82), `test:app` (81), compare-views 100% |
| 7 | Soma dos km = tempo-alvo (±1 s); plano plano = mesmo pace | ok | `plano.test` e `plano-app` (chegada 4:47:00 exato) |
| 8 | Pace de cada km = P × `gradeCostMult` do motor | ok | `plano.test`, comparando com o próprio motor |
| 9 | Segunda metade mais rápida, mesmo tempo final, ±1% | ok | `plano.test` |
| 10 | > 16 dias: clima padrão e a data da previsão; depois, previsão ou clima padrão se falhar | ok | `plano.test` e `plano-app` (longe, perto com previsão, perto sem internet) |
| 11 | Imagem 1080×1920 com topo e pé livres; compartilhar no celular, baixar no computador | ok* | `plano-app`: medidas da imagem, compartilhar simulado, download real. *Confira no iPhone se aparece "Salvar imagem". |
| 12 | O plano abre em modo avião | ok | `test:offline`: 10/10, com o plano montado sem internet |
| 14 | "Terminar bem" usa a ponta lenta | ok | `plano.test` e `plano-app` |
| 17 | Nenhum valor de exemplo no código | ok | Busca por "5h30", "5h40", "106 m" e "28/03/2027": nada |

**Desempenho:** recalcular o plano de 42,195 km leva menos de 1 ms (meta: 50 ms), medido em `plano.test`.

**Testes novos:**
- `node analise/plano.test.mjs`: 34/34;
- `node scripts/plano-app.mjs`, no navegador: 21/21;
- `test:offline` ganhou a checagem do plano.

## Para você conferir

- **No iPhone:** abra o plano, toque em "Salvar no celular" e veja se a folha de compartilhar oferece "Salvar imagem" (que manda a imagem para o Fotos). Depois, ponha a imagem como tela de bloqueio e veja se o relógio não cobre nada.
- **O seu ciclo:** com a São Silvestre em "Terminar bem" e sem percurso, o plano usa a ponta lenta da faixa de ±2,5% em volta do Riegel, com a âncora atual do app.
