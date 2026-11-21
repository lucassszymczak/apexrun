# Fase 4 · Etapa 4 — Simulador de meta

## O que entrou

- **Simulador de meta** (`#/mais/simulador`):
  - **No topo:** "Hoje, seu tempo realista é de X a Y". Embaixo, a régua com a faixa em `--ciano` a 22% e o marcador da meta.
  - **Veredito:** "abaixo", "dentro" ou "acima" da faixa, com ícone e palavra, em `aria-live`. Abaixo da faixa aparece em `--atencao`; dentro ou acima, em `--ok`. Ao lado, o selo de confiança.
  - **Controles:**
    - tempo-alvo de 5 em 5 min;
    - clima: Padrão / Quente e úmido / Previsão;
    - percurso: Real / Plano, só quando há percurso.
  - **Clima:**
    - "Quente e úmido" usa 24 °C com orvalho de 20 °C, pela mesma regra temperatura + orvalho já aprovada (+3,75%);
    - "Previsão" só liga nos 16 dias antes da prova e com um percurso com mapa, que dá o local da largada. Desligada, a tela diz o motivo.
  - **"Como chegamos a essa faixa":**
    - Riegel pela âncora (o treino, a distância, o tempo e a data);
    - correção para maratona (de 0 a +20 min), ou margem de ±2,5% abaixo de 30 km;
    - percurso;
    - clima;
    - o total.
  - **"Usar Xh como meta"** grava `goal: "time"` e `targetSec`.
  - **Rodapé:** "Estimativa, não garantia. O simulador não prevê ganho de treino."
- **Ciclo de prova:** o card virou "Tempo realista", com o resumo "Hoje, seu tempo realista é de X a Y" e o link "Simular meta". A tabela de Riegel continua no card, porque a comparação com o app antigo confere esses números.
- **Editar ciclo:** ao lado do tempo-alvo aparece "realista hoje: X a Y", em `--atencao` se a meta for mais rápida que a faixa. Também entrou o link "Testar metas no simulador".
- **Módulo novo:** `analise/simulador.mjs`. Ele abre em passos a faixa de `tempoRealista`, a mesma conta do plano, e os passos somam a faixa ao segundo.

## Critérios verificados

| # | Critério | Situação | Como foi verificado |
|---|---|---|---|
| 1 | Testes atuais, golden e paridade | ok | Os 7 testes do motor, `test:analise` (13 arquivos), `npm test` (82), `test:app` (81), compare-views 100% |
| 13 | Os passos somam a faixa; a âncora é a do card; "Usar como meta" grava `goal` e `targetSec` | ok | `simulador.test` (17) e `simulador-app` (13) |
| 17 | Nenhum valor de exemplo no código | ok | Busca: nada |

**Testes novos:**
- `node analise/simulador.test.mjs`: 17/17;
- `node scripts/simulador-app.mjs`, no navegador: 13/13.
