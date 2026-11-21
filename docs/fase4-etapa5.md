# Fase 4 · Etapa 5 — "Amanhã cedo" e Configurações › Treino

## O que entrou

- **Hoje · "Amanhã cedo":**
  - **Quando aparece:** do meio-dia à meia-noite, se estiver ligado e houver previsão.
  - **Título:** "Melhor horário amanhã: Hh", com a temperatura e o orvalho da hora escolhida e o custo no ritmo (ou "clima padrão, sem custo no ritmo").
  - **Barras:** uma por hora cheia da janela, com o custo do clima começando no zero. A melhor hora tem contorno e rótulo `--ciano`. A chuva aparece escrita em `--atencao` embaixo da hora.
  - **Hora descartada:** a frase "5h também tem clima padrão, mas com chuva provável (60%)" quando a chuva tira uma hora que venceria. Há também um aviso de vento forte.
  - **"Ajustar":** leva a Configurações › Treino.
- **Regra** (item 6 aprovado):
  - o custo da hora vem da regra temperatura + orvalho, e é 0 em clima padrão;
  - chuva de 50% ou mais descarta a hora;
  - vento de 20 km/h ou mais só avisa;
  - no empate, vence a hora mais cedo.
- **Configurações › Treino** (`#/mais/treino`, link em Configurações):
  - janela das/até (padrão 5h às 10h);
  - local Automático / Escolher no mapa;
  - "Mostrar 'Amanhã cedo' no Hoje";
  - o aviso de privacidade;
  - Salvar.
- **Local:**
  - **Automático:** o ponto de onde a maioria dos últimos 10 treinos começou, em células de cerca de 1 km, calculado no aparelho.
  - **No mapa:** você toca no mapa ou usa "Usar minha localização".
  - O ponto escolhido fica só no aparelho (`apex.previsao.ponto`). A janela e o modo vão em `athlete.treino` e sincronizam, sem coordenadas.
- **Previsão:** guardada no aparelho por até 3 h, com no máximo uma busca por abertura e timeout de 10 s. Sem internet, o card some sem erro.
- **Hoje:** embaixo do card do ciclo, a linha "Plano de prova: X/km no plano", que leva ao plano.
- **Módulo novo:** `analise/amanha.mjs` (melhor horário, janela, ponto automático).

## Critérios verificados

| # | Critério | Situação | Como foi verificado |
|---|---|---|---|
| 1 | Testes atuais, golden e paridade | ok | Os 7 testes do motor, `test:analise` (14 arquivos), `npm test` (82), `test:app` (81), compare-views 100% |
| 15 | Só do meio-dia à meia-noite e com previsão; clima padrão = custo 0; chuva e empate como aprovado; sem internet, some sem erro | ok | `amanha.test` (14) e `amanha-app` (12) |
| 16 | O ponto manual não vai para a sincronização | ok | `amanha-app`: o `apex.analise.v1` não tem a latitude nem a longitude do ponto |

**Testes novos:**
- `node analise/amanha.test.mjs`: 14/14;
- `node scripts/amanha-app.mjs`, no navegador: 12/12.
