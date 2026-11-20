# Fase 2 · Etapa 5 — Leitura do treino

Os 8 itens aprovados em 20/11 (`docs/fase2-formulas.md`), implementados sem mudar nenhuma fórmula existente. O `engine.mjs` não foi tocado.

## O que entrou

- **Módulos puros novos:**
  - `analise/wind.mjs`: vento.
  - `analise/laps.mjs`: tiros, com "Trocar origem".
  - `analise/efforts.mjs`: melhores esforços e selos.
  - `analise/leitura.mjs`: clima padrão, início da deriva, custo da subida, curva pessoal, história e o pacote `leitura`.
- **Quando é calculado:** uma vez, com o trajeto completo, ao salvar um treino importado, ao reimportar o .FIT e ao buscar o trajeto no Garmin. O resultado fica no campo novo e opcional `w.leitura` (`v: 1`), que sincroniza com o treino. O outro aparelho só exibe.
- **Editar o treino** refaz só o que depende dos dados digitados: clima padrão e deriva.
- **Treinos antigos com trajeto:** em Progresso › Melhores esforços aparece o botão "Calcular a leitura de N treinos com trajeto".
- **Treinos do Garmin sem trajeto:** o mesmo card mostra o botão "Buscar trajeto no Garmin".
- **Treino:**
  - história (3 linhas);
  - faixa "≈ pace em clima padrão";
  - chip do vento e modo de cor Vento (a favor, lateral ou contra);
  - "A deriva começa no km X", com faixa no gráfico e marcador no mapa;
  - Tiros: pontos, tabela, origem e "Trocar origem";
  - Melhores esforços, com selos;
  - Custo da subida: barra e tabela.
- **Hoje:** "Último treino · história".
- **Progresso:** melhores esforços do período e a curva pessoal do custo da subida.
- **Livro de fórmulas:** nova seção "Leitura do treino", com 7 verbetes. Cada um tem fórmula, dado necessário, fonte e confiança. Tocar no número abre a Folha do KPI.

## Decisões de exibição (sem mudar fórmula)

- O selo "Recorde pessoal" ou "Melhor do ciclo" só aparece quando existe pelo menos outro treino com aquela distância para comparar.
- O vento busca a mesma fonte e a mesma consulta do clima (Open-Meteo, por coordenada e horário). Nenhum servidor novo.

## Testes

| Suíte | Resultado |
|---|---|
| `node analise/leitura.test.mjs` | 43/43, com os .FIT reais: "6 × 90 s", deriva da Meia no km 14, km automático não vira tiro |
| `node scripts/leitura-app.mjs` (Chromium, .FIT reais, Open-Meteo simulado) | 24/24 |
| `npm run test:analise` | 10 arquivos verdes |
| `npm test` | 82 |
| `npm run test:app` | 81 |
| tracks-app | 11 |
| garmin-app | 24 |
| offline | 9 |

O tracks-app agora aceita o campo novo `leitura` no "byte a byte" do critério 11. Fora ele, o treino segue idêntico.

## Hidratação: janelas de antes e depois (pergunta do Lucas, 20/11)

O motor não usa janela de tempo para antes e depois. Ele compara o total registrado com uma meta, seguindo a posição oficial do ACSM (Sawka, M. N. et al., *Exercise and fluid replacement*, Med Sci Sports Exerc 39(2), 2007):

| Fase | Como o motor calcula |
|---|---|
| Antes | meta de cerca de 5 ml/kg, mais em treino longo e no calor (o ACSM fala em 5–7 ml/kg nas horas anteriores) |
| Durante | taxa em ml/h sobre a duração do treino |
| Depois | repor cerca de 125% do déficit estimado (suor estimado − bebido durante) |

Como já tem embasamento, ficou como está, por decisão do Lucas. Nenhuma janela de 30 min foi criada.
