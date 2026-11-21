# Fase 5 · Etapa 1 — As 6 regras para aprovar

Cada item diz o que responde, como funciona, quando não aparece, um exemplo com os seus treinos e o verbete do Livro.
- **Dados dos exemplos:** os 139 treinos do servidor e os trajetos leves, em 21/11. Ficam só neste ambiente, em `fixtures/privado/`.
- **Fórmulas do app:** as que já existem são importadas, nunca copiadas: a prontidão do motor, os selos de esforço (Fase 2), a consistência e os segmentos (Fase 3) e o plano de prova (Fase 4).
- **Decisões que você já tomou (Etapa 0):**
  - o tênis entra com nome, km atuais e km limite digitados por você;
  - a bike fica sem aviso.

---

## 1. Leitura da frase ("Diga como foi")

- **O que responde:** o que dá para preencher a partir do que você ditou.
- **Quando lê:** só quando você toca em "Preencher pela frase". Nada é salvo: os campos preenchidos ficam com contorno e "· pela fala", e você confere antes de "Salvar treino".
- **Antes de ler:**
  - minúsculas, sem acento e sem pontuação;
  - a vírgula entre dois algarismos ("7,5") vira decimal.
- **Números:**
  - algarismos (7, 7,5, 7.5) ou por extenso de zero a dez (um/uma, dois/duas, três… dez);
  - "e meia" soma 0,5;
  - "7h30", "7:30" e "7 horas e 30" viram 7,5 h. Outros minutos viram a fração (7h20 = 7,3 h, com uma casa).
- **RPE:**
  - palavras-chave: "rpe", "rp", "erre pe e", "esforco" ou "esforco percebido", seguidas do número;
  - vale de 0 a 10, inteiro. Fora disso, fica em branco e avisa.
- **Sono:**
  - palavras-chave: "dormi", "sono", "dormido", com o número logo depois;
  - vale de 0 a 14 h. Sem número ("dormi mal"), fica em branco e avisa.
- **Regiões (19, as da tela):**

  | Região | Palavras aceitas | Lado |
  |---|---|---|
  | Quadril | quadril | sim |
  | Coxa (frente) | coxa, quadriceps, frente da coxa | sim |
  | Joelho | joelho | sim |
  | Canela | canela, tibia | sim |
  | Tornozelo e pé | tornozelo, pe, calcanhar, sola, planta do pe | sim |
  | Lombar | lombar, costas, coluna | não |
  | Glúteo | gluteo, bumbum | sim |
  | Posterior da coxa | posterior, posterior da coxa, isquiotibiais | sim |
  | Panturrilha | panturrilha, batata da perna | sim |
  | Tendão de Aquiles | aquiles, tendao de aquiles, tendao | sim |

- **Lado:**
  - "esquerda/esquerdo/esq" ou "direita/direito/dir", antes ou depois da região;
  - "nas duas", "as duas", "ambas", "dos dois lados" ou "nos dois" marcam os dois lados com a mesma intensidade;
  - **sem lado:** o app **não chuta**. A região fica pendente, com os botões "Esquerda" e "Direita" para você tocar.
- **Intensidade:**
  - o número logo depois da região, ou "dor N" antes dela, de 0 a 10;
  - sem número, a região fica pendente ("Canela esquerda: qual a dor de 0 a 10?").
- **Mais de uma região:** separadas por vírgula, "e" ou ponto ("canela esquerda 3 e panturrilha direita 2").
- **Equipamento:** o nome de um tênis ou bike ativo citado na frase (sem diferença de maiúsculas e acentos) escolhe aquele equipamento. Sem citação, vale a escolha padrão (item 5).
- **O que é ignorado:** todo o resto (sensação, clima, "foi bom"…).
  - "Dor articular", "lesão" ou "machuquei" **nunca ligam** o interruptor "Dor articular ou suspeita de lesão". A frase só mostra o aviso "Se for dor articular, ligue o interruptor abaixo".
  - A dor muscular geral segue o item 2.
- **"Entendi: …":** lista em palavras o que foi preenchido, por exemplo "Entendi: RPE 7, sono 7,5 h, canela esquerda 3."
  - O que faltou aparece numa linha à parte, como "Falta o lado da panturrilha".
  - Se nada foi entendido: "Não entendi nenhum campo; preencha abaixo."
- **As frases de teste** (viram o teste automático):

  | # | Frase ditada | Resultado esperado |
  |---|---|---|
  | 1 | RPE 7, dormi 7 e meia, canela esquerda 3 | RPE 7 · sono 7,5 · canela E 3 |
  | 2 | rpe sete dormi sete e meia canela esquerda três | igual à 1 |
  | 3 | Esforço 6. Dormi 8 horas. | RPE 6 · sono 8 |
  | 4 | dormi 6h30 | sono 6,5 |
  | 5 | Dormi 7:30, RPE 5 | sono 7,5 · RPE 5 |
  | 6 | dormi 7 horas e 20 | sono 7,3 |
  | 7 | panturrilha direita 2 e canela esquerda 4 | panturrilha D 2 · canela E 4 |
  | 8 | dor 3 no joelho direito | joelho D 3 |
  | 9 | canela 3 | canela pendente (falta o lado) |
  | 10 | joelho esquerdo | joelho E pendente (falta a intensidade) |
  | 11 | lombar 4 | lombar 4 (sem lado) |
  | 12 | panturrilhas nas duas 2 | panturrilha D 2 · panturrilha E 2 |
  | 13 | dor nos dois joelhos 3 | joelho D 3 · joelho E 3 |
  | 14 | tornozelo direito 1, sola do pé esquerdo 2 | pé D 1 · pé E 2 |
  | 15 | tendão de aquiles esquerdo 5 | aquiles E 5 |
  | 16 | bumbum direito 2 | glúteo D 2 |
  | 17 | RPE 12 | nada (RPE fora de 0 a 10, com aviso) |
  | 18 | dormi mal | nada (sono sem número, com aviso) |
  | 19 | foi um treino bom, calor forte | nada ("Não entendi nenhum campo") |
  | 20 | dor articular no joelho direito | joelho D pendente; o interruptor **não** liga; aviso de dor articular |
  | 21 | RP 8 dormi 6 | RPE 8 · sono 6 |
  | 22 | rpe 7, com o <nome do seu tênis> | RPE 7 · tênis escolhido |
  | 23 | erre pê é 4 | RPE 4 |
  | 24 | dormi 7,5 horas, canela direita 0 | sono 7,5 · canela D 0 (marcada com 0) |

- **Precisão:** depende do que o ditado escrever. No seu teste da Etapa 3, ajusto as palavras com o texto real do seu iPhone (mudança só de vocabulário, sem mudar a regra).
- **Verbete do Livro:** "Diga como foi: o app lê a frase que você ditou e preenche RPE, sono, regiões de dor e o tênis. Nada é salvo sem você conferir. O que ele não entende fica em branco."
- **Recomendação:** aprovar.

## 2. Dor muscular × mapa do corpo

- **O que responde:** se a "Dor muscular (0–10)" deve vir preenchida a partir do mapa do corpo.
- **Por que importa:** a dor muscular entra na prontidão do motor: cada ponto tira 2,5 pontos. Hoje, só 12 dos seus 139 treinos têm esse campo.
- **Proposta (a):** quando você marca regiões no mapa e o campo está vazio, ele vem preenchido com a **maior intensidade marcada**, com "· do mapa do corpo" e editável.
  - Se você já tiver digitado um valor, o mapa não muda o campo.
- **Alternativa (b):** não preencher. O mapa vira só registro, e a dor muscular continua manual.
- **Efeito na prontidão, com 3 corridas reais** (a fórmula do motor não muda; o efeito vem do campo preenchido):

  | Treino | Hoje (dor registrada) | Se o mapa tivesse 3 | Se o mapa tivesse 6 |
  |---|---|---|---|
  | 19/11 · intervalado (sono 6 h, dor 0) | 66 · Cautela | 58 · Recuperar | 51 · Recuperar |
  | 17/11 · fácil (sono 7 h, dor 0) | 67 · Cautela | 60 · Cautela | 52 · Recuperar |
  | 14/11 · longão (sono 8 h, sem dor) | 74 · Moderada | 66 · Cautela | 59 · Recuperar |

  Uma canela em 3 derruba a prontidão em cerca de 8 pontos e pode mudar a faixa.
- **Treinos antigos:** nada muda. O campo só é preenchido no Completar ou ao editar, e a prontidão dos treinos salvos fica igual (o teste de referência garante isso).
- **Verbete do Livro (se aprovar a):** "Dor muscular e mapa do corpo: ao marcar regiões, a dor muscular vem preenchida com a maior intensidade marcada. Você pode mudar. Ela entra na prontidão como sempre (2,5 pontos por ponto de dor)."
- **Recomendação:** **(a)**. O mapa só vira um número que você já usaria, e você confere antes de salvar. Se preferir que o mapa não mexa na prontidão, escolha (b).

## 3. "O que mudou" no resumo pós-treino

- **O que responde:** o que este treino mudou nos seus números.
- **Itens, nesta ordem** (só os que mudaram):
  1. **Recorde pessoal ou melhor do ciclo:** os selos de esforço da Fase 2 deste treino.
     - Uma linha só, com a maior distância e as outras contadas: "Recorde pessoal nos 10 km" ou "Melhor do ciclo em 4 distâncias: 400 m, 800 m, 1 km e 5 km".
  2. **Segmento no top 3:** nas passagens até a data do treino, com pelo menos 3 passagens no segmento.
     - "Seu melhor no <segmento>" (selo violeta) ou "2º de 5 no <segmento>".
     - No máximo 2 linhas, os melhores lugares primeiro.
  3. **Semana consistente:** quando este treino fez a semana passar de 80% da meta e já houve pelo menos 1 dia de descanso.
     - "Semana consistente: Xh de Yh de meta", e, se a semana anterior também foi consistente, "· N seguidas se fechar assim".
  4. **Forma:** quando o estado da forma (TSB) do motor muda de faixa com este treino, **só ao entrar ou sair de "muito carregado" ou de "fresco"**.
     - A troca entre "em treino pesado" e "equilibrado" fica de fora: perto de −10 ela vai e volta a cada treino. Nos seus últimos 6 treinos, aconteceu 3 vezes.
  5. **Equipamento:** quando o treino tem tênis ou bike, a linha "<nome>: N de M km" (ou só "N km" sem limite).
     - Ao cruzar 90% ou o limite, a linha ganha o tom `--atencao`.
- **Sem nenhum item:** uma linha, "Nada mudou nos seus números com este treino."
- **Exemplos reais:**
  - **19/11 · intervalado:** melhor do ciclo em 4 distâncias (400 m, 800 m, 1 km e 5 km).
  - **14/11 · longão:** recorde pessoal nos 10 km; 3º de 5 e 2º de 3 em dois segmentos; a semana passou de 80% da meta.
  - **17/11 · fácil:** com a regra da forma proposta, nada mudou. Pela regra simples, seria "em treino pesado → equilibrado".
- **Verbete do Livro:** "O que mudou: recorde ou melhor do ciclo, lugar no top 3 de um segmento, semana que ficou consistente, forma que entrou ou saiu dos extremos e o tênis. Só aparece o que mudou com este treino."
- **Recomendação:** aprovar.

## 4. Título do resumo

- **O que responde:** a conclusão em uma frase, no topo do resumo.
- **Regra:** o primeiro item que existir, nesta ordem:
  1. recorde pessoal: "<Tipo> com recorde pessoal nos 10 km";
  2. seu melhor num segmento: "<Tipo> com o seu melhor no <segmento>";
  3. melhor do ciclo: "<Tipo> com o melhor do ciclo nos 5 km";
  4. semana consistente: "<Tipo> que fechou a semana consistente" (com "· N seguidas" quando houver sequência);
  5. forma: "<Tipo> que te deixou fresco para testar" ou "<Tipo> que te deixou muito carregado";
  6. sem item: a primeira frase da história do treino (a do check), que já existe;
  7. sem história: "<Tipo> de X km registrado".
- **<Tipo>:** o nome do tipo do treino no app (Rodagem, Longão, Intervalado…).
- **Exemplos reais:**
  - 19/11: "Intervalado com o melhor do ciclo nos 5 km";
  - 14/11: "Longão com recorde pessoal nos 10 km";
  - 17/11: a frase da história (o check).
- **Recomendação:** aprovar.

## 5. Equipamentos

- **Tênis** (decisão da Etapa 0):
  - **cadastro:** nome, **km atuais** e **km limite** (padrão 600, editável);
  - **km do tênis** = km atuais + a soma da distância das corridas salvas com esse tênis depois do cadastro. Esteira conta (o tênis gasta igual);
  - **escolha no Completar:** com um tênis ativo, ele já vem escolhido. Com mais de um, vem o último usado; o novo par passa a vir escolhido. Você sempre pode trocar ou deixar "sem tênis";
  - **avisos:**
    - a partir de 90% do limite, a barra fica em `--atencao` e aparece uma linha discreta no Completar ("Tênis com N de M km");
    - no limite ou acima, aparece o card no Hoje ("<nome> passou dos M km · Ver equipamentos"). O card some ao aposentar o par ou ao aumentar o limite;
  - **"Aposentar":** o par sai da escolha e vai para "Aposentados", com os km finais. **"Novo par":** cadastro novo.
- **Bike** (decisão da Etapa 0: sem aviso):
  - pneus e corrente com os km desde a última troca = a soma da distância dos pedais salvos com a bike depois da data da troca;
  - "Troquei" guarda a data e zera a contagem; as trocas anteriores ficam no histórico;
  - sem limite, sem aviso nem barra de cor: só "N km desde a troca".
- **Treinos sem distância** (bike indoor, esteira sem km): somam 0. **Treinos antigos sem equipamento:** não contam.
- **Excluir ou editar um treino** corrige os km na hora, porque nada é guardado à parte.
- **Exemplo inventado:** você cadastra um tênis com 412 km atuais e limite 600. Depois, salva 5 corridas de 6 km com ele: 442 km (74%). Aos 540 km (90%), a barra fica âmbar; aos 600, aparece o card no Hoje.
- **Verbete do Livro:** "Km do equipamento: os km atuais que você informou mais a distância das corridas com o tênis (ou dos pedais desde a troca, na bike). Aviso a partir de 90% do limite; no limite, card no Hoje."
- **Recomendação:** aprovar.

## 6. Retrospectiva do ciclo

- **O que responde:** como foi o ciclo, do início ao fim.
- **Ciclo:** de "início do ciclo" à data da prova, no ciclo de prova. A versão "até agora" usa hoje como fim.
- **Blocos, nesta ordem** (cada um com o rótulo e o título-conclusão):
  1. **Capa:** nome do ciclo, datas e semanas.
     - Título: com a prova feita, "Você terminou a <prova> em X" (e "Y abaixo/acima do plano", se houver tempo-alvo); sem a prova, "N semanas até agora".
  2. **Volume:** km de corrida e horas de treino (corrida + pedal), com barras de km por semana desde o zero e o pico destacado.
     - Título: "N km em X h, com pico de M km na semana S".
  3. **Consistência:** semanas consistentes do ciclo e a maior sequência (regra da Fase 3).
  4. **Recordes e longão:** recordes pessoais feitos no ciclo (selos da Fase 2) e o longão mais longo.
  5. **A prova:** só com a prova feita (o treino do tipo Prova na data da prova, com 1 dia de folga).
     - Com o plano da Fase 4 (tempo-alvo): plano × real na meia, no km 30 e na chegada. O real sai do trajeto da prova na mesma distância.
     - Sem plano, só o tempo final.
  6. **Segmentos:** os 2 segmentos que mais melhoraram no ciclo (tendência da Fase 3 com as passagens do ciclo), só os "mais rápido".
  7. **Tênis:** km de cada tênis nas corridas do ciclo.
- **Quando falta dado:** o bloco não aparece. Ciclo sem prova, sem segmentos que melhoraram ou sem tênis cadastrado mostra só o que tem.
- **Quando aparece:**
  - card no Hoje no dia seguinte à prova e nos 14 dias seguintes, com "Ver retrospectiva";
  - a versão "até agora" no Ciclo de prova, a qualquer momento.
- **Stories:** um card por bloco que existir, na ordem acima, no máximo 6. Se os 7 blocos existirem, segmentos e tênis dividem o último card.
  - Cada card tem um número grande, o título e a marca no pé. Nenhum mapa.
- **Exemplo com o seu ciclo atual ("até agora", São Silvestre, de 19/10 a 31/12):**
  - 12 corridas, 86 km;
  - 4 das 5 semanas consistentes;
  - 1 recorde pessoal (10 km, em 14/11);
  - longão mais longo de 11 km (14/11);
  - a prova ainda não aconteceu; tênis ainda não cadastrado.

  Ficariam só a capa, o volume, a consistência e os recordes e longão.
- **Verbete do Livro:** "Retrospectiva: volume, consistência, recordes, a prova (plano × real), segmentos que mais melhoraram e o tênis do ciclo. Blocos sem dado não aparecem."
- **Recomendação:** aprovar.

---

Responda cada linha com **aprova**, **ajusta** (e o quê) ou **fora**.

1. Leitura da frase (vocabulário, região sem lado fica pendente, as 24 frases de teste):
2. Dor muscular × mapa: (a) preencher com a maior região, editável · (b) não preencher:
3. "O que mudou" (recorde, top 3 de segmento, semana consistente, forma só nos extremos, equipamento):
4. Título do resumo (ordem de prioridade):
5. Equipamentos (km atuais + corridas; 90% e limite; bike sem aviso):
6. Retrospectiva (7 blocos, sem dado não aparece, até 6 Stories):

---

## Decisão do Lucas (21/11)

- **As 6 regras foram aprovadas como propostas.**
- **Item 2:** vale a recomendação **(a)**. Ao marcar o mapa do corpo, a dor muscular vem preenchida com a maior intensidade marcada, editável, e só se o campo estiver vazio.
