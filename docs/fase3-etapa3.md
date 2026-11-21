# Fase 3 · Etapa 3 — Mapa de calor

Regra aprovada em 21/11 (`docs/fase3-formulas.md`, item 1).

## O que entrou

- **Módulo `analise/calor.mjs`** (puro, com `calor.test.mjs`, 23 testes):
  - quadrículas de 25 m numa grade única para o mundo todo, sem nenhuma coordenada fixa no código;
  - o trajeto é preenchido a cada 5 m;
  - cada treino conta uma vez por quadrícula (vaivém);
  - faixas 1–2, 3–5, 6–10, 11–19 e 20 ou mais;
  - "km de ruas diferentes" = quadrículas × 25 m;
  - ao tocar numa rua, o app pega a quadrícula mais perto e as vizinhas com exatamente os mesmos treinos.
- **Tela Mapa de calor** (Progresso › Mapa de calor), em tela cheia como o Treino:
  - Corrida ou Pedal, nunca misturados;
  - período: 12 meses, Ciclo atual ou Tudo;
  - botão para mostrar ou esconder as ruas no fundo. Sem internet, o app usa o desenho sem fundo e avisa;
  - legenda "1 vez … 20 vezes ou mais" e o selo "Só você vê";
  - gaveta com "N corridas · cerca de X km de ruas diferentes";
  - rua tocada: comprimento, passagens, os 2 treinos mais recentes e "Ver os N treinos", com link para cada um;
  - treinos sem trajeto: "N corridas sem trajeto neste aparelho ficaram de fora", com "Buscar trajetos antigos" quando o Garmin está conectado;
  - no computador, mapa grande e painel fixo à direita.
- **Trajetos do outro aparelho:** ao abrir o mapa, o app baixa do servidor a versão leve dos treinos que faltam neste aparelho, uma vez por sessão. É o mesmo dado que já sincroniza.
- **Progresso:** card "Mapa de calor" com o selo "Só você vê".
- **Livro de fórmulas:** verbete "Mapa de calor" na categoria "Evolução".

## Privacidade

- O mapa é calculado no aparelho, só em memória.
- Nada é gravado em `apex.analise.v1`, nada sincroniza e nada vai para cards ou compartilhamento.
- O teste confere que:
  - o estado salvo fica igual depois de abrir o mapa;
  - nenhuma chave nova aparece no aparelho;
  - nenhuma chamada sai para servidor de dados (só o mapa de ruas).

## Conferência com os seus trajetos (servidor, 21/11)

| Recorte | Treinos | Ruas | 1–2 / 3–5 / 6–10 / 11–19 / 20+ |
|---|---|---|---|
| Corrida, 12 meses | 28 (1 sem trajeto) | cerca de 84 km | 2.706 / 517 / 145 / 0 / 0 |
| Corrida, tudo | 108 | cerca de 202 km | 5.280 / 1.493 / 670 / 431 / 193 |
| Pedal, tudo | 25 | cerca de 107 km | 3.187 / 725 / 320 / 60 / 0 |

- A tabela aprovada dizia 85, 203 e 107 km. A pequena diferença vem da grade, que agora é a mesma para o mundo todo. O protótipo da Etapa 1 usava uma latitude fixa da sua região, e isso não pode ficar no código.
- **Desempenho:** juntar 108 corridas e montar as linhas leva cerca de 0,1 s. O Web Worker não foi necessário.

## Testes

| Teste | Resultado |
|---|---|
| 6 testes do motor | todos passam |
| `test:analise` (16 arquivos, com o novo `calor.test`) | todos passam |
| `npm test` · `test:app` · `test:offline` · `test:garmin` | 82 · 81 · 10 · 24 |
| `consistencia-app` · `tracks-app` · `leitura-app` · `fase4-telas` | 29 · 11 · 28 · 10 |
| `compare-views` | 100% |
| **Novo `scripts/calor-app.mjs`** | **28** |

- `engine.mjs` sem diferença. Nenhum teste existente foi alterado.
- O `calor-app` usa trajetos sintéticos num lugar fictício.

## Pendência para o Acabamento (Etapa 6)

- Escolher uma rua pelo teclado no computador. Hoje é só pelo toque ou pelo mouse; a tela já tem a descrição em texto para leitor de tela.
