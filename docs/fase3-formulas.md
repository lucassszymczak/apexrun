# Fase 3 · Etapa 1 — As 6 regras para aprovar

Cada item diz o que responde, como funciona, um exemplo com os seus treinos e a minha recomendação.
- **Dados dos exemplos:** os 139 treinos e os 138 trajetos leves do servidor, em 21/11. Ficam só neste ambiente, em `fixtures/privado/`, que não vai para o repositório.
- **Endereços:** nenhum. Os exemplos só têm contagens.
- **Telas de design:** nenhum número delas entra aqui.
- **Fórmulas do app:** as que já existem são importadas, nunca copiadas: o GAP do motor e `correcaoHadley`.

---

## 1. Mapa de calor

- **O que responde:** por onde você treina, e quantas vezes passou em cada rua.
- **Como funciona:**
  - **Quadrículas:** o mapa é dividido em quadrículas de **25 m**. É mais que o erro típico do GPS e menos que um quarteirão.
  - **Vaivém:** cada treino conta **uma vez** em cada quadrícula, mesmo que passe por ela de novo. Isso importa: as suas 28 corridas dos últimos 12 meses passam mais de uma vez pela mesma quadrícula (ida e volta, voltas no quarteirão).
  - **Faixas de cor:** 1–2 vezes, 3–5, 6–10, 11–19 e 20 ou mais. As cores são as da Fase 3, e a linha fica mais grossa quanto maior a faixa.
  - **Tocar numa rua:** o app pega a quadrícula mais perto do dedo e destaca as vizinhas que tiveram **exatamente os mesmos treinos**. Embaixo, mostra a contagem e a lista desses treinos, com "Ver os N treinos".
  - **"Km de ruas diferentes":** número de quadrículas × 25 m. É uma aproximação, e a tela diz "cerca de".
  - **Modalidade:** corrida e pedal nunca se misturam. Esteira e treino sem trajeto ficam de fora e entram no aviso.
- **Exemplo com os seus treinos:**

  | Recorte | Treinos com trajeto | Ruas | 1–2 / 3–5 / 6–10 / 11–19 / 20+ (quadrículas) |
  |---|---|---|---|
  | Corrida, 12 meses | 28 (1 sem trajeto) | cerca de 85 km | 2.731 / 501 / 155 / 0 / 0 |
  | Corrida, tudo | 108 | cerca de 203 km | 5.358 / 1.454 / 639 / 446 / 205 |
  | Pedal, tudo | 25 | cerca de 107 km | 3.191 / 733 / 307 / 67 / 0 |

  Nos últimos 12 meses não houve pedal com trajeto. Por isso o pedal aparece melhor no período "Tudo".
- **Quando não aparece:** sem nenhum treino com trajeto na modalidade e no período. A tela diz isso e oferece "Buscar trajetos antigos" se o Garmin estiver conectado.
- **Verbete do Livro:** "Mapa de calor: as ruas por onde você treinou, coloridas pelo número de treinos que passaram por elas. Cada treino conta uma vez por trecho de 25 m, mesmo que vá e volte. Só você vê."
- **Recomendação:** aprovar.

## 2. Detecção de segmentos

- **O que responde:** quais trechos você repete o bastante para comparar.
- **Como funciona:**
  - **Distância mínima:** 500 m.
  - **Passagens mínimas:** 3 treinos diferentes.
  - **Sentido:** ida e volta são **segmentos separados**. A subida de um lado é a descida do outro, e os tempos não são comparáveis.
  - **Corredor de tolerância:** 25 m, a mesma quadrícula do mapa de calor ou a vizinha. Absorve o erro do GPS.
  - **Sobreposição:** quando dois trechos dividem um pedaço, fica o que tem mais passagens; no empate, o mais longo. O outro é cortado, e se ficar com menos de 500 m é descartado. Assim, nenhum trecho conta duas vezes.
  - **Limite:** os 40 com mais passagens, em cada modalidade.
  - **Modalidade:** corrida e pedal têm listas separadas.
  - **Nome automático:** sem endereço, só pelo terreno e pela distância, por exemplo "Subida de 0,6 km" ou "Plano de 1,2 km", numerados se repetirem. Você pode renomear.
- **Precisão:** o tempo de cada passagem sai do trajeto completo, com 1 s de precisão. Num aparelho que só tem a versão leve, a tela escreve "±5 s".
- **Exemplo com os seus treinos:** num teste rápido com a regra, as 28 corridas com trajeto dos últimos 12 meses têm **14 trechos repetidos** de 500 m ou mais em pelo menos 3 corridas, com mediana de 600 m. Isso é antes de tirar as sobreposições; a lista final deve ficar menor.
- **Quando não aparece:** com menos de 3 treinos no mesmo trecho.
- **Verbete do Livro:** "Segmento: um trecho de 500 m ou mais que você percorreu no mesmo sentido em pelo menos 3 treinos. O app encontra sozinho; você pode renomear."
- **Recomendação:** aprovar.

## 3. Tempo ajustado (só corrida)

- **O que responde:** o tempo que você teria feito no trecho se ele fosse plano e o clima fosse padrão. Serve para comparar passagens de dias diferentes com justiça.
- **Como funciona, nesta ordem:**
  1. **Inclinação:** o tempo do trecho vira o tempo equivalente no plano, pelo GAP do motor (`vGap`), segundo a segundo. É a mesma conta do "custo da subida" da Fase 2.
  2. **Clima:** esse tempo é corrigido pelo clima do dia do treino, com a regra temperatura + orvalho (`correcaoHadley`). Em clima padrão, a correção é 0.
  3. Ajustado = tempo no plano × (1 − correção do clima).
- **Pedal:** só o tempo real. As fórmulas de inclinação e de clima do app são de corrida.
- **Exemplo inventado** (a conta é a mesma com os seus dados): um trecho com subida de 3% feito em 4:00, num dia de 22 °C com orvalho de 18 °C.
  - O GAP leva para cerca de 3:37 no plano (subida de 3% pesa 10,5%).
  - O clima corrige 2,5%, e o ajustado fica cerca de 3:32.
- **Quando não aparece:** no pedal. Sem clima salvo no treino, o ajustado usa só a inclinação, e a tela diz "sem clima".
- **Verbete do Livro:** "Tempo ajustado: o tempo do trecho como se fosse plano e em clima padrão. Usa o GAP do app e a regra temperatura + orvalho. Só corrida."
- **Recomendação:** aprovar.

## 4. Tendência

- **O que responde:** se você está ficando mais rápido no trecho.
- **Como funciona:**
  - **Comparação:** a média do tempo (ajustado na corrida, real no pedal) das **3 passagens mais recentes** contra a média das **3 anteriores**.
  - **2% ou mais mais rápido:** "Mais rápido", com seta e cor `--ok`. O título vira "Você está X s mais rápido que em <mês>", com o mês da passagem mais antiga das 3 anteriores.
  - **2% ou mais mais lento:** "Mais lento", em `--atencao`.
  - **Entre os dois:** "Estável".
  - **Com menos de 6 passagens:** "Poucas passagens", sem seta.
- **Exemplo inventado:** passagens antigas de 3:50, 3:48 e 3:52 (média 3:50), e recentes de 3:41, 3:44 e 3:40 (média 3:42). A diferença é de 3,5%: "Mais rápido". O título fica "Você está 8 s mais rápido que em <mês>".
- **Verbete do Livro:** "Tendência: a média das suas 3 passagens mais recentes comparada com a das 3 anteriores. Diferença de 2% ou mais vira mais rápido ou mais lento; menos que isso, estável."
- **Recomendação:** aprovar.

## 5. Fantasma

- **O que responde:** como você foi contra uma versão anterior sua, no mesmo percurso.
- **Quem pode ser fantasma:**
  - um treino da **mesma modalidade**;
  - que tenha **pelo menos 80%** do percurso em comum, nos dois sentidos da comparação: o seu treino coberto pelo dele e o dele pelo seu;
  - com **diferença de distância de até 10%**.
- **"Seu melhor":** o candidato com o menor tempo. **"Mais recente":** o de data mais próxima. Os outros aparecem por data. O padrão é sempre "Sem fantasma".
- **Alinhamento:** pela distância. Quando você está no km X, o fantasma está onde ele estava no km X do treino dele. A diferença é o seu tempo menos o dele naquela mesma distância. No fim, a tela diz "Você terminou X s à frente" ou "X s atrás".
- **Exemplo com os seus treinos:** a corrida de 19/11 (6,09 km) tem **2 candidatos**:
  - 18/08 (6,02 km, 96% do percurso em comum);
  - 21/08 (6,01 km, 94%).
- **Quando não aparece:** sem nenhum candidato. O botão mostra "Sem treinos parecidos".
- **Verbete do Livro:** "Fantasma: um treino seu anterior no mesmo percurso (80% em comum e distância até 10% diferente), que anda junto no replay. A diferença é medida na mesma distância."
- **Recomendação:** aprovar.

## 6. Semana consistente

- **O que responde:** se você está treinando com regularidade, sem precisar treinar todo dia.
- **Como funciona:**
  - **Semana:** de segunda a domingo, no horário de Brasília.
  - **O que conta como treino:** corrida, pedal e força. Hoje o app não registra sessão de força; quando passar a registrar, ela entra.
  - **Descanso:** um dia sem nenhum treino.
  - **Consistente:** pelo menos **80% das horas da meta** e pelo menos **1 dia de descanso**.
  - **Parcial:** houve treino, mas sem as duas condições.
  - **Sem treino:** nenhuma hora na semana.
  - **Em andamento:** a semana atual, que só entra na conta quando terminar.
  - **Meta:** a sua, quando você preencher em Configurações › Treino ("Meta semanal em horas", opcional). Sem meta, o app usa uma meta padrão. Escolha a regra:
    - **(a) Móvel (recomendo):** a média das 4 semanas anteriores com treino, arredondada a 0,5 h, com mínimo de 1 h. Acompanha o seu nível do momento.
    - **(b) Fixa:** a média das últimas 8 semanas encerradas, arredondada a 0,5 h. Hoje daria 1,5 h, porque setembro e outubro foram fracos.
  - **Sequência:** semanas consistentes seguidas, contando até a última semana encerrada. A semana em andamento não quebra a sequência.
- **Exemplo com os seus treinos** (últimas 12 semanas encerradas):

  | Semana de | Horas | (a) meta móvel | (a) resultado | (b) meta fixa 1,5 h | (b) resultado |
  |---|---|---|---|---|---|
  | 24/08 | 3,4 h | 2,5 h | Consistente | 230% | Consistente |
  | 31/08 | 1,0 h | 2,5 h | Parcial | 67% | Parcial |
  | 07/09 | 1,5 h | 2 h | Parcial (77%) | 102% | Consistente |
  | 14/09 | 1,4 h | 2,5 h | Parcial | 91% | Consistente |
  | 21/09 | 0,6 h | 2 h | Parcial | 39% | Parcial |
  | 28/09 | 0,8 h | 1 h | Consistente (82%) | 55% | Parcial |
  | 05/10 | 0,5 h | 1 h | Parcial | 33% | Parcial |
  | 12/10 | 1,2 h | 1 h | Consistente | **79%** | **Parcial** (por 1 ponto) |
  | 19/10 | 1,5 h | 1 h | Consistente | 99% | Consistente |
  | 26/10 | 3,0 h | 1 h | Consistente | 203% | Consistente |
  | 02/11 | 2,4 h | 1,5 h | Consistente | 161% | Consistente |
  | 09/11 | 2,6 h | 2 h | Consistente | 173% | Consistente |
  | **Total** | | | **7 de 12 · sequência atual 5** | | **7 de 12 · sequência atual 4** |

  Todas essas semanas tiveram de 4 a 6 dias de descanso, então o descanso nunca derrubou uma semana.
- **Verbete do Livro:** "Semana consistente: de segunda a domingo, pelo menos 80% das horas da sua meta e pelo menos 1 dia de descanso. O descanso conta a favor. A semana atual não quebra a sequência."
- **Recomendação:** aprovar com a meta móvel (a). Com a fixa, a meta fica baixa para o seu momento atual.

---

## Para responder

Responda cada linha com **aprova**, **ajusta** (e o quê) ou **fora**.

1. Mapa de calor (quadrícula de 25 m, uma vez por treino, faixas 1–2 a 20+):
2. Detecção de segmentos (500 m, 3 passagens, ida e volta separadas, 25 m, sem sobreposição, até 40):
3. Tempo ajustado (GAP e depois clima; pedal só real):
4. Tendência (3 recentes × 3 anteriores, 2%, mínimo de 6 passagens):
5. Fantasma (mesma modalidade, 80% em comum, até 10% de distância):
6. Semana consistente (80% da meta e 1 descanso; meta padrão (a) móvel ou (b) fixa):

---

## Decisão do Lucas (21/11)

- **As 6 regras foram aprovadas como propostas.**
- **Meta semanal:** fica como opção em Configurações › Treino, para o Lucas preencher quando quiser. Sem meta preenchida, vale a **meta padrão móvel (a)**, a recomendada: média das 4 semanas anteriores com treino, arredondada a 0,5 h, com mínimo de 1 h.
