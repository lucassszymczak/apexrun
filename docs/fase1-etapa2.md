# Fase 1 · Etapa 2 — Importar + Treino com mapa

## O que mudou

### Trajeto (novo dado, separado das análises)

O trajeto é extraído na importação (`analise/app/track.ts`):
- posição em graus (o motor já converte semicírculos), tempo real, FC, velocidade, altitude e distância;
- a **inclinação suavizada do próprio motor** (`gradeSeries`, a mesma dos KPIs por amostra);
- o fuso do treino (`local_timestamp − timestamp`), para encaixar as fotos na Etapa 3.

Desenho e armazenamento:
- O traçado é simplificado com **Douglas–Peucker (~3 m)**, guardando só os índices. Cada ponto mantém o seu tempo, então o replay segue o relógio do treino.
- Fica no IndexedDB (`apex-performance` › `tracks`, versão 2 do banco), pelo id do treino. **Não entra no `apex.analise.v1` nem na sincronização.**
- Excluir um treino apaga o trajeto; substituir um treino troca o trajeto.

### Importar (botão "+")

1. **Arquivo:** um ou **vários** .FIT; no computador, também arrastar e soltar. "Registrar à mão" continua como opção secundária.
2. **Conferência**, um arquivo por vez:
   - o que foi lido (inclusive se tem GPS);
   - achados: pausas, lacunas, gravação inteligente, % excluído, clima;
   - **duplicata**: substituir / manter os dois / cancelar este arquivo.
3. **Completar:** o formulário (modalidade e tipo, RPE de 0 a 10, sono, dor muscular, dor articular, hidratação, notas, dados do relógio). Ao salvar, abre o Treino (com vários arquivos, segue para o próximo).

O leitor e as regras são os mesmos do app antigo. O leitor de .FIT vem do npm, junto com o app, e funciona sem internet. Fotos e privacidade entram na Etapa 3.

### Treino

O layout segue `design/telas/Treino` e `TreinoDesktop`.

**Mapa em tela cheia:**
- **Ruas:** MapLibre + OpenFreeMap (gratuito, sem chave), com água, terra e ruas recoloridas para `--noite`, `--superficie` e `--superficie-2`. Só é baixado quando o Treino abre (~285 KB gzip, num pedaço separado).
- **Só trajeto:** SVG próprio, **sem internet**.
- Se o mapa de ruas não carregar, o app avisa e troca sozinho para Só trajeto.

**Sobre o mapa:**
- **Cor do trajeto:**
  - **FC** e **Zona:** zonas do atleta (Karvonen na corrida, zonas do Garmin na bike). A FC mostra os bpm de cada faixa; a Zona, Z1 a Z5.
  - **Pace:** 5 faixas pelos quintis do próprio treino.
  - **Inclinação:** as 5 faixas do motor (`gradeBandIdx`).
  - A legenda sempre mostra os 5 tons com os rótulos.
- **Marcos de km:** a cada 5 km; a cada 1 km com zoom (ou quando cabem).
- Largada, chegada e o ponto ciano do replay.
- Zoom e arraste no Só trajeto; descrição em texto para leitor de tela (distância, sentido, largada/chegada).

**Replay:**
- O treino inteiro em ~10 s em 1×, com 2× e 4×. A barra e o relógio mostram o **tempo real** do treino. Espaço dá play/pausa.
- Com "reduzir movimento" ligado, não há animação automática: a barra continua manual.

**Gráfico ligado ao mapa** (pace, FC e elevação):
- tocar ou arrastar no gráfico move o ponto no mapa, e as setas do teclado também;
- tocar no trajeto move o cursor do gráfico.

**Gaveta no celular (3 alturas, arrastável ou por toque/teclado no puxador):**
- **Recolhida:** play, barra, km e tempo, distância, pace (magenta), FC e deriva.
- **Média:** acrescenta o gráfico ligado e os splits, com o km mais rápido em destaque.
- **Expandida:** os sistemas (Motor, Resistência, Mecânica, Carga e zonas, Hidratação, Percepção, Condições, Qualidade dos dados).
- O mapa ocupa só a área acima da gaveta e se reenquadra quando ela muda de altura.

**Computador:** mapa ao centro, **painel fixo de 420 px** à direita com o conteúdo da gaveta, replay numa barra sobre o mapa.

**Estados:**
- **Sem GPS** (esteira, bike indoor): o gráfico assume o lugar do mapa.
- **Treino antigo sem trajeto:** "Reimporte o .FIT para ver o mapa; nada nas análises muda." + botão.

**Menu (⋮):** Editar, **Reimportar .FIT** e Excluir.
- O Reimportar reconhece o treino pela **data, distância e duração** (±5%). Se o arquivo for de outro treino, recusa e diz por quê.
- Se bater, **só acrescenta o trajeto**: o treino nem é regravado.

**Configurações:** novo cartão **Mapa** (fundo padrão Ruas / Só trajeto e cor padrão). São campos opcionais e aditivos no atleta.

## Verificações

| Verificação | Resultado |
|---|---|
| `npm run test:analise` | 9 arquivos verdes (motor, paridade, golden, diferencial; os 6 originais sem alteração) |
| `npm test` (Vitest) | 33/33, incluindo **14 testes novos do trajeto** |
| `npm run typecheck` | ok |
| Golden (motor antigo × novo) | idêntico |
| Comparação de telas | sintético 1892/1892 (100%); seed 508/511 (a diferença é a do "Último treino", já explicada na Etapa 1) |
| Teste de fumaça `npm run test:app` | **54/54**, sem rede (como em modo avião) |
| JS inicial | ~163 KB gzip (limite 250 KB); o MapLibre só carrega no Treino |

Os 14 testes novos do trajeto (Vitest) cobrem:
- a posição convertida para graus;
- o tempo real, que inclui as pausas;
- a inclinação igual à do motor, ponto a ponto;
- a simplificação: **nenhum ponto original fica a mais de 3 m do traçado**;
- os marcos de km, o fuso pelo .FIT, as séries sem GPS;
- as cores (zonas da corrida e da bike, quintis do pace, faixas de inclinação).

### Critérios da Fase 1 atendidos nesta etapa

| # | Critério | Como foi verificado |
|---|---|---|
| 5 | .FIT com GPS → trajeto colorido, marcos de km e largada/chegada; "Só trajeto" em modo avião | Teste de fumaça sem rede. Ruas conferido com tiles reais (prints). |
| 6 | Play ~10 s (1×); arrastar o gráfico move o ponto; tocar no trajeto move o cursor do gráfico | Teste de fumaça: **10,0 s**; tocar a 59% do traçado → cursor a 61% (a diferença é o desvio entre a posição na lista de pontos do traçado e o tempo real) |
| 7 | 4 modos de cor com legenda; inclinação nas 5 faixas do motor | Teste de fumaça + testes do trajeto |
| 11 | Sem GPS e treino antigo sem trajeto mostram os estados descritos | Teste de fumaça; Reimportar recusa o arquivo errado e, com o certo, não muda nada no treino (comparação byte a byte) |
| — | Trajeto de uma meia aparece em menos de 1 s | Longão sintético de 2h (~20 km, ~7.200 pontos): **219 ms** no Chromium desta máquina (ainda não medido num iPhone) |

## Notas

- **Rede da máquina de trabalho:** o OpenFreeMap era bloqueado aqui. Criei um ambiente pessoal "apexrun" que libera **só** `tiles.openfreemap.org`, para conferir o mapa de ruas. Isso não afeta o seu celular.
- **FC × Zona:** os dois modos usam as suas zonas (o roteiro manda usar as zonas do atleta nos dois). A diferença é a legenda: bpm na FC, Z1–Z5 na Zona. Se quiser a FC num degradê contínuo, ajusto.
- **Pace e inclinação:** são lidos de cada ponto do .FIT. O roteiro dizia "reamostrados como o motor já faz", mas o motor reamostra em 1 Hz removendo as pausas, e o replay precisa do tempo real com as pausas. Por isso guardei os pontos como vieram do relógio (~1 por segundo) e usei a inclinação suavizada do próprio motor.
- **Não entram nesta etapa:** o botão Compartilhar (magenta) e o escudo de privacidade no topo do Treino (Etapa 3); as fotos no mapa e na Conferência (Etapa 3).

## Pontos em aberto

1. **Backup real** (`fixtures/privado/backup.json`) para o golden master com os seus dados.
2. **Confirmações da Etapa 1:** escala da dor muscular (0–10) e a regra do IMP.
3. **Testar no iPhone** com 2 ou 3 .FIT reais (corrida com GPS, pedal, esteira). Eles também servem para medir o tempo de abertura do mapa no aparelho.

## Atualização (20/11) — respostas do Lucas e teste com .FIT reais

**Decisões do Lucas**
- **Dor muscular:** escala 0–10 (o app novo mostra "3 de 10"; o limiar do Coach, ≥ 3, não mudou).
- **IMP no Foco atual:** a regra do Livro de fórmulas está certa (só sessões em clima padrão, confiança Moderada ou Alta).

**3 .FIT reais**

Os arquivos ficam em `fixtures/privado/`, fora do git. São 3 corridas com GPS: 14/11 (11 km), 17/11 (5,28 km) e 19/11 (6,09 km).
- Os 3 foram importados de uma vez pelo fluxo completo, sem erro.
- **Mapa de ruas:** traçado correto sobre as ruas de Guarapuava.
- **Trajeto:** de 2.400 a 4.800 pontos, simplificados para 92 a 191 pontos de desenho, montados em 4 a 23 ms.
- **Fuso:** lido do relógio (UTC−3).

**Dois comportamentos do motor, que já existem no app atual. Não corrigi; preciso da sua decisão.**

1. **Salvar o treino altera os splits por km.**
   - O formulário transforma os splits em texto e lê de volta, e na volta o último split é "esticado" para fechar a distância total: 1,00 km vira 1,09 km.
   - No treino de 19/11, isso muda o **decoupling de 8,4% (o que o .FIT mostra) para 5,6% (o que fica salvo e aparece no app)**. O GAP não muda.
   - O app antigo faz exatamente o mesmo, por isso o golden master não acusa nada.
2. **Pace-GAP@145 implausível com pouco tempo na faixa de 145 bpm.**
   - Com 3,7 minutos em 145±3, o motor usa a regressão (R² 0,46) e devolve **18:24/km**, com confiança "Baixa".
   - No treino de 14/11, devolve 10:04/km. O valor aparece no Foco atual com a confiança indicada.

## Atualização (20/11, tarde) — backup real e decisões aplicadas

**Golden master com o backup real** (`fixtures/privado/backup.json`, fora do git): 14 treinos (13 corridas com stream e GPS, 1 bike indoor) e 1.099 dias de diário.
- App antigo × motor novo no mesmo navegador: **idêntico valor a valor**. No Node: 135/135, incluindo 250 comparações por treino.
- Comparação de telas: **1356/1356 (100%)** dos números das telas antigas aparecem no app novo.
- Com isso, o **critério 2 da Fase 1** (golden no seed e no backup real) está cumprido.

**Decisões aplicadas** (registradas também no `CLAUDE.md`):
1. **Splits preservados ao salvar** (daqui para frente). No .FIT de 19/11, o decoupling fica em 8,4% ao salvar (antes caía para 5,6%). Treinos já salvos não mudam. Testes em `tests/splits.test.ts`.
2. **Pace-GAP@145 retirado da interface:** saiu do Foco atual, da Qualidade dos dados ("min na banda 145±3") e do Livro de fórmulas.
   - O motor continua calculando (dado salvo e sincronizado), só não aparece.
   - O Foco atual fica com IMP e cadência no ritmo de referência.

**Correção de um erro meu:** a Folha do KPI do pace ajustado (GAP) abria o texto do Pace-GAP@145, porque a busca pelo trecho "gap" casava primeiro com ele. Agora abre "GAP · Ritmo ajustado à inclinação".
