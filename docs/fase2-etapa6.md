# Fase 2 · Etapa 6 — Acabamento e os 19 critérios

## O que mudou nesta etapa

- **Tocar num tiro ou num melhor esforço destaca o trecho** no mapa (as duas camadas) e no gráfico. Tocar de novo tira o destaque.
- **Melhores esforços na gaveta:** até 4 linhas, as com selo primeiro, e "Ver todos" quando há mais.
- **Lugar de cada item, como no roteiro:**
  - a história do treino subiu para logo abaixo dos números, visível com a gaveta na altura média;
  - o custo da subida foi para junto de "Mecânica e ritmo";
  - o início da deriva também aparece em "Resistência".
- **Recordes:** o aviso "Só entram treinos com o trajeto salvo" e o botão para buscar trajetos no Garmin.
- **Tabelas:** todas com `<th scope="col">`.
- **Gaveta toda aberta no celular:** os controles do mapa saem de cena, porque subiam por cima da barra do topo.
- **Replay que preenche o trajeto** (pedido do Lucas, 21/11): ao apertar o play, só o trecho já percorrido fica colorido, e o resto aparece apagado até o corredor passar. Tocar no mapa ou no gráfico mostra o trajeto inteiro de novo. Testado no navegador: no meio, só o trecho percorrido está colorido; no fim, o trajeto inteiro volta colorido.
- **Testes novos de tiros:**
  - voltas manuais;
  - um .FIT estruturado gravado de verdade, com a faixa alvo do relógio;
  - "sem GPS, sem vento".

## Desempenho da leitura (Meia de Floripa)

| Medição | Tempo |
|---|---|
| Computador, sem freio | 1 ms |
| Processador 4× mais lento, para simular o celular | 3 ms |
| Meta | 300 ms |

A Meia tem 1.216 pontos, porque o relógio grava cerca de 1 ponto a cada 8 s. Medido no navegador, com o código do app.

## Lighthouse no celular (build final)

| Tela | Desempenho | Acessibilidade | Boas práticas |
|---|---|---|---|
| Hoje | 96 | 100 | 96 |
| Treinos | 97 | 100 | 96 |
| Progresso | 97 | 100 | 96 |
| Livro de fórmulas | 97 | 100 | 96 |

As metas da Fase 1 são 80, 95 e 90. Os 4 pontos de boas práticas são só o `favicon.ico` que o navegador procura na raiz do servidor de teste local, fora do app. O app declara os próprios ícones.

## Os 19 critérios

| # | Critério | Situação | Como foi verificado |
|---|---|---|---|
| 1 | Testes e golden master da Fase 1 passam; `engine.mjs` idêntico | ok | 6 testes do motor + `engine.test` (paridade) + `test:analise` (10 arquivos) + `npm test` (82) + compare-views 100% |
| 2 | Chave válida mostra "Conectado"; inválida dá erro claro e nada é gravado | ok | `tests/garmin-fn.test.ts` e a sua conexão real na Etapa 1 |
| 3 | A chave não aparece no aparelho, nas respostas nem nos logs | ok | Teste automático das respostas e do log, teste no aparelho (`garmin-app`) e conferência do Lucas nos logs da função (21/11): a chave não aparece. |
| 4 | `sync_id` fora da lista e origem fora do CORS são recusados (403) | ok | `tests/garmin-fn.test.ts` |
| 5 | Atividade nova vai para "Para completar"; Completar; selo Garmin | ok | `garmin-app` (24) |
| 6 | Meia importada à mão não duplica | ok | `garmin-app` |
| 7 | Completar no celular tira da fila do computador | ok | `garmin-app` (aparelho B) |
| 8 | Sem internet, chave vencida ou Garmin fora do ar: abre e avisa, sem insistir | ok | `garmin-app` + espera de 1, 5, 15 e 60 min na função |
| 9 | Aviso de vencimento 30 dias antes | ok | `garmin-app` (data simulada) |
| 10 | Trajeto nos dois aparelhos; versão leve da Meia ≤ 30 KB; fotos não sobem | ok | `tracks-app` (11). Meia: 19,0 KB |
| 11 | "Buscar trajeto dos treinos antigos" não muda nenhum número | ok | `tracks-app`: igual byte a byte, fora o campo novo `leitura` |
| 12 | Cada cálculo: fórmula aprovada, verbete, selo, `leitura.v` e testes (sem GPS, sem FC, esteira, pausas) | ok | `leitura.test` (49) + Livro (7 verbetes) |
| 13 | Tiros: tabela = voltas (±1 s, ±1 m); km automático não vira tiro | ok* | Seu .FIT de 19/11 (voltas por tempo) e a Meia. *Estruturado e voltas manuais: com arquivos sintéticos. O .FIT enviado em 21/11 é o mesmo de 19/11 (voltas por tempo). |
| 14 | Melhor 1 km sintético conhecido; selos batem | ok | `leitura.test` |
| 15 | Custo da subida: soma das faixas = tempo total (±1 s); GAP = o do motor | ok | `leitura.test` |
| 16 | Vento: legenda com palavras, seta para onde sopra; sem clima, some | ok | `leitura.test` + `leitura-app` |
| 17 | Hoje com pendências: "Completar treino" em magenta e "+" em contorno; nunca duas ações magenta | ok | `garmin-app` + teste de fumaça (22 rotas) |
| 18 | Telas batem com o design em 390 e 1440 px; nenhum valor de exemplo copiado | ok | Prints + busca por "7:31", "18 km/h", "km 17" e "20/11/2027": nada encontrado |
| 19 | Lighthouse no celular com as notas mínimas da Fase 1 | ok | Tabela acima |

## Para você conferir

- **Treinos que você já tem:** em Progresso, toque em "Calcular a leitura de N treinos com trajeto". Os que ainda não têm trajeto aparecem com o botão "Buscar trajeto no Garmin".
- **Quando fizer um treino estruturado ou com voltas manuais**, guarde o .FIT. Assim o critério 13 também fica testado com arquivo real.
