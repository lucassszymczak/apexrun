# Fase 1 · Etapa 1 — Fundação e telas atuais com a cara nova

## O que mudou

### Publicação

| Endereço | O que é |
|---|---|
| `/apexrun/analise/` | **App novo** (Vite + React + TypeScript). Mesma URL, então atalhos, PWA e `localStorage` continuam valendo. |
| `/apexrun/analise-v1/` | **App antigo**, intacto (só movido para `legacy/analise-v1/` com `git mv`). Plano B até o fim da Fase 1. |
| `/apexrun/` | App React da raiz: não foi tocado (`src/` sem alterações). |

O build gera as duas páginas sozinho: o Vite cria `dist/analise/` e o `postbuild` copia o legado para `dist/analise-v1/`, com as chaves do Supabase como antes. O workflow do GitHub Pages não mudou.

### Motor

- O app novo tira **todos os números** de `analise/engine.mjs`, cópia byte a byte da página antiga (decisão do Lucas em 20/11; registrada no `CLAUDE.md`).
- Nesta etapa entraram no motor, também por extração automática:
  - textos do Livro de fórmulas (`KPI_DOCS`, `EXTRA_DOCS`, `KPI_TODO`);
  - conteúdo de Força e canela;
  - tipos e parsing do plano da Maratona;
  - lição semanal do Relatório;
  - lógica pura da sincronização.
  
  Agora são 254 declarações.
- O extrator agora **recusa** puxar código de tela da página antiga. Um `mApplyParse` chegou a arrastar a interface inteira, e eu tirei.
- A lógica que existia só dentro dos `render*` antigos foi portada **copiando a expressão**, com o mesmo arredondamento. A prova está na comparação de telas, abaixo.

### Identidade

- Tokens de `design/tokens.css` (sem cor solta).
- Outfit 400/500 servida pelo app.
- Ícones Tabler.
- Símbolo oficial de `design/marca/`.
- Tema escuro (padrão), claro ou **automático**, na mesma chave `apex.theme`.
- **Saíram:** faixa rolante, todos os emojis e a aba Coach.
  - A Leitura do Coach agora está no Hoje, com "Ver leitura completa".
  - A Prontidão do dia do treino agora está no Treino.
- Ícones, favicon, `manifest`, `<title>` "Apex Performance", `apple-mobile-web-app-title` "Apex" e `theme-color` #0D0F1A trocados. Os ícones mantêm os mesmos nomes de arquivo.

### Navegação

- **Celular:** barra inferior com Hoje · Treinos · **+** · Progresso · Mais.
- **Computador (≥ 1024 px):** trilho lateral com logo, destinos, itens de Mais e o botão magenta "Importar treino".
- De 768 px em diante, o conteúdo ganha colunas.

### Backup automático

- Antes de o app novo gravar qualquer coisa, ele guarda no IndexedDB (`apex-performance` › `backups`) a **cópia exata** de `apex.analise.v1` (+ código de sync e tema), com data. Essa cópia nunca é apagada.
- Também guarda uma cópia por dia de uso (as 7 mais recentes).
- Download em **Mais › Configurações › Dados**. O arquivo baixado é aceito pelo "Importar JSON".

### Telas portadas, todas com o mesmo conteúdo

| Antes | Agora |
|---|---|
| Hoje | Hoje (layout aprovado em `Main` e `HojeDesktop`) |
| Coach | Hoje › Leitura do Coach (resumo) + "Ver leitura completa" |
| Treinos | Treinos: busca, filtros (modalidade, tipo, período), grupos por mês com totais |
| Detalhe do treino | Treino: resumo, splits (o km mais rápido em magenta), sistemas, carga e zonas, hidratação, condições, **Percepção** e **Qualidade dos dados** |
| Modal de treino / .FIT | **+** › Importar → conferência e completar (layout de `Importar.dc.html`) · Editar pelo menu do Treino |
| Progresso + 6 sistemas | Progresso: perfil, **Foco atual**, sistemas com mini-tendência, recordes e linha do tempo; detalhe de cada sistema |
| Maratona (Ciclo) | Mais › Maratona (ação principal: "Lançar treinos da semana") |
| Relatório | Mais › Relatório semanal |
| Recuperação | Mais › Recuperação (registrar o dia, Apple Saúde) |
| Força | Mais › Força e canela |
| KPIs | Mais › Livro de fórmulas (com busca) + **Folha do KPI** ao tocar em qualquer número |
| Config | Mais › Configurações |

## Verificações

| Verificação | Resultado |
|---|---|
| `node analise/*.test.mjs` (`npm run test:analise`) | 9 arquivos verdes; os 6 originais sem alteração |
| `npm test` (Vitest) | 19/19 |
| `npm run typecheck` (raiz + app novo) | ok |
| Golden do motor (antigo × novo no mesmo Chromium) | idêntico valor a valor (seed e sintético) |
| **Comparação de telas** (`npm run compare:views`) | ver abaixo |
| **Teste de fumaça** (`npm run test:app`) | 36/36 (detalhe abaixo) |
| JS inicial do app novo | ~152 KB gzip (limite 250 KB); o leitor de .FIT só carrega ao importar |

### Comparação de telas

O comparador extrai os números de cada tela do app antigo (golden de telas, sem os eixos de gráfico e sem datas) e confere se cada um aparece na tela nova correspondente, na mesma data e com os mesmos dados.

- **Sintético:** 1892/1892 (100%).
- **Seed:** 508/511 (99%). A diferença é uma decisão de design: o card "Último treino" do Hoje agora mostra o último **treino** de qualquer modalidade, como em `Main.dc.html` (no seed, o Pedal outdoor). O app antigo mostrava a última **corrida** (Teste 5K: 6:20/km, EF 15,4).

### Teste de fumaça (36/36)

Com dados no formato do app antigo, no Chromium e sem rede:
- as 21 rotas abrem sem erro e sem emoji;
- os 27 treinos aparecem sem importar nada;
- o backup da migração existe e é **idêntico byte a byte** ao `localStorage`;
- `apex.analise.v1` mantém as mesmas chaves depois de salvar;
- um .FIT gerado na hora é lido offline, salvo com o RPE e abre o Treino;
- a Folha do KPI abre e leva ao item certo do Livro.

## Critérios da Fase 1 já atendidos

| # | Critério | Situação |
|---|---|---|
| 1 | Testes atuais passam sem alteração | ok |
| 2 | Golden master (seed + backup) | ok para seed e sintético; **backup real pendente** (`fixtures/privado/backup.json`) |
| 3 | Abrir num aparelho que já usava mostra tudo, sem importar; sync continua | ok (teste de fumaça); a sync usa o mesmo código e o mesmo merge |
| 4 | Backup automático no IndexedDB e download | ok |
| 12 | Sem emoji, sem faixa rolante, Outfit, Tabler, uma ação magenta por tela, tokens | ok (verificado em todas as rotas) |
| 14 | Ícones, favicon, manifest, título e `theme-color` | ok |

Os critérios 5–11 (mapa, replay, fotos, privacidade, cards) são das Etapas 2–3. Os critérios 13 e 15 (Lighthouse e paridade visual final) são da Etapa 4.

## Mudanças de texto e apresentação

Nenhuma dessas muda um cálculo.

- **Números brasileiros:** vírgula decimal (`EF 0,0201`, `6,2 h`), com o mesmo arredondamento.
- **Rótulos em português:** "Cautela", "Pronto", "Recuperar" no lugar de "Caution", "Ready"… "Readiness" virou "Prontidão" nos textos do Coach.
- **Dor muscular:** a tela antiga dizia "/5", mas o formulário usa 0–10. Agora o app mostra "3 de 10". O limiar (≥ 3) não mudou. **Confirme se o certo é 0–10.**
- **Tipo `teste_motor`:** aparecia cru na lista antiga. Agora aparece "Teste do Motor".
- **Foco atual (Progresso):** é novo, pedido pelo roteiro. Usa só funções do motor (`impBaseline`, `impIndex`, `cadenceAtPace`, `paceRefSuggest`).
  - O IMP considera só sessões em clima padrão com confiança Moderada ou Alta, como descreve o Livro de fórmulas. **A página antiga nunca exibiu o IMP**, então essa regra de seleção é a leitura do texto do Livro. **Confirme.**
- **Força e canela:** é só leitura, porque o app atual não registra sessão de força (o [VERIFICAR] do roteiro).
- **Mapa e Privacidade padrão:** ainda não aparecem nas Configurações. Entram com os recursos, nas Etapas 2 e 3.
- **Botão Compartilhar do Treino:** entra na Etapa 3. Até lá, o Treino não tem botão magenta.

## Pontos em aberto

1. **Backup real** em `fixtures/privado/backup.json`. Depois, `npm run golden:capture backup && node analise/golden.test.mjs && node scripts/compare-views.mjs backup`.
2. Confirmar a escala da dor muscular (0–10) e a regra do IMP (acima).
3. O OCR do plano (foto do treino) continua carregando o Tesseract do CDN, como antes, e precisa de internet. O resto abre offline a partir da Etapa 4 (service worker).
