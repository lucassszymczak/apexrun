# Fase 1 · Etapa 4 — Acabamento e os 15 critérios

Nenhum cálculo mudou. O formato de `apex.analise.v1` também não mudou.

## O que entrou

- **Funciona sem internet (PWA).**
  - **O que é:** um service worker, só para `/analise/`. É um arquivo que o navegador guarda e que serve o app quando não há internet.
  - **O que fica guardado:** tudo o que o app precisa para abrir — HTML, código, estilos, a fonte Outfit, ícones, o mapa "Só trajeto", o leitor de .FIT e o de fotos.
  - **Sem internet:** o app abre direto; os dados continuam no aparelho, como sempre.
  - **Com internet:** a página é sempre buscada de novo, então uma versão nova chega na próxima abertura.
  - **O que fica de fora:** o app da raiz (`/apexrun/`) e a versão antiga (`/analise-v1/`) não passam por ele. Clima, sync, mapa de ruas e OCR do plano continuam precisando de internet.
- **A fonte carrega antes do texto.** Assim nada "pula" na tela quando a Outfit chega; a Maratona tinha esse problema.
- **Acessibilidade:**
  - rótulo em todos os campos de arquivo;
  - links dentro de frases sublinhados;
  - selos das zonas na Maratona com texto legível (a cor fica na borda).
- **Treino no computador:**
  - "Compartilhar", o escudo de privacidade e o menu ficam juntos no topo do painel, como no design.
  - Quando a tela já tem a sua ação magenta, o "Importar treino" do trilho vira contorno ciano. Assim fica só uma ação magenta por tela.
- **Compartilhar no computador:** a prévia do card é maior.
- **Testes novos:**
  - `npm run test:offline`: abre o app, corta a internet e reabre 5 telas.
  - No teste de fumaça:
    - navegação só por teclado no computador;
    - anel de foco em todas as paradas;
    - setas no gráfico;
    - movimento reduzido;
    - uma ação magenta por tela nas 22 rotas.

## Lighthouse (celular, com a lentidão simulada do próprio Lighthouse)

Medido no build publicado, servido aqui na máquina, em 15 telas, com os dados de exemplo:

| Tela | Desempenho | Acessibilidade | Boas práticas |
|---|---|---|---|
| Hoje, Treinos, Treino, Compartilhar, Importar, Progresso, Sistema (Carga), Mais, Maratona, Relatório, Recuperação, Força, Livro, Configurações, Coach | 97 | 100 | 100 |

A meta era desempenho de 80 ou mais, acessibilidade de 95 ou mais e boas práticas de 90 ou mais. Todas as telas passaram.

## Os 15 critérios da Fase 1

| # | Critério | Situação | Como foi verificado |
|---|---|---|---|
| 1 | Testes atuais passam sem alteração | ok | 6 `analise/*.test.mjs` + `npm run test:analise` (9 arquivos) + `npm test` (57) |
| 2 | Golden master, no exemplo e no seu backup | ok | `golden.test.mjs`: 135/135 no mesmo navegador. Nas telas, a diferença são só os 2 treinos de km corrigido, a seu pedido. |
| 3 | Aparelho que já usava mostra tudo, sem importar; sync continua | ok | Teste de fumaça; a sync usa o mesmo código |
| 4 | Backup automático no IndexedDB e download | ok | Teste de fumaça (cópia idêntica byte a byte) |
| 5 | Trajeto colorido, marcos de km, largada e chegada; "Só trajeto" offline | ok | Teste de fumaça sem rede + teste offline do build |
| 6 | Play ~10 s; gráfico ↔ mapa | ok | 10,1 s; gráfico e toque no mapa |
| 7 | 4 modos de cor e legenda; inclinação em 5 faixas | ok | Teste de fumaça |
| 8 | Fotos no ponto certo; "Fora do percurso" | ok | Erro de 0 pontos (máximo permitido: 1). **Testado com fotos geradas aqui, não com fotos reais suas.** |
| 9 | "Ocultar · 500 m": nenhum ponto a menos de 500 m | ok | Teste automático (sintético + seus 3 .FIT) e no navegador (ponto mais perto: 549 m) |
| 10 | Stories 1080×1920 e Feed 1080×1350; menu nativo ou download | ok* | Tamanhos medidos no PNG; menu simulado. *Confira no seu iPhone. |
| 11 | Sem GPS e treino antigo sem trajeto | ok | Teste de fumaça |
| 12 | Sem emoji nem faixa rolante, Outfit, Tabler, uma ação magenta, tokens | ok | Teste de fumaça em todas as rotas (emoji; magenta no computador) |
| 13 | Lighthouse ≥ 80 / 95 / 90 | ok | Tabela acima |
| 14 | Ícones, favicon, manifest, título, `theme-color` | ok | Desde a Etapa 1 |
| 15 | Telas batem com `design/telas/` (390 e 1440 px) | ok, com diferenças pequenas | Prints comparados com os designs. Diferenças abaixo. |

### Diferenças em relação ao design (critério 15)

- **Treino no computador:**
  - **Números do painel:** aparecem em linha (distância, pace, FC), como no celular. O design usa blocos maiores.
  - **Topo do mapa:** mantém o botão voltar.
- **Card de compartilhar:**
  - não tem o círculo da zona escondida (decisão da Etapa 3);
  - o modelo Mapa não tem ruas.
- **Fotos no mapa:** os quadradinhos ficam no ponto exato, sem a linha que os liga ao trajeto no design.

## Pontos em aberto

1. **Remover `/analise-v1/`** (a versão antiga): fica no ar até você dar o OK. Sugiro esperar uns dias usando a nova.
2. **No seu iPhone**, depois de publicar, confira três coisas:
   - o menu de compartilhar abre;
   - o app abre em modo avião;
   - o "Adicionar à Tela de Início" mostra o ícone novo.
3. **Publicação:** o site só atualiza quando esta branch entrar na `main`. Me peça o pull request quando quiser.
