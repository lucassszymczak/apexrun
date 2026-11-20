# Fase 2 · Etapa 2 — Importação automática e "Para completar"

Nenhum cálculo muda. O formato de `apex.analise.v1` só ganha o campo opcional `garminActivityId`.

## Como funciona

- **Quando roda:** com a tela já aberta, nunca antes, no máximo a cada 15 min, ou em Garmin › "Sincronizar agora". Também roda quando você volta ao app.
- **Para cada corrida ou pedal do Garmin:**
  - **Já salvo**, com o mesmo `garminActivityId`: só confere a nota (RPE).
  - **Mesmo treino que você importou à mão** (mesma regra de duplicata do Importar): os dois ficam ligados e o treino não duplica. Entra no resumo como "já existia".
  - **Novo:** o app baixa o .FIT e passa pelo mesmo caminho do Importar (leitura, clima e trajeto).
    - **Dos últimos 14 dias:** vai para a fila "Para completar", no IndexedDB e fora de `apex.analise.v1`. Os KPIs só contam treinos salvos.
    - **Mais antigo:** entra salvo direto, com o RPE do Garmin. Decisão do Lucas em 20/11.
- **RPE do Garmin:** é a nota que você dá no relógio (`directWorkoutRpe`, que vem em dezenas: 60 = 6).
  - Preenche o RPE dos treinos novos.
  - Atualiza o RPE dos treinos já salvos (decisão do Lucas, 20/11).
  - Conferido com os seus treinos reais: 12 de 13 iguais. A diferença é o de 02/11 (5 no app e 4 no Garmin), que passa a ficar com 4.
  - O backup automático guarda a versão anterior.
- **Dois aparelhos:** cada aparelho tem a sua fila. Quando um treino da fila aparece salvo pela sincronização (mesmo `garminActivityId`), ele sai da fila do outro.
- **Avisos discretos:**
  - chave vencida ou recusada: "Renovar chave";
  - chave vencendo: aviso a partir de 30 dias antes;
  - Garmin fora do ar: nova tentativa espaçada, controlada pela função;
  - sem internet: silêncio, e nova tentativa na próxima abertura.

## Telas
- **Hoje:**
  - o card "Para completar · N do Garmin" fica abaixo da prontidão, com os 3 números de cada treino e o selo;
  - a ação principal vira "Completar treino" e o "+" vira contorno;
  - no computador, o "Hoje" do trilho ganha um contador, e o pé do trilho mostra "Garmin · sincronizado há X".
- **Completar:** o passo 3 do Importar já vem preenchido, com o RPE do Garmin. Ao salvar, o treino sai da fila e abre o Treino.
- **Treinos:** selos "Garmin" e ".FIT manual", e "sincronizado há X min" na contagem.
- **Garmin:** resumo da última sincronização, a fila e o progresso do download ("Baixando 3 de 29").

## Função `garmin`
- Ação nova `rpe`: devolve só os 3 campos de percepção do resumo da atividade.
- Publicada (versão 2) e testada com o Garmin simulado: 17 testes.

## Testes
- `npm run test:garmin`: **22 de 22**, com o Garmin simulado, cobrindo os critérios 5, 6, 7, 8, 9 e 17.
- Motor e golden master: verdes.
- `npm test`: 76/76.
- Teste de fumaça: 81/81.
- Offline: 9/9.

## Ainda não entra nesta etapa
- "Todo o histórico" em lotes com pausa na tela: o app já baixa um por vez e mostra o progresso. O botão de pausa fica para a Etapa 3, junto com "Buscar trajeto dos treinos antigos".
