# Fase 3 · Etapa 0 — Descoberta

Nada no app mudou nesta etapa. Copiei para o repositório o `CLAUDE.md` novo, o `docs/roteiro-fase3.md` e a pasta `design/telas-fase3/`. O `CLAUDE.md` só acrescenta as regras da Fase 3: componentes, dados e três "não fazer".

## 1. Quantos treinos têm trajeto completo e quantos só a versão leve

Contei no servidor, só os números, sem baixar conteúdo, em 21/11:

| O quê | Quantidade |
|---|---|
| Treinos | 139 (110 de corrida, 29 de pedal) |
| Vieram do Garmin | 138 |
| Têm o local de largada (`geo`) | 139 |
| Têm o trajeto leve no servidor (`analise_tracks`) | **138** (média de 8,4 KB; o maior tem 35,2 KB) |
| Têm a leitura da Fase 2 calculada | **29** |

- **Trajeto completo (1 Hz):** fica só no IndexedDB de cada aparelho, e daqui eu não consigo ler.
  - Os 138 trajetos leves no servidor mostram que um dos seus aparelhos rodou "Buscar trajeto no Garmin" para quase tudo. É nesse aparelho que estão os trajetos completos.
  - O outro aparelho só tem a versão leve, a não ser que também rode a busca.
  - **Proposta:** acrescentar em Configurações › Dados a linha "Trajetos neste aparelho: N completos · M só a versão leve", para você ver em cada aparelho.
- **Leitura:** só 29 dos 139 treinos têm a leitura da Fase 2. Os outros ganham quando você tocar em "Calcular a leitura de N treinos com trajeto" (Progresso › Melhores esforços) no aparelho com os trajetos completos.
  - Os segmentos da Fase 3 vão usar o mesmo caminho: calcula onde há o trajeto completo e sincroniza o resultado.
- **Precisão com a versão leve:** ela guarda a rota com até 400 pontos e as séries a cada 10 s. Um tempo de passagem tirado dela tem cerca de **±5 s**, e é isso que a tela vai escrever. Com o trajeto completo, a precisão é de 1 s.

## 2. Onde guardar o catálogo de segmentos

**Recomendação: dentro de `athlete`, no campo novo e opcional `athlete.segmentos`.**

- **Tamanho medido:** cerca de 0,4 KB por segmento, com a forma simplificada em até 30 pontos e o nome, a distância, o ganho e as datas. São **23 KB para 60 segmentos**. O estado sincronizado hoje tem cerca de 2 MB, então isso é pouco.
- **Por que em `athlete`:**
  - a sincronização do motor só junta as chaves que ela conhece (atleta, treinos, dias, ciclo e plano da semana); um campo novo no topo de `apex.analise.v1` se perderia ao sincronizar;
  - dentro de `athlete`, ele vai junto, sem tabela nova e sem mexer no motor;
  - a meta semanal em horas também fica em `athlete`, como pede o roteiro.
- **Cuidado:**
  - o atleta sincroniza inteiro, e vence a versão mais recente;
  - para os dois aparelhos não criarem catálogos diferentes, o **id de cada segmento sai da própria geometria**: o mesmo trecho dá o mesmo id em qualquer aparelho;
  - renomear grava `athlete.updatedAt`.
- **Passagens:** em `leitura.segmentos` de cada treino, que já sincroniza. São cerca de 76 bytes por passagem.

## 3. Como desenhar o mapa de calor

- **Cálculo:**
  - o mapa é dividido em quadrículas;
  - cada treino marca as quadrículas por onde passou, com a regra do vaivém aprovada na Etapa 1;
  - as quadrículas vizinhas visitadas em sequência viram trechos de rua, e cada trecho guarda quantas vezes foi percorrido e por quais treinos.
- **Mapa de ruas (MapLibre):** uma fonte GeoJSON com os trechos como linhas.
  - A cor e a espessura vêm da faixa de frequência (1–2, 3–5, 6–10, 11–19, 20 ou mais), com os tokens da Fase 3.
  - Tocar numa linha usa a busca de elementos do próprio MapLibre (`queryRenderedFeatures`) e devolve a lista de treinos daquela rua.
- **"Só trajeto" (sem internet):** o mesmo desenho em SVG, agrupado por faixa, como o mapa do Treino já faz. Funciona em modo avião.
- **Desempenho:** se o cálculo passar de 100 ms, ele vai para um Web Worker, para a tela não travar. Vou medir com os 139 trajetos.
- **Privacidade:** o mapa de calor é calculado no aparelho, não sincroniza e nunca vai para card nem compartilhamento. Um teste vai garantir isso.

## 4. Tempo para ler todos os trajetos

Medido no navegador, com 139 trajetos completos sintéticos de 30 a 120 min (623 mil pontos no total):

| O quê | Normal | Processador 4× mais lento (simula o celular) |
|---|---|---|
| Ler os 139 trajetos completos do IndexedDB | 0,33 s | 0,79 s |
| Abrir os 138 trajetos leves | 0,11 s | 0,37 s |

- A leitura cabe na meta de 1 s do mapa de calor, mas sobra pouco para o cálculo.
- **Recomendação:** o mapa de calor guarda no aparelho o resultado por treino (as quadrículas de cada um). Assim ele não relê todos os trajetos a cada abertura: só processa os treinos novos.

## Próxima etapa

Etapa 1: só documento, `docs/fase3-formulas.md`, com os 6 itens para você aprovar. Se tiver uma meta semanal de horas em mente, informe junto.
