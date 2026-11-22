# Fase 5 · Etapa 5 — Retrospectiva do ciclo e Stories

Regra aprovada em 21/11 (`docs/fase5-formulas.md`, item 6).

## O que entrou

### Módulo `analise/retrospectiva.mjs`

- Puro, com `retrospectiva.test.mjs` (20 testes).
- **Blocos, na ordem aprovada:** capa, volume, consistência, recordes e longão, a prova (plano × real), segmentos, tênis. Sem dado, o bloco não aparece.
- Tudo vem por importação, sem fórmula copiada:
  - a consistência da Fase 3 (a semana em andamento fica de fora);
  - os selos de recorde da Fase 2;
  - a tendência dos segmentos da Fase 3;
  - as passagens do plano da Fase 4;
  - o km do tênis da Fase 5.
- **A prova:**
  - é o treino do tipo Prova na data da prova, com 1 dia de folga;
  - o "real" de cada passagem sai do trajeto da prova (1 Hz), quando ele está no aparelho. Sem o trajeto, usa os splits.
- **Tênis:** o card diz "Hora de trocar o par." quando o par passou do limite.

### Tela `Mais › Ciclo de prova › Retrospectiva`

- **Capa:** nome, datas, semanas e o título-conclusão. Na versão "até agora", uma nota diz até quando vai o ciclo.
- **Volume:** barras de km por semana desde o zero, com o pico em `--ciano`.
- **Consistência:** a grade de semanas da Fase 3, com a legenda em palavras.
- **Recordes:** selo "Recorde pessoal" e o longão mais longo, com link para o treino.
- **A prova:** tabela Passagem · Plano · Real, com a chegada em `--magenta`.
- **Segmentos e tênis:** num bloco só, como no design.
- **"Gerar Stories"** é a ação principal. Ela mostra a prévia dos cards e "Salvar os N cards".
- **Onde aparece:**
  - no Hoje, o card "Sua retrospectiva do ciclo está pronta", do dia seguinte à prova até 14 dias depois;
  - no Ciclo de prova, o link "Retrospectiva até agora" (depois da prova, "Retrospectiva do ciclo").
- **Livro de fórmulas:** verbete "Retrospectiva do ciclo".

### Stories (`share/retro-img.ts`)

- Até 6 cards 1080×1920 em `--noite`.
- Cada card tem o rótulo, um número grande, a linha de apoio, o gráfico ou a lista do bloco e a marca no pé, com "N de 6".
- O topo (13%) e o pé (16%) ficam livres para as barras do Instagram e do iPhone.
- Cada card tem texto alternativo.
- **Salvar:** os 6 de uma vez pelo menu do celular. Se o aparelho não aceitar vários, vai um por vez; sem menu, os arquivos são baixados.
- **Desempenho:** os 6 cards ficam prontos em **101 ms** (meta: 3 s).

## Ponto para você decidir

- **Segmentos fora dos Stories.**
  - A regra aprovada dizia que, com os 7 blocos, segmentos e tênis dividiriam o último card.
  - Mas as regras do projeto proíbem segmento em card e compartilhamento, porque eles revelam onde você mora. O design dos Stories também não traz segmentos.
  - Por isso, os segmentos aparecem só na tela. Os Stories ficam com capa, volume, consistência, recordes, prova e tênis, no máximo 6, sem dividir card.
  - Se preferir outra saída, é uma troca pequena.

## Com o seu ciclo atual (São Silvestre, até agora)

| Bloco | Título |
|---|---|
| Capa | "5 semanas até agora." |
| Volume | "86,3 km em 11 h, com pico de 23,3 km na semana 2." |
| Consistência | "4 de 4 semanas consistentes. Maior sequência: 4." |
| Recordes | "1 recorde pessoal no ciclo." |
| Stories | 4 cards |

- A proposta falava em "4 das 5 semanas". A diferença é a semana atual, que ainda está em andamento e, pela regra da Fase 3, não entra na conta.
- Prova, segmentos e tênis ainda não aparecem: a prova não aconteceu, nenhum segmento melhorou o bastante e nenhum tênis está cadastrado.

## Testes

| Teste | Resultado |
|---|---|
| 6 testes do motor | todos passam |
| `test:analise` (23 arquivos, com `retrospectiva.test`; inclui o golden) | todos passam |
| `npm test` · `test:app` · `test:offline` · `test:garmin` | 82 · 81 · 10 · 24 |
| Suítes das Fases 3, 4 e 5 (amanhã, calor, ciclo, consistência, equipamentos, fala, fantasma, leitura, plano, resumo, segmentos, simulador, tracks, telas das Fases 3 e 4) | todas passam |
| `compare-views` | 100% (1892 de 1892) |
| **Novo `scripts/retrospectiva-app.mjs`** | **24** |

- `engine.mjs` sem diferença. Nenhum teste existente foi alterado.
- **Teste de privacidade da Fase 3:** a checagem de que "o gerador de cards não cita mapa de calor nem segmentos" pegou a palavra num comentário do gerador dos Stories. O comentário foi reescrito; o código já não recebia segmentos.
- **Telas da Fase 3:** depois da correção, rodei a suíte 3 vezes. A 3ª passou inteira (18 de 18). Nas duas primeiras, falhou 1 item diferente em cada uma:
  - o fantasma em modo avião;
  - o tempo do mapa de calor, com a máquina carregada: 1,26 s para o limite de 1 s.

  Nenhum dos dois foi mexido nesta etapa, e ambos passaram nas outras rodadas.
