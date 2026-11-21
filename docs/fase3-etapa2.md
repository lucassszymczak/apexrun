# Fase 3 · Etapa 2 — Consistência por semanas

Regra aprovada em 21/11 (`docs/fase3-formulas.md`, item 6), com a meta padrão móvel (opção a).

## O que entrou

- **Módulo `analise/consistencia.mjs`** (puro, com `consistencia.test.mjs`, 18 testes):
  - semana de segunda a domingo, no horário de Brasília;
  - corrida, pedal e força contam como treino; descanso = dia sem treino;
  - consistente = pelo menos 80% das horas da meta e pelo menos 1 dia de descanso;
  - meta: a sua ou, em branco, a média das 4 semanas anteriores com treino (0,5 h, mínimo 1 h);
  - sequência até a última semana encerrada; a semana em andamento não quebra; os dias que ainda não chegaram não contam como descanso.
- **Tela Consistência** (`#/progresso/consistencia`):
  - título com a conclusão, sequência atual e a maior;
  - grade de 26 semanas no celular e 52 no computador, com botões de 44 px, ícone e palavra em cada estado e a legenda escrita;
  - ao tocar numa semana: os 7 dias (corrida, pedal, força ou descanso), horas × meta e de onde vem a meta, dias de descanso, o veredito com o motivo e a regra.
- **Progresso:** card "Consistência" com a sequência e "N das últimas 12 semanas".
- **Relatório semanal:** cada semana ganhou a linha "Semana consistente · N seguidas" (ou "Semana parcial · X% da meta", ou "Semana em andamento"), com link para a Consistência.
- **Configurações › Treino:** campo opcional "Meta semanal (horas)". Em branco, a meta é automática. Fica em `athlete.treino.metaSemanalH`, que já sincroniza.
- **Livro de fórmulas:** categoria nova "Evolução", com o verbete "Semana consistente".

## Conferência com os seus treinos

Com os 139 treinos do servidor, o módulo dá **7 das últimas 12 semanas consistentes e sequência atual de 5**, igual à tabela aprovada na Etapa 1.

## Testes

| Teste | Resultado |
|---|---|
| 6 testes do motor (kpi, fit, recovery, sync, stream, weather) | todos passam |
| `test:analise` (15 arquivos, com golden, paridade e o novo `consistencia.test`) | todos passam |
| `npm test` | 82 |
| `test:app` | 81 |
| `test:offline` · `test:garmin` · `tracks-app` | 10 · 24 · 11 |
| `leitura-app` · `ciclo-app` · `plano-app` · `simulador-app` · `amanha-app` · `fase4-telas` | 28 · 21 · 21 · 13 · 12 · 10 |
| `compare-views` | 100% |
| **Novo `scripts/consistencia-app.mjs`** | **29** |

- `engine.mjs` sem diferença.
- Nenhum teste existente foi alterado.
- O teste novo confere:
  - título, sequências e 26/52 semanas;
  - alvos de 44 px e teclado;
  - detalhe da semana e semana em andamento;
  - card do Progresso e linha do Relatório;
  - gravar, mudar e apagar a meta, e meta 0 recusada;
  - o verbete;
  - nenhum emoji e nenhum erro, nos temas escuro e claro.

## Observação

- Ainda não há registro de força no app. Quando houver, ele entra na conta sem mudar a regra.
