# Apex Performance — regras do projeto

App pessoal de análise de treinos (corrida e bike agora; natação depois), usado no celular e no computador. É publicado no GitHub Pages em `/apexrun/analise/`. Hoje é uma página HTML única (`analise/index.html`). A Fase 1 a reconstrói com a nova identidade, mapa do trajeto, replay, fotos, privacidade e cards de compartilhamento.

Fale com o Lucas em português do Brasil, de forma curta. Ele não é desenvolvedor: explique decisões técnicas em uma linha, sem jargão.

## Regra de ouro: os cálculos não mudam

- O motor de KPIs é o patrimônio do app: GAP, EF, decoupling, TRIMP, CTL/ATL/TSB, Pace-GAP@145, IMP, Riegel, prontidão e o resto. **Nenhuma fórmula, constante, limiar ou arredondamento muda na Fase 1.**
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

## Dados do usuário

- `localStorage` `apex.analise.v1` guarda todos os treinos e configurações. **O formato fica intacto.** Campos novos são opcionais e aditivos.
- `apex.analise.synccode` (código de sincronização) e `apex.theme` (tema) também ficam como estão.
- Antes de a nova versão gravar qualquer coisa, salve um backup completo de `apex.analise.v1` no IndexedDB, com data, e ofereça o download em Configurações › Dados.
- Dados pesados e novos (trajeto, séries por segundo reduzidas, miniaturas de fotos) vão para o IndexedDB, por id do treino, e não entram na sincronização na Fase 1.
- Nunca envie dado pessoal a servidor além do que já existe (sync opcional com Supabase e consulta de clima por coordenada e horário).
- Nunca faça commit de backups ou arquivos .FIT do Lucas: use `fixtures/privado/`, que fica no `.gitignore`.

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
| `--violeta` | #5B3FD0 | #5B3FD0 | Só no pico do símbolo |
| `--zona-1` | #A5F3FC | #0891B2 | FC Z1 |
| `--zona-2` | #22D3EE | #4C67D6 | FC Z2 |
| `--zona-3` | #8B7CF6 | #6D4BD8 | FC Z3 |
| `--zona-4` | #C24FC8 | #9A3DBD | FC Z4 |
| `--zona-5` | #E0337F | #B0226C | FC Z5 |
| `--ok` | #34D399 | #047857 | Estado bom |
| `--atencao` | #FBBF24 | #B45309 | Cautela |
| `--alerta` | #F87171 | #B91C1C | Risco |

Contrastes do tema claro: `#0E7490` sobre branco 5,4:1 e sobre `#EEF0F5` 4,7:1; branco sobre `#0E7490` 5,4:1. No escuro, `#0D0F1A` sobre `#22D3EE` 10,6:1. O `--ciano` claro (`#0891B2`) não passa de 4,5:1 com texto pequeno: por isso existe o `--ciano-forte`.

`design/tokens.css` já traz tudo isso pronto, nos dois temas (`[data-theme="dark"]` e `[data-theme="light"]`).

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
- **Card:** `--superficie`, raio 12 a 16, padding 16 a 20, sem sombra.
- **Gaveta do Treino (celular):** 3 alturas (recolhida, média e expandida), arrastável, com puxador de 36×4 em `--linha`. No computador, vira um painel fixo de 380 a 440 px à direita.
- **Folha do KPI:** abre ao tocar em qualquer número. Mostra nome, o que significa (1 linha), seu valor e faixa, confiança e "Ver no Livro de fórmulas".
- **Legenda de zonas:** sempre os 5 tons + os rótulos Z1 e Z5 (ou "lento/rápido", "descida/subida"). A cor nunca aparece sozinha.
- **Estados:** sempre ícone + palavra (`--ok`, `--atencao`, `--alerta`).
- **Navegação:** no celular, barra inferior com Hoje, Treinos, botão central "+" (círculo magenta de 52 px), Progresso e Mais. No computador, trilho lateral de 220 a 240 px com o logo, os mesmos destinos, os itens de "Mais" listados e o botão "Importar treino".

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
- Não mexer no app React da raiz (`src/`, publicado em `/apexrun/`) nem nas migrações do Supabase sem perguntar.
- Não fazer commit ou push sem o Lucas pedir. Trabalhe em branch.
