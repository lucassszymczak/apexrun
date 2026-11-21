# Fase 4 · Etapa 6 — Acabamento e os 18 critérios

## O que mudou nesta etapa

- **Alvos de toque:**
  - os seletores segmentados de tela cheia (Objetivo, Clima, Percurso, Local) passaram de 40 para 44 px;
  - os seletores menores do app inteiro (Ruas / Só trajeto e outros) ganharam área de toque de 44 px, sem mudar o desenho de 38 px. É a regra "alvo de toque de 44 px mesmo quando o desenho é menor".
- **Teste novo `scripts/fase4-telas.mjs`:** as 9 telas tocadas pela Fase 4, em 390 px escuro, 390 px claro e 1440 px. Ele confere:
  - sem emoji;
  - no máximo uma ação magenta no conteúdo;
  - botões com nome e campos com rótulo;
  - tabelas com `th scope`;
  - alvos de 44 px no celular;
  - a sanfona do plano e o tempo-alvo pelo teclado, com anel de foco;
  - nenhuma animação com movimento reduzido.

  Nenhum teste existente foi alterado (critério 1).

## Lighthouse no celular (build final)

| Tela | Desempenho | Acessibilidade | Boas práticas |
|---|---|---|---|
| Hoje (com "Amanhã cedo") | 96 | 100 | 96 |
| Editar ciclo | 97 | 100 | 96 |
| Percurso | 97 | 100 | 96 |
| Plano de prova | 97 | 100 | 96 |
| Simulador | 97 | 100 | 96 |
| Configurações › Treino | 97 | 100 | 96 |

As metas são 80, 95 e 90. Os 4 pontos de boas práticas são o `favicon.ico` que o navegador procura na raiz do servidor de teste local, fora do app, como nas fases anteriores.

## Desempenho

- Recalcular o plano de 42,195 km leva menos de 1 ms. A meta era 50 ms (`plano.test`).
- A previsão faz no máximo uma busca por abertura, com cache de 3 h e timeout de 10 s. `plano-app` e `amanha-app` contam as chamadas.

## Os 18 critérios

| # | Critério | Situação | Como foi verificado |
|---|---|---|---|
| 1 | Testes atuais, golden e paridade do `engine.mjs`, sem alterar testes existentes | ok | Os 7 testes do motor, `test:analise` (14 arquivos), `npm test` (82), `test:app` (81), offline, Garmin, trajeto, leitura, compare-views 100%; `engine.mjs` sem diferença |
| 2 | Ciclo antigo sem os campos novos funciona | ok | `ciclo-app` |
| 3 | GPX de 42,195 km: perfil igual (até 1 m) | ok | `percurso.test`: 0,10 m |
| 4 | Gravação em 2 partes: ordem certa, total = soma | ok | `percurso.test`, `ciclo-app` |
| 5 | 1,4%: ajusta e avisa; 3%: pergunta | ok | `percurso.test`, `ciclo-app` |
| 6 | Digitada sem fonte não salva; com fonte, confiança Baixa e a fonte | ok | `percurso.test`, `ciclo-app` |
| 7 | Soma dos km = tempo-alvo (±1 s); plano plano, mesmo pace | ok | `plano.test`, `plano-app` |
| 8 | Pace = P × `gradeCostMult` do motor | ok | `plano.test` |
| 9 | Segunda metade mais rápida, mesmo tempo final, ±1% | ok | `plano.test` |
| 10 | > 16 dias: clima padrão e a data; depois, previsão ou clima padrão se falhar | ok | `plano.test`, `plano-app` |
| 11 | Imagem 1080×1920 com topo e pé livres; compartilhar no iPhone, baixar no computador | ok* | `plano-app`. *Confira "Salvar imagem" no seu iPhone |
| 12 | O plano abre em modo avião | ok | `test:offline` |
| 13 | Os passos somam a faixa; âncora do card; "Usar como meta" grava | ok | `simulador.test`, `simulador-app` |
| 14 | "Terminar bem" usa a ponta lenta | ok | `plano.test`, `plano-app` |
| 15 | "Amanhã cedo": horário, clima padrão = 0, chuva e empate, some sem internet | ok | `amanha.test`, `amanha-app` |
| 16 | O ponto manual não vai para a sincronização | ok | `amanha-app` |
| 17 | Telas como o design em 390 e 1440 px; nenhum valor de exemplo | ok | Prints de cada etapa; busca por "5h30", "5h40", "106 m" e "28/03/2027": nada |
| 18 | Lighthouse no celular com as notas mínimas | ok | Tabela acima |

## Pendências e observações

- **No iPhone:** conferir "Salvar imagem" na folha de compartilhar e a imagem como tela de bloqueio (critério 11).
- **Percurso real:** você ainda não tem o percurso da prova. Quando tiver uma gravação ou a altimetria, ele entra por Editar ciclo › Percurso.
- **Âncora do tempo realista:** provas oficiais e os treinos que você marcar como "Prova" viram a âncora. Hoje, sem nenhum marcado, a âncora é o treino mais recente e a confiança fica Baixa.
- **Herdado das fases anteriores:** o avatar do cabeçalho (36 px) e o seletor de período do Hoje (40 px) continuam abaixo de 44 px. Posso aumentar se você quiser.

## Depois da pausa final (21/11)

- **Critério 11, conferido pelo Lucas no iPhone:** a folha de compartilhar mostra "Salvar imagem", e o relógio da tela de bloqueio não cobre o plano. **Os 18 critérios estão atendidos.**
- **Pedido do Lucas:** o avatar do cabeçalho (antes 36 px) e o seletor de período do Hoje (antes 40 px) passaram a ter 44 px também no desenho.
- **Teste `fase4-telas`:** passou a conferir o cabeçalho.
