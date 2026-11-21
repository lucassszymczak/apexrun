# Fase 4 · Etapa 1 — Os 7 cálculos para aprovar

Cada item diz o que responde, como calcula, um exemplo e a minha recomendação. As contas usam as funções que o app já tem: `gradeCostMult`, `riegel` e `bestAnchor` do motor, e `correcaoHadley` da Fase 2. Nada é copiado. Os números das telas de design não entram em lugar nenhum.

Exemplos com os seus dados reais:
- **Meia de Floripa:** 21,21 km em 2:42:03, com 17,7 °C e orvalho de 17,4 °C.
- **Percurso de exemplo:** maratona plana com uma subida de +3% do km 25 ao 28 e uma descida de −2% do km 33 ao 35. Ele é inventado só para mostrar a conta.

## Dois achados antes dos itens

1. **A âncora do "tempo realista" hoje é o treino de tiros de 19/11, não a Meia.**
   - A regra do motor é usar o treino mais recente marcado como "Prova" ou "Teste". Sem nenhum marcado, ele usa o treino mais recente, qualquer que seja.
   - A sua Meia está salva como "Fácil". Por isso o card atual projeta a partir dos 6,09 km de 19/11, com as recuperações dentro: 5h26:50 para a maratona.
   - A partir da Meia, a projeção é **5h35:58**.
   - **Recomendação:** você marca a Meia como "Prova" (Editar treino › Tipo). A regra do motor não muda, só o dado. Se você marcar, o card atual muda para a Meia também.
2. **O seu ciclo atual é a São Silvestre (15 km, 31/12), não uma maratona.** Todos os cálculos abaixo funcionam para qualquer distância do ciclo. Os exemplos usam a maratona porque é o objetivo do roteiro.

---

## 1. Pace alvo por km (esforço constante)

- **O que responde:** em que pace correr cada km para fechar no tempo-alvo, gastando o mesmo esforço na subida e no plano.
- **Como calcula:**
  - O pace de cada km é P × `gradeCostMult(inclinação do km)`. É a mesma regra do GAP do app: na subida, cada 1% pesa 3,5%; na descida, cada 1% alivia 1,5%.
  - P é o pace no plano. O app escolhe P para que a soma de todos os km dê exatamente o tempo-alvo.
  - **Inclinação do km:** a altitude é lida a cada 100 m e suavizada com a média de 5 pontos (500 m), para tirar os saltos do GPS. A inclinação do km é a diferença de altitude entre o começo e o fim do km, dividida por 1.000 m.
- **Exemplo** (meta = 5h35:58, a projeção a partir da Meia):

  | Trecho | Pace |
  |---|---|
  | Plano | 7:54/km |
  | Km 26, subida de +3% | 8:44/km |
  | Km 34, descida de −2% | 7:40/km |
  | Soma dos 42,195 km | 5h35:58, exato |

- **Fonte:** o modelo de GAP do motor (base: Minetti et al., J Appl Physiol 93, 2002).
- **Confiança:** a do percurso. Alta com GPX oficial, Baixa com percurso digitado.
- **Quando não aparece:** sem percurso, o plano é o mesmo pace do início ao fim.
- **Recomendação:** aprovar.

## 2. Segunda metade mais rápida

- **O que responde:** se você escolher a estratégia "negativa", quanto mais devagar começar e quanto mais rápido terminar, fechando no mesmo tempo.
- **Como calcula:**
  - Cada km da 1ª metade fica 1% mais lento que o plano constante, e cada km da 2ª fica 1% mais rápido.
  - Depois, o app ajusta tudo junto para que a soma volte a ser exatamente o tempo-alvo.
- **Exemplo** (maratona plana, meta de 5h35:58):

  | | Metade | Pace |
  |---|---|---|
  | Constante | 2h47:59 cada | 7:58/km |
  | 1ª metade, negativa | 2h49:40 | 8:03/km |
  | 2ª metade, negativa | 2h46:18 | 7:53/km |

  As duas metades ficam cerca de 3:20 separadas.
- **Fontes:**
  - estudos com os recordes mundiais da maratona mostram que as melhores provas foram corridas com a 2ª metade igual ou mais rápida (Díaz, Fernández-Ozcorta e Santos-Concejero, Eur J Sport Sci, 2018);
  - corredores amadores tendem a perder ritmo no fim (March et al., J Strength Cond Res, 2011).
  - **Cito as duas de memória; confiro o resumo publicado antes de programar.**
- **Confiança:** Moderada. A ideia é bem aceita; o valor de 1% é uma escolha prudente, não um número exato de estudo.
- **Recomendação:** aprovar com ±1%. Se preferir mais conservador, ajustar para ±0,5%.

## 3. Clima no plano e no simulador

- **O que responde:** quanto o calor e a umidade do dia da prova pesam no pace.
- **Como calcula:**
  - Usa a mesma regra temperatura + orvalho da Fase 2 (`correcaoHadley`). Em clima padrão (8 a 18 °C e orvalho até 14 °C), a correção é 0.
  - Faltando 16 dias ou menos, o app busca a previsão hora a hora a partir do horário da largada. Cada km recebe a correção da hora em que você estará nele. Numa maratona de 5h30, isso importa, porque o fim da prova é mais quente que o começo.
  - Faltando mais de 16 dias, fica o clima padrão, sem ajuste, com o aviso "a previsão abre em dd/mm".
  - Se a previsão falhar, também fica o clima padrão, com o aviso.
- **Exemplo:**

  | Clima | Soma | Correção | Efeito numa meta de 5h35:58 |
  |---|---|---|---|
  | 22 °C, orvalho 18 °C | 136 °F | 2,5% | equivale a 5h44:22 |
  | Meia (real): 17,7 °C, orvalho 17,4 °C | 127 °F | 1,5% | — |

- **Fonte e confiança:** as já aprovadas na Fase 2 (regra de Hadley; Ely et al., 2007). Confiança Baixa a Moderada.
- **Recomendação:** aprovar, com a correção por hora.

## 4. Tempo realista

- **O que responde:** que tempo é honesto esperar hoje, numa faixa, e não num número só.
- **Como calcula:**
  1. **Riegel pela âncora**, a mesma do card atual (`bestAnchor` e `riegel`, expoente 1,06).
  2. **Mais o percurso:** o custo extra das subidas do item 1, comparado com o plano.
  3. **Mais o clima:** o item 3.
  4. **Correção para a maratona, só em provas de 30 km ou mais:**
     - Riegel costuma ser otimista na maratona para amadores, porque o fim da prova cansa mais do que a conta prevê;
     - a ponta lenta da faixa usa o expoente 1,15 no lugar de 1,06;
     - fonte: Vickers e Vertosick, *An empirical study of race times in recreational endurance runners*, BMC Sports Sci Med Rehabil 8, 2016, que mostram que Riegel subestima a maratona de corredores amadores. Cito de memória; confiro o valor exato do expoente antes de programar.
- **A faixa:** a ponta rápida é a soma dos passos 1 a 3. A ponta lenta é a mesma soma com a correção do passo 4.
- **Exemplo** (âncora na Meia):

  | Ponta | Conta | Tempo | Pace |
  |---|---|---|---|
  | Rápida | Riegel 1,06 | 5h35:58 | 7:58/km |
  | Lenta | Riegel 1,15 | 5h57:25 | 8:28/km |

  A faixa fica "de 5h36 a 5h57", mais o percurso e o clima do dia.
- **Abaixo de 30 km** (a São Silvestre, por exemplo): sem a correção do passo 4. A faixa vira ±2,5% em volta do Riegel. Esse número é uma convenção para mostrar que é estimativa, sem fonte publicada: decida você.
- **Um dado curioso seu:** em 2018 você correu 18 km em 1:49:27 e 42,3 km em 4:19:27. Isso equivale a um expoente de cerca de 1,01, melhor que o padrão, mas foi há 8 anos.
- **Confiança:** Moderada com âncora de prova ou teste; Baixa com âncora de treino comum.
- **Rodapé obrigatório:** "Estimativa, não garantia. O simulador não prevê ganho de treino."
- **Recomendação:** aprovar a faixa com a correção da maratona. Abaixo de 30 km, aprovar ou ajustar o ±2,5%.

## 5. "Terminar bem"

- **O que responde:** que pace seguir quando o objetivo é só completar bem, sem tempo-alvo.
- **Como calcula:** o plano usa a ponta mais lenta da faixa do item 4 como meta, e o resto segue os itens 1 a 3.
- **Exemplo:** pela Meia, a meta do plano seria cerca de 5h57, com 8:28/km no plano.
- **Recomendação:** aprovar.

## 6. Melhor horário para correr amanhã

- **O que responde:** dentro da sua janela de treino (padrão: 5h às 10h), em que hora cheia o clima pesa menos.
- **Como calcula:**
  - Para cada hora, o custo é a `correcaoHadley`. Em clima padrão, o custo é 0.
  - Descarta a hora com chance de chuva de **50% ou mais**. É uma convenção: não há estudo com um número para isso.
  - Marca "vento forte" a partir de **20 km/h**, o mesmo limite que o app já usa nas etiquetas de clima. Isso não descarta a hora, só avisa.
  - Empate: vence a hora mais cedo.
- **Exemplo inventado** (ainda não há previsão sua):

  | Hora | Clima | Custo |
  |---|---|---|
  | 5h | 17 °C, orvalho 14 °C | 0% (padrão) |
  | 6h | 18 °C, orvalho 15 °C | 1,5% |
  | 7h | 20 °C, orvalho 16 °C | 1,5% |
  | 8h | 23 °C, orvalho 17 °C | 2,5% |
  | 9h | 25 °C, orvalho 18 °C | 3,75% |

  Resultado: "Melhor horário amanhã: 5h". Se às 5h a chuva fosse de 60%, a hora seria descartada e venceria 6h, por ser a mais cedo do empate com 7h.
- **Confiança:** a da previsão, Moderada.
- **Quando não aparece:** sem internet, sem local ou fora do horário do meio-dia à meia-noite.
- **Recomendação:** aprovar com 50% de chuva e 20 km/h de vento.

## 7. Percurso

- **Junção das partes:**
  - até 4 arquivos, ordenados pelo horário de início, e você pode reordenar;
  - a distância total é a soma das partes;
  - o trecho entre o fim de uma parte e o começo da outra é ligado em linha reta e avisado se passar de 200 m.
- **Suavização da altitude:** reamostragem a cada 100 m e média de 5 pontos (500 m), a mesma do item 1.
- **Distância oficial:**
  - diferença de até 2%: o percurso é esticado ou encolhido por igual até a distância oficial, com aviso (já aprovado);
  - acima de 2%: o app pergunta "Ajustar mesmo assim" ou "Trocar arquivo".
- **Confiança da fonte:**

  | Fonte | Confiança |
  |---|---|
  | GPX oficial da prova | Alta |
  | Gravação com altímetro barométrico (o .FIT diz se a altitude veio do barômetro) | Moderada |
  | Gravação só com GPS | Baixa |
  | Digitada | Baixa, sempre, com a fonte obrigatória |

- **"Subida":** um km com inclinação suavizada de **2% ou mais**. É a mesma faixa "2 a 5%" que o app já usa no custo da subida. Esse km aparece com o pace em `--atencao` no plano.
- **"Trecho mais duro"** (o título do percurso):
  - é a sequência de km seguidos em subida com mais metros de subida somados;
  - empate: vence o que fica mais perto do fim, porque pesa mais;
  - sem nenhum km em subida, o título vira "Percurso plano: sem trecho de subida".
- **Exemplo** (percurso de exemplo): "Trecho mais duro: do km 25 ao 28, +120 m".
- **Recomendação:** aprovar.

---

## Para responder

Responda cada linha com **aprova**, **ajusta** (e o quê) ou **fora**.

1. Pace alvo por km (esforço constante, média de 500 m na altitude):
2. Segunda metade mais rápida (±1%):
3. Clima no plano (correção hora a hora; sem previsão, clima padrão):
4. Tempo realista (faixa de Riegel 1,06 a 1,15 na maratona; ±2,5% abaixo de 30 km):
5. "Terminar bem" (ponta lenta da faixa):
6. Melhor horário (chuva ≥ 50% descarta; vento ≥ 20 km/h avisa; empate pela hora mais cedo):
7. Percurso (junção, 500 m, 2%, confiança, subida ≥ 2%, trecho mais duro):

E uma pergunta fora da lista:
- Marco a Meia como "Prova" para ela virar a âncora? Você mesmo pode fazer em Editar treino.

---

## Decisão do Lucas (21/11)

- **Os 7 itens foram aprovados como propostos.**
- **A Meia continua como "Fácil"** (item 8: não). A âncora do tempo realista segue a regra do motor, sem mudança: o treino mais recente marcado como "Prova" ou "Teste", e, sem nenhum, o treino mais recente. Hoje é o treino de 19/11.
  - Por isso, enquanto não houver prova ou teste marcado, o simulador mostra a confiança **Baixa** (âncora de treino comum) e diz qual treino é a âncora, com a data.
- **Pendência antes de programar os itens 2 e 4:** conferir nos resumos publicados as fontes citadas de memória: Díaz et al., 2018; March et al., 2011; e Vickers e Vertosick, 2016, com o expoente da maratona. Se algo não bater, volto ao Lucas antes de programar.

## Conferência das fontes e decisão do Lucas (21/11, antes da Etapa 3)

Li os resumos no PubMed e o texto completo de Vickers e Vertosick no PMC.
- **Item 2:**
  - Díaz et al. 2018 (Eur J Sport Sci 18(6):781-786, PMID 29557279) mostra que, na média, os recordes mundiais da maratona tiveram a 1ª metade um pouco mais rápida. Os autores sugerem que o futuro é um ritmo quase sem variação. Isso corrige o que eu tinha escrito de memória.
  - O estudo dos recordes de 1998 a 2018 (Díaz et al. 2019, Eur J Sport Sci 19(10):1297-1302, PMID 30922191) mostra que os homens correram com a 2ª metade mais rápida, com variação média de 1,5% entre trechos de 5 km.
  - March et al. 2011 (J Strength Cond Res 25(2):386-391, PMID 20224445) confirma que os corredores mais lentos e os mais jovens perdem mais ritmo no fim.
  - Nenhum estudo dá o valor de 1%.
  - **Decisão: manter ±1%**, como aprovado.
- **Item 4:**
  - Vickers e Vertosick 2016 (BMC Sports Sci Med Rehabil 8:26, PMID 27570626, PMC5000509; 2.303 corredores amadores) mostra que o Riegel acerta até a meia, mas erra para menos na maratona. Na tabela 4 do estudo, metade dos corredores terminou 10 min ou mais acima do Riegel, e um quarto, 20 min ou mais.
  - O estudo não traz o expoente 1,15 que eu tinha citado.
  - **Decisão: na maratona (30 km ou mais), a faixa vai do Riegel ao Riegel + 20 min.** Três em cada quatro corredores do estudo terminaram dentro dela. Abaixo de 30 km, a faixa continua ±2,5%, e o estudo confirma que o Riegel acerta bem até a meia.
