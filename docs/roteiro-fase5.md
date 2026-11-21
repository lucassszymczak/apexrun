# Apex Performance — Roteiro da Fase 5 · Rotina (aprovado em 21/11/2026)

Projeto pessoal · 21/11/2026 · base: Fase 3 publicada (PRs #63 a #69)

## Decisões do briefing (21/11)
- **Resumo pós-treino:** é a tela que aparece ao salvar o treino. Sem aviso no celular.
- **Retrospectiva do ciclo:** no app e também como sequência de cards para Stories.
- **Equipamentos:**
  - 1 par de tênis, com alerta aos 600 km;
  - o tênis é escolhido em cada treino;
  - na bike, controle de pneus e corrente.
- **Mapa do corpo:** registro só em dia de treino, sem aviso.
- **Voz:** pelo microfone do teclado do iPhone.

## Telas

### 1. Completar treino (ajuste)
- **"Diga como foi"** (novo, no topo):
  - um campo de texto com a dica "Toque no microfone do teclado e fale: RPE 7, dormi 7 e meia, canela esquerda 3" (o sono do app é em horas);
  - o app entende a frase e preenche os campos abaixo, que ficam destacados para você conferir;
  - nada é salvo sem você confirmar.
- **Campos de hoje:** RPE, sono e dor geral continuam como estão.
- **Mapa do corpo** (novo):
  - corpo de frente e de costas, com lado esquerdo e direito;
  - toque numa região e dê a intensidade de 0 a 10;
  - as regiões marcadas aparecem em lista, com o nome escrito.
- **Equipamento** (novo):
  - tênis na corrida, bike no pedal;
  - com um par só, ele já vem escolhido;
  - mostra os km acumulados ("512 de 600 km").
- **Ação principal:** Salvar treino.

### 2. Resumo pós-treino (nova, abre ao salvar)
- **Título-conclusão** (por exemplo, "Treino leve que manteve a semana consistente").
- **História do treino:** as 3 frases que já existem.
- **"O que mudou":** só o que de fato mudou, cada item com ícone e palavra:
  - recorde ou melhor esforço;
  - posição num segmento;
  - semana consistente e sequência;
  - carga e forma;
  - km do tênis ou da peça da bike.
- **Ação principal:** Ver o treino. **Secundária:** Compartilhar.

### 3. Equipamentos (nova, em Mais)
- **Tênis:**
  - nome, data de início, km e uma barra até o limite (600 km);
  - "Aposentar" e "Novo par".
- **Bike:**
  - pneus e corrente, cada um com km desde a última troca e o limite;
  - "Troquei", que zera os km e guarda o histórico.
- **Alertas (só dentro do app):**
  - card no Hoje quando chegar ao limite ("Tênis com 600 km: hora de trocar");
  - aviso discreto a partir de 90% do limite.

### 4. Retrospectiva do ciclo (nova)
- **Quando aparece:** ao fim do ciclo (prova concluída), como card no Hoje. A versão parcial ("até agora") fica no Ciclo de prova a qualquer momento.
- **No app,** em sequência rolável:
  - capa com o ciclo e as datas;
  - volume e horas;
  - semanas consistentes;
  - o longão mais longo;
  - melhores esforços e recordes;
  - os segmentos que mais evoluíram;
  - a prova: plano × real;
  - os km do tênis no ciclo.
- **Stories:** "Gerar Stories" monta 5 a 6 cards 9:16 com os mesmos destaques, no padrão dos cards da Fase 1.
  - Os cards só trazem números e gráficos. Nenhum mapa, para não mostrar onde você mora.

### 5. Progresso › Corpo (nova, pequena)
- **Mapa do corpo** com as regiões coloridas pela frequência de dor nos últimos 90 dias.
- **Ao tocar numa região:** a linha do tempo dela, com data e intensidade.
- **Sem alertas e sem diagnóstico.**

### Computador
- Completar em duas colunas: voz e campos de um lado, mapa do corpo do outro.
- Equipamentos e Retrospectiva com mais espaço.

## Regras novas (você aprova antes de programar)

| Regra | O que você aprova |
|---|---|
| Leitura da frase falada | As palavras que o app entende (números por extenso, nomes das regiões, "esquerda/direita", "dormi 7 e meia") e o que fazer quando não entende (deixa em branco e avisa) |
| Dor geral × mapa do corpo | O campo de dor atual continua igual. Proposta: ele já vem preenchido com a maior dor marcada no mapa, e você pode mudar |
| "O que mudou" no resumo | O que conta como mudança (recorde, segmento no top 3, semana, variação de forma) |
| Equipamentos | Km da corrida para o tênis e km do pedal para pneus e corrente; aviso a partir de 90% |
| Retrospectiva | Quais destaques entram e em que ordem |

## Jornadas
1. **Pós-treino (celular):** Hoje › Para completar → fala "RPE 7, dormi 7 e meia, canela esquerda 3" → confere → Salvar → Resumo → Compartilhar.
2. **Troca de tênis:** card no Hoje "Tênis com 600 km" → Equipamentos → Novo par → os próximos treinos usam o novo.
3. **Bike:** trocou a corrente → Equipamentos › Corrente › Troquei → os km zeram.
4. **Fim do ciclo:** Hoje → "Sua retrospectiva está pronta" → percorre → Gerar Stories.

## Em aberto
- Limite de km para os pneus e para a corrente: você define ao cadastrar, ou passa agora.
