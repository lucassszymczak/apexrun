# Fase 3 · Etapa 6 — Acabamento e os 10 critérios

## O que mudou nesta etapa

- **Mapa de calor:**
  - **descrição em texto** para leitor de tela, com quantos treinos, os km de ruas e onde ficam as ruas mais frequentes, em relação ao desenho ("no centro", "a nordeste"…). Nenhum endereço;
  - **escolha de rua sem tocar no mapa:** "Anterior / Próxima" percorre as 30 ruas mais frequentes, da mais para a menos. Funciona pelo teclado e pelo leitor de tela (era a pendência da Etapa 3).
- **Alvos de toque de 44 px no Treino** (herdados das fases anteriores):
  - o puxador da gaveta (28 → 44 px);
  - os botões de velocidade do replay (área de toque de 44 px, sem mudar o desenho);
  - o "Adicionar" das fotos (40 → 44 px);
  - os links "Ver todos os segmentos" e "Como … é calculado" quando são link.
- **Testes novos dentro dos arquivos da Fase 3:**
  - `calor.test`: região mais frequente e ruas em ordem;
  - `segmentos.test`: o nome renomeado chega pela sincronização (`syncMergeStates` do motor).
- **Teste novo `scripts/fase3-telas.mjs`** (18): passa pelas 9 telas da fase em 390 px escuro, 1440 px e 390 px claro, além de teclado, modo avião, movimento reduzido, privacidade e desempenho.

## Desempenho (seção 6)

| Meta | Medido | Situação |
|---|---|---|
| Mapa de calor com 200 treinos em até 1 s num iPhone recente | 200 treinos de 1 h a 1 Hz, abrindo do zero: **0,8 s**. Com o processador 4× mais lento (celular mais antigo): 4,6 s. Reabrir na mesma sessão: cerca de 0,2 s | ok |
| Treino novo contra os segmentos em até 300 ms | 1 h a 1 Hz contra 40 segmentos: **38 ms** | ok |
| Replay com fantasma a 60 quadros por segundo | Quadros com mediana de **16 ms** e p95 de 17 ms | ok |

A busca completa dos segmentos (todos os trajetos) roda em segundo plano. Com os seus 108 trajetos leves, leva 1,3 s no computador.

## Lighthouse no celular (build final)

| Tela | Desempenho | Acessibilidade | Boas práticas |
|---|---|---|---|
| Progresso | 97 | 100 | 96 |
| Consistência | 97 | 100 | 96 |
| Mapa de calor | 97 | 100 | 96 |
| Segmentos | 97 | 100 | 96 |
| Relatório semanal | 97 | 100 | 96 |
| Configurações › Treino | 97 | 100 | 96 |

As metas são 80, 95 e 90. Os 4 pontos de boas práticas são o `favicon.ico` que o navegador procura na raiz do servidor de teste local, como nas fases anteriores.

## Os 10 critérios

| # | Critério | Situação | Como foi verificado |
|---|---|---|---|
| 1 | Testes atuais, golden e paridade do `engine.mjs`, sem alterar testes existentes | ok | Os 6 testes do motor; `test:analise` (18 arquivos); `npm test` (82); `test:app` (81); `test:offline` (10); `test:garmin` (24); todas as suítes de telas; compare-views 100%; `engine.mjs` sem diferença |
| 2 | Mapa de calor: contagem com vaivém, modalidades separadas, período, rua tocada lista os treinos certos, sem trajeto no aviso, nunca no card nem no compartilhamento | ok | `calor.test` (25); `calor-app` (28); `fase3-telas`: o gerador de cards não importa calor, segmentos nem fantasma, e a tela de compartilhar não mostra nenhum deles |
| 3 | Segmentos: 3 treinos no mesmo trecho dão 1 segmento; sentido; sem sobreposição; "Renomear" persiste e sincroniza | ok | `segmentos.test` (33); `segmentos-app` |
| 4 | Tempo: 1 s com 1 Hz; ajustado = GAP do motor + `correcaoHadley`; sem ajustado no pedal; versão leve com a precisão em palavras | ok | `segmentos.test` compara com `gradeCostMult` e `correcaoHadley`. A tela marca "±5" e explica: "medida pela versão leve do trajeto, com precisão de cerca de 5 s" |
| 5 | Ranking e selos: "Seu melhor", "Nº de N", tendência | ok | `segmentos.test`, `segmentos-app` |
| 6 | Fantasma: padrão "Sem fantasma", só candidatos da regra, diferença na mesma distância, mensagem final, modo avião | ok | `fantasma.test` (22); `fantasma-app` (20); `fase3-telas` (modo avião) |
| 7 | Consistência: segunda a domingo no fuso, 79% × 80%, com e sem descanso, a semana em andamento não quebra, linha no Relatório | ok | `consistencia.test` (18); `consistencia-app` (29) |
| 8 | Telas como o design em 390 e 1440 px; nenhum valor de exemplo | ok | Prints de cada etapa; busca por "Subida perto de casa", "142 km", "6:52" e "4h30" no código: nada |
| 9 | Metas de desempenho | ok | Tabela acima |
| 10 | Lighthouse no celular | ok | Tabela acima |

## Observações

- **Celular mais antigo:** o mapa de calor com 200 treinos leva cerca de 4,6 s na primeira abertura; nas seguintes, é rápido. Hoje você tem 139 treinos.
  - Se ficar lento no seu iPhone, o próximo passo é guardar as quadrículas de cada treino no próprio aparelho, como a Etapa 0 propôs.
- **Fora desta fase, como combinado:** comunidade, "ruas que você nunca correu", tempo ajustado de pedal e sequência de dias seguidos.
