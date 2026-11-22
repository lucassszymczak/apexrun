# Fase 5 · Etapa 6 — Acabamento e os 10 critérios

## O que mudou nesta etapa

- **Alvos de toque de 44 px no Completar:** "Adicionar" (fotos) e "Alterar" (privacidade) passaram de 40 para 44 px. Os dois vinham da Fase 1.
- **Ciclo de prova:**
  - o texto "EF início↔fim" virou "EF do início ao fim". A seta "↔" conta como emoji para o leitor de tela e para a regra da marca;
  - a tabela do tempo realista repetia a chave de uma linha quando a prova é de um tipo (meia) com distância diferente da oficial. Isso gerava aviso no console; agora não gera mais. Nenhum número muda.
- **Teste novo `scripts/fase5-telas.mjs`** (19). Passa pelas 9 telas da fase (Hoje com os avisos, Completar novo e de treino antigo, Equipamentos, Resumo, Corpo, Retrospectiva, Ciclo de prova e Livro) em 390 px escuro, 1440 px e 390 px claro. Confere:
  - sem emoji, no máximo 1 ação magenta, botões com nome, campos com rótulo, tabelas com `scope`, imagens com texto alternativo e alvos de 44 px;
  - mapa do corpo só pelo teclado: marcar, ajustar e desmarcar, com anel de foco;
  - movimento reduzido sem animação;
  - desempenho, privacidade dos Stories e os valores de exemplo do design.

## Desempenho (seção 6)

| Meta | Medido | Situação |
|---|---|---|
| Entender a frase em até 20 ms | **0,1 ms** (p95 de 200 leituras); o pior caso ficou abaixo de 5 ms | ok |
| Abrir o Resumo em até 300 ms depois de salvar | **106 a 121 ms** | ok |
| Gerar os 6 Stories em até 3 s no iPhone | **0,1 s** no computador; **0,4 a 0,5 s** com o processador 4× mais lento | ok |

## Lighthouse no celular (build final)

| Tela | Desempenho | Acessibilidade | Boas práticas |
|---|---|---|---|
| Hoje | 96 | 100 | 96 |
| Completar (Editar treino) | 97 | 100 | 96 |
| Equipamentos | 97 | 100 | 96 |
| Progresso › Corpo | 97 | 100 | 96 |
| Retrospectiva | 97 | 100 | 96 |

- As metas são 80, 95 e 90.
- Os 4 pontos de boas práticas são o `favicon.ico` que o navegador procura na raiz do servidor de teste local, como nas fases anteriores.

## Os 10 critérios

| # | Critério | Situação | Como foi verificado |
|---|---|---|---|
| 1 | Testes atuais, golden e paridade do `engine.mjs`, sem alterar testes existentes | ok | Os 6 testes do motor; `test:analise` (23 arquivos); `npm test` (82); `test:app` (81); `test:offline` (10); `test:garmin` (24); todas as suítes de telas; compare-views 100%; `engine.mjs` sem diferença |
| 2 | Frase falada: as frases aprovadas, nada salvo sem "Salvar treino", "Dor articular" nunca ligada | ok | `fala.test`: as 24 frases aprovadas e mais 9 casos. `fala-app`: o estado salvo é igual antes de "Salvar treino", e o interruptor continua desligado mesmo com "dor articular no joelho direito" |
| 3 | Mapa do corpo por toque, teclado e leitor de tela; `dorRegioes` salvo e sincronizado; treinos antigos abrem | ok | `fala-app` (toque, teclado e lista); `fase5-telas` (só teclado); `fala.test` (sincronização pelo `syncMergeStates` do motor); treino antigo abre sem regiões |
| 4 | Dor muscular pela regra aprovada (a); prontidão de treinos antigos não muda | ok | `fala-app` (vem do mapa só com o campo vazio e acompanha a maior dor); golden sem diferença |
| 5 | Equipamentos: km só de corridas ou só de pedais; "Troquei" zera e guarda; aviso aos 90% e card no limite; sem limite, sem aviso | ok | `equipamentos.test`; `equipamentos-app` (24) |
| 6 | Resumo abre ao salvar, só mudanças reais, "Ver o treino" e "Compartilhar" | ok | `resumo.test` (16); `resumo-app` (21), com o caso sem nenhuma mudança |
| 7 | Corpo: contagem, linha do tempo, sem alerta nem diagnóstico | ok | `corpo.test` (6); `resumo-app` compara com o módulo e procura alerta ou diagnóstico |
| 8 | Retrospectiva: números iguais aos módulos de origem, blocos sem dado somem, 6 Stories 1080×1920 sem mapa | ok | `retrospectiva.test` (20); `retrospectiva-app` (24); `fase5-telas` confere que o gerador não importa trajeto, mapa nem segmentos |
| 9 | Telas como o design em 390 e 1440 px; nenhum valor de exemplo | ok | Prints de cada etapa. A busca por "625 km", "5:27:12", "Tênis de treino" e "518 de 600" fora dos testes não encontra nada (`fase5-telas`) |
| 10 | Metas de desempenho e Lighthouse no celular | ok | Tabelas acima |

## Pontos em aberto

- **Regiões pequenas do mapa do corpo.**
  - No desenho aprovado, algumas regiões ficam menores que 44 px no celular: joelho com 22 px de altura, tornozelo e pé e tendão de Aquiles com 16 px.
  - Elas não cabem maiores sem se sobrepor.
  - O caminho equivalente existe e tem 44 px: a lista "Ou escolha a região na lista" e os botões − e +. O teste confere esse caminho.
  - Se quiser, dá para ampliar o desenho do corpo no celular, ou abrir uma lupa ao tocar perto dos joelhos e pés.
- **Suíte de telas da Fase 3 instável.** Às vezes falha num item de tempo (mapa de calor perto de 1 s) ou no fantasma em modo avião. Ela passa ao rodar de novo. Firmar essa suíte mexeria num teste existente, então ficou como está.
- **Ditado do iPhone:** ainda falta um texto real ditado por você, para ajustar o vocabulário do "Diga como foi".
