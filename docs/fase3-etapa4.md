# Fase 3 · Etapa 4 — Segmentos

Regras aprovadas em 21/11 (`docs/fase3-formulas.md`, itens 2, 3 e 4).

## O que entrou

- **Módulo `analise/segmentos.mjs`** (puro, com `segmentos.test.mjs`, 32 testes):
  - **detecção:**
    - 500 m ou mais, pelo menos 3 treinos diferentes, mesmo sentido (ida e volta separadas);
    - corredor de 25 m (a quadrícula do mapa de calor ou a vizinha);
    - sem sobreposição: fica o de mais passagens; no empate, o mais longo. O outro é cortado e sai se ficar com menos de 500 m;
    - até 40 por modalidade;
  - **passagem:**
    - do ponto do trajeto mais perto do início ao mais perto do fim, em tempo decorrido;
    - uma por treino (a mais rápida);
    - precisão de 1 s com o trajeto completo e ±5 s com a versão leve;
  - **tempo ajustado (só corrida):** tempo × (distância ÷ distância GAP), com o `vGap` do motor, e depois × (1 − correção do clima), pela `correcaoHadley`. Sem clima, só a inclinação;
  - **tendência:** 3 passagens recentes × 3 anteriores, limite de 2%; com menos de 6 passagens, "poucas passagens";
  - **nomes automáticos sem endereço:** "Subida de 0,6 km", "Plano de 1,2 km (2)". O id sai da geometria.
- **Onde fica:**
  - catálogo em `athlete.segmentos`, com até 40 pontos da forma por segmento;
  - situação da busca em `athlete.segmentosMeta`;
  - passagens em `w.leitura.segmentos`.

  Tudo opcional e aditivo; sincroniza só entre os seus aparelhos.
- **Cálculo em segundo plano (Web Worker):** a tela não trava.
  - A busca só refaz quando muda o conjunto de treinos com trajeto neste aparelho.
  - Um aparelho com menos trajetos não apaga o catálogo do outro.
  - Uma passagem medida com o trajeto completo não é trocada por uma da versão leve.
- **Tela Segmentos** (Progresso › Segmentos):
  - Corrida e Pedal separados;
  - cada card mostra o desenho do trecho, a distância, o relevo, as passagens, o melhor tempo (e o ajustado na corrida) e a tendência com seta e palavra.
- **Detalhe do segmento:**
  - título-conclusão ("Você está 84 s mais rápido que em setembro.");
  - desenho do trecho (funciona sem internet);
  - evolução do tempo ajustado ou real, com "mais alto = mais rápido" e um losango no seu melhor;
  - ranking com o selo "Seu melhor" e "Ver as N passagens";
  - "Renomear".
  - No computador, lista e detalhe ficam lado a lado, e a tabela ganha a coluna Clima.
- **Treino › Segmentos deste treino:**
  - mostra a posição em cada segmento ("Seu melhor" ou "3º de 22");
  - tocar destaca o trecho no mapa;
  - um treino novo é medido contra o catálogo ao abrir.
- **Progresso:** card "Segmentos". **Livro de fórmulas:** verbetes "Segmento", "Tempo ajustado" e "Tendência no segmento".
- **Sem internet:** o cálculo em segundo plano entra no cache do app.

## Com os seus trajetos (versão leve do servidor, 21/11)

| Recorte | Treinos com trajeto | Segmentos | Tempo da busca |
|---|---|---|---|
| Corrida, 12 meses | 28 | 3 | 0,2 s |
| Corrida, tudo | 108 | 20 | 1,3 s |
| Pedal, tudo | 25 | 10 | 0,3 s |

- A busca do app usa todos os treinos com trajeto, sem filtro de período. No celular, deve levar alguns segundos, em segundo plano.
- O protótipo da Etapa 1 contava 14 trechos nos 12 meses antes de tirar as sobreposições. Com as sobreposições fora e o mínimo de 500 m medido no trajeto real, ficam 3.
- Os tempos da versão leve aparecem com "±5".

## Testes

| Teste | Resultado |
|---|---|
| 6 testes do motor | todos passam |
| `test:analise` (17 arquivos, com o novo `segmentos.test`) | todos passam |
| `npm test` · `test:app` · `test:offline` · `test:garmin` | 82 · 81 · 10 · 24 |
| `calor-app` · `consistencia-app` · `tracks-app` · `leitura-app` | 28 · 29 · 11 · 28 |
| `plano-app` · `ciclo-app` · `simulador-app` · `amanha-app` · `fase4-telas` | 21 · 21 · 13 · 12 · 10 |
| `compare-views` | 100% |
| **Novo `scripts/segmentos-app.mjs`** | **25** |

`engine.mjs` sem diferença. Nenhum teste existente foi alterado.

## Observações

- **Tempo decorrido:** a passagem conta o tempo decorrido, como foi aprovado. Uma parada num semáforo dentro do trecho entra no tempo. É por isso que algumas passagens dos seus dados saem bem mais lentas.
- **Ajustes pequenos fora dos segmentos:**
  - a leitura de um treino, quando é refeita, mantém as passagens dos segmentos;
  - o "Calcular a leitura de N treinos" passou a olhar para `leitura.v`, para não confundir um treino que só tem passagens com um que já tem a leitura.
