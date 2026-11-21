# Apex Performance — regras do projeto

App pessoal de análise de treinos (corrida e bike agora; natação depois), usado no celular e no computador. É publicado no GitHub Pages em `/apexrun/analise/`.
- **Fase 1 (publicada):** reconstruiu a página única antiga como app em `analise/app/`, com a nova identidade, mapa do trajeto, replay, fotos, privacidade e cards de compartilhamento.
- **Fase 2 (publicada):** treinos do Garmin entrando sozinhos, trajeto nos dois aparelhos e a leitura do treino (história, vento, deriva, tiros, melhores esforços e custo da subida). Roteiro em `docs/roteiro-fase2.md`; telas em `design/telas-fase2/`.
- **Fase 4 · Planejamento (publicada):** percurso da prova, plano de prova km a km, simulador de meta e melhor horário para correr amanhã. Roteiro em `docs/roteiro-fase4.md`; telas em `design/telas-fase4/`.
- **Fase 3 · Evolução (publicada):** mapa de calor, segmentos encontrados pelo app, replay com fantasma e consistência por semanas. Roteiro em `docs/roteiro-fase3.md`; telas em `design/telas-fase3/`.
- **Fase 5 · Rotina:** "Diga como foi" (voz pelo teclado), mapa do corpo, equipamentos (tênis, pneus e corrente), resumo pós-treino e retrospectiva do ciclo com Stories. Roteiro em `docs/roteiro-fase5.md`; telas em `design/telas-fase5/`.

Fale com o Lucas em português do Brasil, de forma curta. Ele não é desenvolvedor: explique decisões técnicas em uma linha, sem jargão.

## Regra de ouro: os cálculos não mudam

- O motor de KPIs é o patrimônio do app: GAP, EF, decoupling, TRIMP, CTL/ATL/TSB, Pace-GAP@145, IMP, Riegel, prontidão e o resto. **Nenhuma fórmula, constante, limiar ou arredondamento existente muda.**
- Fonte única do motor **no app novo**: `analise/engine.mjs`, cópia byte a byte do motor de `analise/index.html` (depois, `legacy/analise-v1/index.html`), gerada por `scripts/extract-engine.mjs`. Nunca edite à mão; `analise/engine.test.mjs` garante a paridade.
  - Decisão do Lucas (20/11/2026): os módulos `kpi.mjs`, `stream.mjs`, `fit-ingest.mjs`, `weather.mjs`, `sync.mjs` e `health-ingest.mjs` continuam intactos e testados, mas em 4 pontos não fazem o mesmo que a página (`fitnessSeries`, `acuteChronic`, `consistency`, `messagesToWorkout`; ver `docs/fase1-etapa0.md`). O app novo segue a página.
  - Lógica nova que precise do motor importa de `engine.mjs`; lógica que só exista dentro de um `render*` da página é portada copiando a expressão, sem reescrever.
- Os testes existentes precisam passar sempre: `node analise/kpi.test.mjs`, `node analise/fit.test.mjs`, `node analise/recovery.test.mjs`, `node analise/sync.test.mjs`, `node analise/stream.test.mjs`, `node analise/weather.test.mjs` e `npm test`. `npm run test:analise` roda todos os `analise/*.test.mjs` de uma vez (inclui paridade, golden e diferencial).
- O teste de referência (golden master) compara cada número exibido pelo app antigo com o do app novo, para o seed e para o backup real do Lucas. Qualquer diferença bloqueia a entrega.
- Se um bug no motor aparecer, não corrija calado: descreva e pergunte.
- Decisões do Lucas (20/11/2026), que valem daqui para frente sem mudar treinos já salvos:
  - **Splits ao salvar:** se o texto dos splits não foi editado, guardam-se os splits exatos do .FIT (antes o último km era esticado até a distância total e o decoupling mudava). Splits digitados à mão seguem a regra antiga. Ver `tests/splits.test.ts`.
  - **Treinos antigos com o último km esticado são corrigidos na abertura do app** (`analise/app/fix-splits.ts`), depois do backup automático: só treinos com marca de .FIT, último split > 1 km e ≤ 1,15 km igual a "distância − (n−1)" → volta a 1 km. Idempotente. No backup do Lucas: 31/10 (decoupling 8,1 → 10,4%) e 19/11 (5,6 → 8,4%). Por isso a comparação de telas do backup mostra diferença nesses 2 treinos e no que deriva deles — é a correção pedida, não uma regressão.
  - **Pace-GAP @ FC_REF (145) fora da interface:** o motor continua calculando (dado salvo e sincronizado), mas o app não exibe esse KPI. Ficam o pace e o pace ajustado à inclinação (GAP).
  - **Dor muscular:** escala 0–10.
  - **IMP:** só sessões em clima padrão com confiança Moderada ou Alta (regra do Livro de fórmulas).

## Cálculos novos (a partir da Fase 2)

- Só entram depois que o Lucas aprova a fórmula por escrito (`docs/fase2-formulas.md`, `docs/fase4-formulas.md`, `docs/fase3-formulas.md`, `docs/fase5-formulas.md`), com fonte publicada, limiares, confiança e os casos em que o item não aparece.
- Fórmulas já aprovadas são reaproveitadas por importação, nunca copiadas (por exemplo, `correcaoHadley` de `leitura.mjs` e `gradeCostMult` e `riegel` do `engine.mjs`).
- Previsões ("tempo realista", "melhor horário") sempre mostram faixa ou confiança e a frase "estimativa, não garantia". Nada de prever ganho de treino.
- Ficam em módulos novos e puros em `analise/` (por exemplo `laps.mjs`, `efforts.mjs`, `leitura.mjs`, `wind.mjs`), com testes `node`. Eles importam do `engine.mjs` o que precisam; não copiam nem alteram fórmulas existentes.
- São calculados uma vez, com o trajeto completo (1 Hz), e gravados no treino no campo opcional `leitura`, com a versão da fórmula (`leitura.v`). O outro aparelho só exibe.
- Cada um tem verbete no Livro de fórmulas, selo de confiança e Folha do KPI.
- Sem o dado necessário, o item não aparece ou mostra "—" com o motivo. Nunca estime.
- Os números das telas de design são exemplos de formato. Nunca copie um valor delas para o código.

## Dados do usuário

- `localStorage` `apex.analise.v1` guarda todos os treinos e configurações. **O formato fica intacto.** Campos novos são opcionais e aditivos.
- `apex.analise.synccode` (código de sincronização) e `apex.theme` (tema) também ficam como estão.
- Antes de a nova versão gravar qualquer coisa, salve um backup completo de `apex.analise.v1` no IndexedDB, com data, e ofereça o download em Configurações › Dados.
- Dados pesados (trajeto completo, séries por segundo, miniaturas de fotos) ficam no IndexedDB, por id do treino.
- Desde a Fase 2, uma versão leve do trajeto e das séries (até 30 KB por meia maratona) sincroniza pela tabela `analise_tracks`, com o mesmo código de sincronização. Fotos nunca sincronizam.
- Treinos que chegam do Garmin ficam numa fila no IndexedDB ("Para completar") e só entram em `apex.analise.v1` quando o Lucas salva. O campo opcional `garminActivityId` identifica a origem.
- Fase 4 (campos opcionais e aditivos):
  - no ciclo (`race`): `goal` ganha o valor `"time"` (além de `"finish"`), e entram `targetSec`, `strategy` (`"constante"` ou `"negativa"`), `startTime` e `course`;
  - `course`: fonte, confiança, partes, distância gravada × oficial e o perfil leve (até 30 KB);
  - a janela de treino fica em `athlete`;
  - o ponto escolhido à mão para a previsão fica só no aparelho, fora da sincronização.
- Fase 3 (campos opcionais e aditivos):
  - catálogo de segmentos: id, modalidade, nome (renomeável), forma, distância, ganho e versão da regra que o detectou;
  - passagens de cada treino em `leitura.segmentos`: tempo, tempo ajustado (só corrida), FC e precisão;
  - meta semanal em horas em `athlete`;
  - o mapa de calor é calculado no aparelho a partir dos trajetos e não tem dado próprio sincronizado.
- Fase 5 (campos opcionais e aditivos):
  - catálogo de equipamentos: tênis (nome, início, limite em km, aposentado) e peças da bike (pneus e corrente, com o histórico de trocas e o limite opcional);
  - em cada treino: o equipamento usado e as regiões de dor (`dorRegioes`: região, lado e intensidade de 0 a 10);
  - os campos de hoje (RPE, sono em horas, `soreness`, `pain`, hidratação, notas) não mudam de formato nem de significado;
  - a retrospectiva e os Stories são calculados na hora e não têm dado próprio.
- Servidores que recebem dado pessoal, e só estes:
  - o Supabase (sync opcional, trajeto leve e a chave do Garmin criptografada);
  - o Open-Meteo (clima, vento e previsão, por coordenada e horário);
  - a API pessoal do Garmin, chamada só pela função `garmin`.
- Nunca faça commit de backups ou arquivos .FIT do Lucas: use `fixtures/privado/`, que fica no `.gitignore`. Respostas da API do Garmin usadas em teste são sintéticas.

## Garmin (chave pessoal)

- A chave é colada uma única vez, em Configurações › Garmin, num campo de senha. Ela vai por HTTPS para a Edge Function `garmin`, que a guarda criptografada (AES-GCM, chave-mestra no secret `GARMIN_ENC_KEY`).
- A chave nunca é guardada no aparelho, nunca aparece em log e nunca volta em resposta. Nunca peça a chave ao Lucas no chat nem no terminal.
- A função só atende os `sync_id` do secret `GARMIN_ALLOWED_SYNC_IDS`, e o CORS só aceita `https://lucassszymczak.github.io` e o endereço local.
- O token de acesso vale 24 h e não tem renovação automática: a função pede outro com a chave quando precisa.
- Endpoints, limites e prazos vêm da documentação oficial (Swagger da API pessoal), registrados em `docs/fase2-etapa0.md`. Nada de endpoint adivinhado.
- A API pessoal é de uso pessoal: cada chave dá acesso só aos dados de quem a criou.

## Identidade visual

Marca: **Apex Performance** (nunca "Apex Run"). Símbolo: o A como trajeto. A lâmina da ida é magenta, a da volta é ciano e o pico é um losango violeta. Os arquivos oficiais estão em `design/marca/`; nunca redesenhe o símbolo nem aplique degradê nele.

### Cores (tokens)

O tema escuro é o padrão. Use sempre a variável CSS (`var(--magenta)`), nunca o hex solto no componente.

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--noite` | #0D0F1A | #F6F7FB | Fundo da página e do mapa-base |
| `--superficie` | #161A26 | #FFFFFF | Cards, gaveta, painel lateral |
| `--superficie-2` | #1F2433 | #EEF0F5 | Campos, chips, linhas, ruas do mapa |
| `--linha` | #2A3042 | #DADDE6 | Bordas e divisórias |
| `--texto` | #F2F2F7 | #0D0F1A | Texto principal |
| `--texto-2` | #A3A9B8 | #4B5263 | Texto de apoio |
| `--texto-3` | #80879A | #6B7182 | Legendas e unidades (nunca sobre `--superficie-2`) |
| `--magenta` | #E8459A | #C42A7C | Ação principal (uma por tela), aba ativa, número em destaque |
| `--on-magenta` | #0D0F1A | #FFFFFF | Texto e ícone sobre magenta |
| `--ciano` | #22D3EE | #0891B2 | Seleção, controles grandes e ícones (play, ponto do replay), traços, foco |
| `--ciano-forte` | #22D3EE | #0E7490 | Controle ativo com texto pequeno: segmentado, chip, link, botão secundário |
| `--on-ciano` | #0D0F1A | #FFFFFF | Texto e ícone sobre `--ciano-forte` |
| `--violeta` | #5B3FD0 | #5B3FD0 | Pico do símbolo e selo "Recorde pessoal" (o pico é o seu melhor) |
| `--on-violeta` | #F2F2F7 | #FFFFFF | Texto e ícone sobre violeta (6,1:1 e 6,9:1) |
| `--zona-1` | #A5F3FC | #0891B2 | FC Z1 |
| `--zona-2` | #22D3EE | #4C67D6 | FC Z2 |
| `--zona-3` | #8B7CF6 | #6D4BD8 | FC Z3 |
| `--zona-4` | #C24FC8 | #9A3DBD | FC Z4 |
| `--zona-5` | #E0337F | #B0226C | FC Z5 |
| `--ok` | #34D399 | #047857 | Estado bom |
| `--atencao` | #FBBF24 | #B45309 | Cautela |
| `--alerta` | #F87171 | #B91C1C | Risco |

Contrastes do tema claro: `#0E7490` sobre branco 5,4:1 e sobre `#EEF0F5` 4,7:1; branco sobre `#0E7490` 5,4:1. No escuro, `#0D0F1A` sobre `#22D3EE` 10,6:1. O `--ciano` claro (`#0891B2`) não passa de 4,5:1 com texto pequeno: por isso existe o `--ciano-forte`.

`design/tokens.css` já traz tudo isso pronto, nos dois temas (`[data-theme="dark"]` e `[data-theme="light"]`). Na Fase 2, acrescente `--on-violeta` aos dois temas.

### Tipografia

- Uma família só: **Outfit**, servida pelo próprio app (`@fontsource/outfit`, pesos 400 e 500). Nada de 600 ou 700.
- Escala (tamanho/altura de linha):
  - display 48/52
  - titulo-1 32/38
  - titulo-2 20/26
  - subtitulo 16/22
  - corpo 15/22
  - apoio 13/18
  - legenda 11/14 (peso 500, com 0,4 px de espaçamento entre letras)
  - numero-grande 40/44
  - numero 20/24
- Mínimo de 11 px em qualquer texto.
- Todo número de treino usa `font-variant-numeric: tabular-nums`.

### Espaço e forma

- Espaçamento em múltiplos de 4: 4, 8, 12, 16, 24 e 32 px. Card com padding de 16; distância entre blocos de 24.
- Raios:
  - 8: chips, campos, botões pequenos
  - 12: cards e botão principal
  - 16: cards grandes e cards de compartilhamento
  - 22: topo da gaveta do mapa
  - 999: seletores segmentados
- Superfícies se separam por tom e por `--linha`, sem sombra. A única transparência permitida é a dos painéis sobre o mapa: `rgba(13,15,26,0.86)` + borda `--linha`.

### Ícones

- Tabler Icons de contorno (`@tabler/icons-react`, licença MIT), traço 1,75, de 18 a 24 px, na cor do texto ao lado.
- **Nenhum emoji na interface.**

## Componentes (estilo)

- **Botão principal:** fundo `--magenta`, texto `--on-magenta`, altura 48 (44 no computador), raio 12, Outfit 500 16 px. **Só um por tela.**
- **Botão secundário:** borda 1 px `--ciano-forte` (texto `--ciano-forte`) ou `--linha`, fundo transparente.
- **Seletor segmentado** (Ruas / Só trajeto, Stories / Feed, Corrida / Bike): trilho `--superficie` com borda `--linha` e raio 999. A opção ativa fica em `--ciano-forte` com texto `--on-ciano`. Quando é escolha única, é `role="radiogroup"` com `aria-checked`.
- **Chip de filtro** (cor do trajeto, tipo de treino): raio 999 ou 8. Ativo = fundo `--texto` e texto `--noite`, ou borda e texto `--ciano-forte` sobre `--superficie-2` (inativo: borda `--linha` sobre `--superficie`). Alvo de toque de 44 px mesmo quando o desenho é menor.
- **Filtros da lista de Treinos:** três grupos que não se confundem. Primeiro, a busca com o botão de período ao lado (menu: Tudo, 30 dias, 90 dias, 12 meses). Depois, a modalidade em seletor segmentado. Por último, o rótulo "Tipo de treino" e uma linha única de chips com rolagem horizontal. Sem card em volta; 14 a 16 px entre os grupos e 6 a 8 px dentro deles.
- **Card:** `--superficie`, raio 12 a 16, padding 16 a 20, sem sombra.
- **Gaveta do Treino (celular):** 3 alturas (recolhida, média e expandida), arrastável, com puxador de 36×4 em `--linha`. No computador, vira um painel fixo de 380 a 440 px à direita.
- **Folha do KPI:** abre ao tocar em qualquer número. Mostra nome, o que significa (1 linha), seu valor e faixa, confiança e "Ver no Livro de fórmulas".
- **Legenda de zonas:** sempre os 5 tons + os rótulos Z1 e Z5 (ou "lento/rápido", "descida/subida", "a favor/contra"). A cor nunca aparece sozinha.
- **Estados:** sempre ícone + palavra (`--ok`, `--atencao`, `--alerta`).
- **Navegação:** no celular, barra inferior com Hoje, Treinos, botão central "+" (círculo magenta de 52 px), Progresso e Mais. No computador, trilho lateral de 220 a 240 px com o logo, os mesmos destinos, os itens de "Mais" listados e o botão "Importar treino".
  - Quando o Hoje tem treinos para completar, a ação principal é "Completar treino" (magenta) e o "+" vira contorno `--ciano-forte`. No computador, "Hoje" ganha um contador em `--atencao`, e o pé do trilho mostra o status do Garmin.

### Componentes da Fase 2

- **"Para completar" (Hoje):**
  - card com o título "Para completar · N do Garmin";
  - cada linha com nome, data, 3 números e o selo "Para completar" (`--atencao`);
  - botão "Completar treino".
- **História do treino:**
  - card em `--superficie-2`, com 3 linhas de ícone + frase, sempre nesta ordem: check em `--ok` (o que foi bem), alerta em `--atencao` (o que observar), seta em `--ciano` (amanhã);
  - frases curtas, com o número que as sustenta.
- **Títulos de seção na leitura:** rótulo pequeno com o tema ("Tiros · 6 × 800 m") e, embaixo, o título com a conclusão ("Regulares até o 5º tiro").
- **Tiros:**
  - gráfico de pontos com o pace de cada tiro sobre a faixa alvo (`--ciano` a 10%). Mais alto é mais rápido. Fora do alvo, o ponto fica em `--atencao` com anel;
  - tabela # · tempo · pace · FC · recuperação, com o tiro fora do alvo marcado em texto e cor;
  - linha "Origem: …" com "Trocar origem".
- **Selos de esforço:** "Recorde pessoal" com fundo `--violeta`, texto `--on-violeta` e um losango; "Melhor do ciclo" com contorno e texto `--ciano-forte`. Raio 999.
- **Custo da subida:**
  - barra empilhada do tempo por faixa;
  - tabela faixa · tempo · real · GAP · FC;
  - cores das faixas: < −5% `--zona-2`, −5 a −2% `--zona-1`, ±2% `--texto-3`, 2 a 5% `--zona-4`, > 5% `--zona-5`, sempre com o rótulo da faixa ao lado.
- **Modo de cor Vento:**
  - a favor `--ciano`, lateral `--texto-3`, contra `--magenta`;
  - legenda "a favor … contra";
  - chip "Vento X km/h" com seta para onde o vento sopra.
- **Início da deriva:** linha vertical e faixa em `--atencao` a 10% no gráfico, e um marcador circular em `--atencao` no mapa.
- **Status do Garmin:** "Conectado" com ponto `--ok`, "Sincronizado há X min" e "chave vence em dd/mm/aaaa". Vencimento próximo em `--atencao`; chave vencida em `--alerta`, com "Renovar chave".

### Componentes da Fase 4

- **Perfil do percurso:**
  - altimetria em área `--superficie-2` com linha `--texto-3`;
  - trecho mais duro em faixa `--atencao` a 12%;
  - linhas tracejadas em `--texto` na meia e no km 30.
- **Pace alvo:** linha em degraus `--ciano`, mais alto = mais rápido, com linhas de referência rotuladas (7:30, 8:00…).
- **Passagens:** 3 cards (Meia, km 30, Chegada); a chegada em `--magenta`.
- **Blocos de 5 km:** sanfona com `<button aria-expanded>` e chevron `--ciano`. O km em subida tem o pace em `--atencao`, e a inclinação aparece escrita ao lado.
- **Imagem 9:16 do plano** (1080×1920):
  - fundo `--noite`;
  - os 34% de cima ficam livres (relógio da tela de bloqueio) e os 12% de baixo também (botões do iPhone);
  - tabela de blocos com números grandes;
  - símbolo e nome da marca no pé.
- **Faixa do simulador:**
  - régua de tempo com a faixa realista em `--ciano` a 22% com borda `--ciano`;
  - marcador da meta em `--texto`;
  - veredito com ícone e palavra (`--atencao` abaixo da faixa, `--ok` dentro ou acima).
- **Melhor horário:**
  - barras do custo do clima, começando no zero;
  - a melhor hora com contorno e rótulo `--ciano`;
  - chuva em `--atencao`, escrita embaixo da hora.
- **Confiança da fonte:** ícone e palavra (alta ou moderada em `--ok`, baixa em `--atencao`).

### Componentes da Fase 3

- **Mapa de calor:**
  - frequência na rampa das zonas: 1–2 vezes `--ciano` a 35%, 3–5 `--ciano`, 6–10 `--zona-3`, 11–19 `--zona-4`, 20 ou mais `--zona-5`, com a linha mais grossa quanto maior a faixa;
  - legenda "1 vez … 20 vezes ou mais";
  - chip fixo "Só você vê" com cadeado;
  - a rua tocada ganha um contorno `--texto`.
- **Card de segmento:**
  - desenho do trecho em `--ciano` sobre `--superficie-2`;
  - nome, distância · ganho · passagens, e o melhor tempo (e o ajustado, na corrida);
  - tendência com seta e palavra: mais rápido em `--ok`, mais lento em `--atencao`, estável em `--texto-2`.
- **"Seu melhor":** o mesmo selo do recorde pessoal (fundo `--violeta`, losango, texto `--on-violeta`). Os outros lugares aparecem em texto ("3º de 22").
- **Evolução do segmento:** gráfico de linha do tempo ajustado, com "mais alto = mais rápido" escrito e o melhor marcado com o losango.
- **Grade de consistência:** botões de 44 px, um por semana.
  - Consistente: fundo `--ok` a 16%, borda e check em `--ok`.
  - Parcial: borda e meio círculo em `--atencao`.
  - Sem treino: borda `--linha` e traço `--texto-3`.
  - Em andamento: borda tracejada e relógio em `--ciano`.
  - Sempre com a legenda em palavras.
- **Fantasma:**
  - você em `--ciano` cheio; o fantasma em círculo tracejado `--texto` com fundo a 18%;
  - a diferença em texto: "Fantasma 12 s à frente" em `--atencao`, "Você 8 s à frente" em `--ok`;
  - o padrão é "Sem fantasma".

### Componentes da Fase 5

- **"Diga como foi":**
  - campo de texto no topo do Completar, com a dica do microfone do teclado e o botão "Preencher pela frase";
  - cada campo preenchido pela frase ganha contorno `--ciano-forte` e a marca "· pela fala";
  - a linha "Entendi: …" lista em palavras o que foi entendido.
- **Mapa do corpo:**
  - frente e costas lado a lado, com "D" e "E" escritos;
  - cada região é um `<button>` com `aria-label` (nome, lado e dor);
  - intensidade de 1 a 3 em `--atencao` a 50%, de 4 a 6 em `--atencao` e de 7 a 10 em `--alerta`, sempre com o número dentro da região;
  - a região selecionada ganha contorno `--ciano`;
  - o seletor de intensidade tem − e + de 44 px;
  - a lista "Marcadas: …" aparece em palavras.
- **Barra de equipamento:** `--ciano` até 90% do limite, `--atencao` a partir de 90%, com "N de M km" escrito. Sem limite: só os km, e o link "Definir limite".
- **"O que mudou" (Resumo):**
  - linhas com ícone num círculo de 32 px: losango violeta (seu melhor), check `--ok` (semana consistente), seta `--ciano` (equipamento);
  - só entram as mudanças reais.
- **Retrospectiva:** blocos com rótulo em caixa alta pequena e título-conclusão. Os gráficos seguem as regras de sempre (barras do zero, destaque em `--ciano`).
- **Stories da retrospectiva:** cards 9:16 em `--noite`, com um número grande por card e a marca no pé. Nenhum mapa.

## Área segura do iPhone

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Use `--safe-top`, `--safe-bottom`, `--safe-left` e `--safe-right` (`design/tokens.css`; valem `env(safe-area-inset-*)`). Nunca use o `env()` direto no componente.
- **Topo das telas:** `padding-top: calc(var(--safe-top) + 12px)`. Uma faixa fixa da altura de `--safe-top` (`.app::before`) cobre o conteúdo rolado, para nada aparecer atrás do relógio.
- **Barra inferior:** 64 px úteis + `padding-bottom: var(--safe-bottom)`.
- **Treino:** o mapa vai até a borda. A barra do topo fica em `top: calc(var(--safe-top) + 12px)`, e a gaveta soma `--safe-bottom`.
- **Folhas e modais:** `--safe-bottom` embaixo, e a altura máxima desconta `--safe-top`.
- **Paisagem:** `padding-left/right` com `--safe-left` e `--safe-right`.
- **Barra de status:**
  - `apple-mobile-web-app-status-bar-style` = `black-translucent`: o app instalado desenha por baixo da barra, com texto branco. Por isso, no app instalado, a faixa sob a barra usa `--barra-status` (`#0D0F1A`) nos dois temas.
  - O mapa escuro do Treino fica sem a faixa.
  - `theme-color` tem duas metas com `media`: escuro `#0D0F1A` e claro `#F6F7FB`. O JS (`app/theme.ts`) troca as duas quando o tema é escolhido à mão.

## Acessibilidade

- Contraste de texto de 4,5:1 ou mais (os tokens já passam).
- Alvos de toque de no mínimo 44×44 px.
- Botões e links de verdade (`<button>`, `<a>`), `<label>` em todo campo, `aria-label` em botão só de ícone.
- Anel de foco: 2 px sólido `--ciano`, afastado 2 px do elemento.
- Navegação completa por teclado no computador, inclusive o play, o gráfico ligado ao mapa (setas movem o cursor) e a gaveta.
- Respeite `prefers-reduced-motion`: o replay continua manual, sem animações decorativas.
- O mapa tem descrição textual (distância, sentido, largada/chegada) para leitor de tela.

## Voz e texto

- "Você", frases curtas, sem exclamação.
- Título é conclusão, não tema: "Deriva baixa: base sólida".
- Números brasileiros: 21,20 km · 7:39/km · 2h42 · 167 bpm · +2,6%.
- Sigla técnica sempre com explicação na Folha do KPI.
- "Todos", na privacidade, significa os membros da comunidade do app, nunca a internet aberta.

## O que não fazer

- Não mudar fórmulas, limiares, arredondamentos ou o formato de `apex.analise.v1`.
- Não usar emoji, degradê, sombra pesada, glassmorphism exagerado nem mais de uma cor de ação por tela.
- Não usar `tile.openstreetmap.org` diretamente: o mapa é MapLibre + OpenFreeMap, e "Só trajeto" funciona sem internet.
- Não depender do GPS das fotos: o iPhone remove a localização. Encaixe pela data e hora da foto (EXIF `DateTimeOriginal`) comparadas com o .FIT.
- Não mostrar o início e o fim do trajeto quando a privacidade do treino mandar ocultar, em nenhum card ou tela compartilhada.
- Não mexer no app React da raiz (`src/`, publicado em `/apexrun/`) nem nas migrações existentes do Supabase. Migrações novas só em arquivos novos, depois que o Lucas aprovar o SQL.
- Não editar o `engine.mjs` à mão nem copiar fórmulas dele para outros módulos.
- Não chamar a API do Garmin pelo navegador, não guardar a chave no aparelho e não registrar a chave em log.
- Não implementar cálculo novo sem a fórmula aprovada, nem copiar valores de exemplo das telas de design.
- Não esticar nem cortar um percurso sem avisar, não aceitar altimetria digitada sem a fonte e não inventar clima: além de 16 dias, o plano usa o clima padrão.
- Não mostrar o mapa de calor nem os segmentos em card, compartilhamento ou sincronização com outras pessoas: eles revelam onde o Lucas mora.
- Não calcular "tempo ajustado" de pedal: as fórmulas de inclinação e clima do app são de corrida.
- Não contar sequência de dias seguidos: a consistência é por semana, e o descanso conta a favor.
- Não salvar nada do que veio da frase falada sem o Lucas conferir, e não ligar sozinho o "Dor articular ou suspeita de lesão".
- Não dar diagnóstico nem alerta de saúde a partir do mapa do corpo.
- Não mandar aviso no celular (push): os avisos ficam dentro do app.
- Não usar serviço de reconhecimento de voz: a voz vem do microfone do teclado do aparelho.
- Não fazer commit ou push sem o Lucas pedir. Trabalhe em branch.
