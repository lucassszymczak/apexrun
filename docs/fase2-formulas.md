# Fase 2 · Etapa 4 — Proposta das fórmulas novas (para aprovar item por item)

**Só documento: nenhum cálculo foi programado.** Cada item abaixo só entra no app depois do seu OK. O que você não aprovar fica fora, e a tela segue sem aquele elemento.

Regras que valem para todos os itens:
- **Onde é calculado:** uma vez, com o trajeto completo (1 ponto por segundo), no aparelho que importou o treino.
- **Onde fica guardado:** no campo `leitura` do treino, com a versão da fórmula (`leitura.v = 1`). O outro aparelho só exibe.
- **No app:** cada item ganha verbete no Livro de fórmulas, selo de confiança e Folha do KPI.
- **Sem dado, sem número:** sem GPS, sem FC ou sem clima, o item não aparece ou mostra "—" com o motivo. Nada é estimado.
- **O que já existe não muda:** os números atuais e o golden master ficam iguais.
- **Exemplos:** todos foram calculados com os seus arquivos reais. A Meia de Floripa é o .FIT 24159622528; o treino de 19/11 é o 25128573610.

---

## 1. Pace em clima padrão

- **Pergunta:** quanto você teria corrido com o clima "normal"?
- **Fórmula:**
  - Usa a mesma definição de "clima padrão" do motor (`climateTags`): 8 a 18 °C e ponto de orvalho até 14 °C. Se o treino já foi em clima padrão, o item não aparece.
  - Ajuste pela regra "temperatura + ponto de orvalho". Soma-se a temperatura e o orvalho, os dois em °F, e a correção vem da tabela abaixo. O app usa o meio de cada faixa.

    | Soma (°F) | Correção do pace |
    |---|---|
    | até 100 | 0% |
    | 101–110 | 0 a 0,5% |
    | 111–120 | 0,5 a 1% |
    | 121–130 | 1 a 2% |
    | 131–140 | 2 a 3% |
    | 141–150 | 3 a 4,5% |
    | 151–160 | 4,5 a 6% |
    | 161–170 | 6 a 8% |
    | 171–180 | 8 a 10% |
    | acima de 180 | não aparece (calor extremo) |

  - Pace em clima padrão = pace real × (1 − correção).
  - Frio abaixo de 8 °C: sem correção, porque não há fonte publicada confiável. O item não aparece.
- **Fontes publicadas:**
  - Regra de Mark Hadley ("temperature + dew point"), divulgada pela Runner's World e por treinadores americanos. É uma regra prática, não um estudo controlado.
  - Base científica de que calor e umidade pioram o desempenho: Ely, M. R. et al., *Impact of weather on marathon-running performance*, Med Sci Sports Exerc 39(3), 2007.
- **Confiança:** Baixa a Moderada (regra prática). O selo diz isso.
- **Quando não aparece:** treino já em clima padrão; sem clima buscado (sem GPS); frio; calor extremo.
- **Exemplo real, Meia de Floripa (29/08):**
  - Clima: 17,7 °C com orvalho de 17,4 °C, fora do padrão por umidade.
  - Soma: 63,9 + 63,3 = 127 °F, que dá correção de cerca de 1,5%.
  - Pace: 7:38/km real, ≈ **7:31/km em clima padrão**.
- **Verbete do Livro:** "Pace em clima padrão: estimativa do seu pace com 8–18 °C e orvalho até 14 °C, pela regra temperatura + orvalho. É uma correção prática (confiança baixa a moderada), útil para comparar treinos em dias quentes e úmidos."

## 2. Vento por trecho

- **Pergunta:** em que trechos o vento estava contra ou a favor?
- **Fórmula das cores:**
  - **Dados:** vento do Open-Meteo, com velocidade e direção a 10 m de altura, na hora do treino. O módulo novo `wind.mjs` busca do mesmo jeito que o clima.
  - **Conta:** em cada trecho do trajeto, componente = velocidade do vento × cos(ângulo entre o rumo da corrida e o lado para onde o vento sopra).
  - **Cores:**
    - componente ≥ +40% da velocidade do vento: **a favor** (`--ciano`);
    - componente ≤ −40%: **contra** (`--magenta`);
    - entre os dois: **lateral** (`--texto-3`).
  - **Chip:** "Vento X km/h", com uma seta para onde o vento sopra. O Open-Meteo informa de onde ele vem, e a seta gira 180°.
- **Custo em s/km** (a nota "Volta contra: ≈ +X s/km"), **opcional**:
  - Conta: custo relativo ≈ f_ar × ((v + c)² − v²) / v², em que v é a sua velocidade, c o componente contra e f_ar ≈ 4% a 5 m/s.
  - Fontes: Pugh, L. G. C. E., J Physiol 213, 1971 (custo da resistência do ar na corrida); Davies, C. T. M., J Appl Physiol 48, 1980 (vento contra custa mais do que o vento a favor devolve).
  - Confiança **Baixa**: o vento a 10 m não é o vento na rua, por causa de prédios e árvores.
  - **Sugestão: aprovar só as cores e deixar o custo em s/km de fora por enquanto.**
- **Quando não aparece:** sem GPS ou sem clima (o modo Vento e o chip somem); vento abaixo de 5 km/h ("vento fraco").
- **Exemplo real:** a Meia teve vento de 15,8 km/h. O mapa mostraria os trechos contra e a favor. O custo fica de fora, como sugerido.
- **Verbete:** "Vento: componente do vento na direção em que você corria, trecho a trecho (dados do Open-Meteo a 10 m de altura). A favor, lateral ou contra. É indicativo: a rua pode ter mais ou menos vento."

## 3. Início da deriva

- **Pergunta:** a partir de que km o seu corpo começou a pagar mais pelo mesmo ritmo?
- **Fórmula:** usa os splits de 1 km, com o GAP do motor (`gapTimeFromSplits`) e a FC de cada km.
  - **Eficiência do km:** EF_km = velocidade GAP ÷ FC média do km.
  - **Base:** a mediana da EF do km 3 até o fim do primeiro terço. Os km 1 e 2 ficam de fora, porque a FC ainda está subindo.
  - **Início da deriva:** o primeiro km em que a média de 2 km seguidos fica **5% abaixo da base** e a média do resto do treino também fica abaixo. O limiar de 5% é o mesmo do decoupling do app.
  - **Ficam de fora:** o último km incompleto e o sprint final, quando o pace final é mais de 10% mais rápido que a mediana.
- **Para quais treinos:** contínuos com pelo menos 8 km ou 45 min e FC.
  - Entram: Fácil, Regenerativo, Longão, Tempo, Limiar e Prova.
  - Não entram: Intervalado, Teste, Teste do Motor, bike nem esteira sem distância confiável.
- **Fontes publicadas:**
  - Friel, J., *The Triathlete's Training Bible* (Pa:HR / decoupling, limiar de 5%).
  - Maunder, E. et al., *The importance of 'durability' in the physiological profiling of endurance athletes*, Sports Med 51, 2021.
- **Confiança:** Moderada, ou Alta quando a FC vem de cinta peitoral (dado que o app não tem hoje).
- **Quando não aparece:** sem FC; menos de 8 km; tipo intervalado; quando nenhum km cruza o limiar ("sem deriva até o fim", e isso aparece como coisa boa na história do treino).
- **Exemplo real, Meia de Floripa:**
  - Base: mediana dos km 3 a 7 = 13,13 (EF × 1000). Limiar: 12,47.
  - km 14 e 15: 12,41 e 12,43, abaixo do limiar.
  - Resto do treino (km 14 a 20): média de 12,37, também abaixo.
  - Título: **"A deriva começa no km 14"**, com marcador no mapa e faixa no gráfico.
- **Verbete:** "Início da deriva: o km em que a sua eficiência (pace ajustado à inclinação ÷ FC) caiu 5% abaixo do seu começo de treino e não voltou. Mostra até onde a sua base aerobia segura o ritmo."

## 4. Regra das voltas: quais viram "tiros"

- **Pergunta:** quais voltas foram esforço e quais foram recuperação?
- **Regras, nesta ordem:**
  1. **Treino estruturado do relógio**: as voltas têm o campo `intensity`.
     - Tiro: `active`.
     - Fora: `warmup`, `cooldown`, `rest` e `recovery`.
     - Faixa alvo: vem do `workout_step`, se existir.
  2. **Qualquer outra volta** (manual, por tempo **ou por distância**). Decisão do Lucas, 20/11: a regra é automática, pelos dados do treino.
   - As voltas são separadas em 2 grupos pela velocidade. O corte fica no meio do maior salto entre as velocidades ordenadas.
   - As voltas do grupo rápido são tiros quando:
     - há pelo menos 3 delas;
     - o grupo rápido é pelo menos 15% mais rápido que o lento;
     - tiros e recuperações se alternam;
     - cada volta dura menos de 10 min (voltas longas no começo e no fim são aquecimento e desaquecimento).
   - O app escolhe a medida que descreve os tiros:
     - por **distância** ("6 × 800 m"), se as distâncias dos tiros variam menos de 5%, arredondadas a 50 m;
     - por **tempo** ("6 × 90 s"), se os tempos variam menos de 5%;
     - senão, "N tiros".
3. **km automático:** quando todas as voltas têm a mesma distância e não há alternância de rápido e lento, como na Meia, não há tiros. Isso já sai da regra 2.
- **Fonte:** convenção dos próprios relógios (Garmin FIT SDK: `lap_trigger`, `intensity`). Não há estudo: é classificação.
- **Confiança:** Alta para o treino estruturado; Moderada para voltas manuais ou por tempo.
- **Quando não aparece:** menos de 3 tiros, ou voltas sem alternância. Aí entra a regra 5.
- **Exemplo real, 19/11, voltas por tempo:**
  - Aquecimento: 15 min, 1,96 km.
  - **Tiros de 90 s**:

    | Tiro | Pace |
    |---|---|
    | 1 | 5:34/km |
    | 2 | 5:12/km |
    | 3 | 4:48/km |
    | 4 | 4:44/km |
    | 5 | 4:49/km |
    | 6 | 4:40/km |

  - Recuperações de 60 s: entre 7:21 e 7:43/km.
  - Desaquecimento: 12 min.
  - Título: **"Tiros · 6 × 90 s"**. Conclusão: os dois primeiros saíram mais lentos e do 3º ao 6º ficaram regulares, a cerca de 4:45/km.
- **Verbete:** "Tiros: as voltas de esforço do treino. Vêm do treino estruturado do relógio, das voltas que você marcou ou de voltas por tempo que alternam rápido e lento. O km automático não conta."

## 5. Detecção automática de tiros (sem voltas aproveitáveis)

- **Fórmula:**
  - **Suavização:** velocidade média de 15 s.
  - **Limiar:** mediana da velocidade do treino + 15% (no mínimo +0,4 m/s).
  - **Tiro:** trecho acima do limiar com 45 s a 10 min de duração, separado do próximo por pelo menos 30 s abaixo do limiar.
  - **Mínimo:** 3 tiros.
- **Fonte:** não há fórmula publicada única. Garmin e Strava não documentam as suas.
- **Confiança:** **Baixa.** A linha "Origem: detecção automática" e o botão "Trocar origem" deixam você corrigir.
- **Quando não aparece:** treino contínuo (menos de 3 trechos) ou sem velocidade.
- **Exemplo real:** no seu histórico, os treinos de tiros têm voltas, então a detecção automática não seria usada.
- **Verbete:** "Detecção automática: quando o treino não tem voltas, o app procura trechos bem mais rápidos que o seu ritmo do dia. É aproximada; você pode trocar a origem."

## 6. Melhor esforço

- **Pergunta:** qual foi o seu trecho mais rápido de 400 m, 800 m, 1 km, 5 km, 10 km e 21,1 km?
- **Fórmula:**
  - Usa o trajeto completo (1 Hz) e a distância do relógio, a mesma dos números do app.
  - É a janela contínua mais curta, em **tempo decorrido** e com pausas incluídas, que cobre a distância. É como Strava e Garmin fazem.
  - Uma janela que contém pausa de mais de 60 s não vale, porque não foi esforço contínuo.
  - Distância cobrada com interpolação entre os pontos (precisão de até 1 m).
- **Selos:**
  - **"Recorde pessoal":** o melhor entre todos os treinos com trajeto.
  - **"Melhor do ciclo":** o melhor desde o início do ciclo atual.
- **Fonte:** convenção de best efforts (Strava Support, "Best Efforts"). É uma definição, não uma fórmula.
- **Confiança:** Alta com GPS bom. Moderada com gravação inteligente, como na Meia, que tem cerca de 1 ponto a cada 8 s.
- **Quando não aparece:**
  - treinos sem trajeto (o app avisa e oferece "Buscar trajeto dos treinos antigos");
  - distâncias maiores que o treino;
  - esteira.
- **Exemplo real, Meia de Floripa:**

  | Distância | Melhor esforço |
  |---|---|
  | 400 m | 2:19 |
  | 800 m | 5:01 |
  | 1 km | 6:20 |
  | 5 km | 37:36 |
  | 10 km | 1:16:02 |
  | 21,1 km | 2:42:24 |

  O de 400 m saiu do sprint final.
- **Verbete:** "Melhor esforço: o trecho contínuo mais rápido de cada distância dentro de um treino, pelo tempo do relógio. Só treinos com trajeto entram."

## 7. Custo da subida (título e curva pessoal)

- **Pergunta:** quanto as subidas e descidas mudaram o seu ritmo?
- **Fórmula:**
  - **Faixas:** as 5 do motor (`gradeBandIdx`: até −5%, −5 a −2%, ±2%, 2 a 5% e acima de 5%), com a inclinação suavizada do próprio motor.
  - **Por faixa:** tempo, pace real, GAP e FC, agregando as amostras do motor. A soma dos tempos é o tempo total.
  - **Custo da faixa** = pace real − GAP da faixa, em s/km.
- **Regra do título:**
  - Vale a faixa de subida (2 a 5% ou acima de 5%) com **pelo menos 3 min** e o maior custo. O mínimo de 3 min é o mesmo do `gradeProfile` do motor.
  - Exemplo de título: "Subidas acima de 5% custaram +X s/km".
  - Sem faixa com 3 min: "Treino plano: a inclinação quase não pesou".
- **Curva pessoal** (Progresso): no período de análise escolhido, a mediana do custo de cada faixa entre os treinos com pelo menos 3 min nela. Precisa de pelo menos 3 treinos por faixa.
- **Fonte:** o GAP do motor (Minetti, A. E. et al., *Energy cost of walking and running at extreme uphill and downhill slopes*, J Appl Physiol 93, 2002, base dos modelos de GAP). O resto é agregação.
- **Confiança:** igual à do GAP do treino (Alta com altitude do relógio).
- **Quando não aparece:** sem altitude ou sem trajeto; esteira.
- **Exemplo real, Meia de Floripa:**

  | Faixa | Tempo |
  |---|---|
  | abaixo de −5% | 2,6 min |
  | −5 a −2% | 13,8 min |
  | ±2% | 130,3 min |
  | 2 a 5% | 13,9 min |
  | acima de 5% | 2,0 min |

  A faixa acima de 5% tem menos de 3 min. O título usaria a faixa de 2 a 5% (13,9 min). O custo em s/km sai na Etapa 5, com as amostras do motor.
- **Verbete:** "Custo da subida: a diferença entre o seu pace real e o pace ajustado à inclinação (GAP) em cada faixa de inclinação. Mostra quanto as subidas pesaram no seu ritmo."

## 8. História do treino (3 frases, sem IA)

Sempre 3 linhas, nesta ordem, e cada uma usa a primeira regra da sua lista que valer.

**O que foi bem** (check em `--ok`):
1. Recorde pessoal ou melhor do ciclo neste treino: "Recorde pessoal nos 5 km: 37:36."
2. Deriva abaixo de 5%: "Deriva de X%: base sólida até o fim."
3. Tiros regulares, com variação abaixo de 3% entre os tiros: "Tiros regulares: variação de X%."
4. Fechou mais rápido, com o pacing do motor dando negative split: "Fechou mais rápido que abriu."
5. EF acima da sua mediana de 30 dias: "Economia X% melhor que o seu normal."
6. Se nada valer: "Treino cumprido: X km em Y."

**O que observar** (alerta em `--atencao`):
1. Dor articular registrada: "Você marcou dor: observe antes do próximo treino."
2. Deriva acima de 8%: "Deriva de X%: o ritmo cedeu no fim." Se o item 3 foi aprovado, acrescenta "a partir do km N".
3. RPE de 7 ou mais em treino Fácil ou Regenerativo: "RPE X num treino fácil: o corpo pediu mais que o planejado."
4. Clima fora do padrão: "Calor e umidade (X °C, orvalho Y °C) pesaram no ritmo."
5. Se nada valer: "Nada fora do normal neste treino."

**Amanhã** (seta em `--ciano`), a partir da prontidão e da forma que já existem:
1. Prontidão "Recuperar" ou TSB abaixo de −20: "Amanhã: descanso ou rodagem bem leve."
2. Próximo treino do plano da semana, se existir: "Amanhã: {tipo do plano}."
3. Se não houver plano: "Amanhã: rodagem leve, em Z2."

- **Fonte:** as próprias regras e limiares que o app já usa (deriva 5 e 8%, prontidão, TSB, zonas).
- **Confiança:** a de cada número citado.
- **Exemplo real, 19/11:**
  - "Tiros do 3º ao 6º regulares, a cerca de 4:45/km."
  - "Deriva de 8,4%: o ritmo cedeu no fim."
  - "Amanhã: descanso ou rodagem bem leve" (prontidão 47, Recuperar).

---

## Decisão do Lucas (20/11)

- **Todos os 8 itens foram aprovados**, inclusive o custo do vento em s/km. Ele aparece com o selo de confiança Baixa.
- **Item 4:** tiros também por distância, escolhidos automaticamente pelos dados do treino (regra 2 acima).
