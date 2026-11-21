# Fase 5 · Etapa 4 — Resumo pós-treino e Progresso › Corpo

Regras aprovadas em 21/11 (`docs/fase5-formulas.md`, itens 3 e 4).

## O que entrou

### Resumo pós-treino

- **Módulo `analise/resumo.mjs`** (puro, com `resumo.test.mjs`, 16 testes). "O que mudou", nesta ordem e só o que mudou:
  1. recorde pessoal ou melhor do ciclo, numa linha;
  2. top 3 num segmento (até 2 linhas);
  3. a semana que ficou consistente com este treino;
  4. forma, só ao entrar ou sair dos extremos;
  5. o equipamento.

  O título segue a prioridade aprovada. Tudo vem dos módulos de origem: os selos da Fase 2, os segmentos e a consistência da Fase 3, a forma do motor e os equipamentos.
- **Com os seus treinos:**
  - 19/11: "Intervalado com o melhor do ciclo nos 5 km" e "Melhor do ciclo em 4 distâncias: 400 m, 800 m, 1 km e 5 km";
  - 14/11: "Longão com recorde pessoal nos 10 km" e a semana consistente;
  - 17/11: nenhuma mudança.

  Como na tabela aprovada.
- **Tela:**
  - abre ao salvar um treino novo e ao completar um treino do Garmin;
  - mostra "Treino salvo", o título-conclusão, a linha do treino (tipo, data, km e "do Garmin") e a história do treino que já existe;
  - "O que mudou" em linhas com ícone num círculo de 32 px: losango violeta (recorde e seu melhor no segmento), check `--ok` (semana), seta `--ciano` (equipamento; `--atencao` a partir de 90%). Cada linha leva ao lugar certo;
  - sem mudanças: "Nada mudou nos seus números com este treino.";
  - **ações:** "Ver o treino" (principal) e "Compartilhar". O X volta ao Hoje.
- **Endereço:** `#/treino/<id>/resumo`, para o teste antigo do Garmin, que espera o endereço do treino, seguir passando sem mudança.
- **Ao salvar:**
  - editar um treino salvo continua voltando ao treino;
  - a importação de .FIT pelo "+" também continua indo direto ao treino. É o fluxo que os testes antigos cobrem; se quiser o resumo ali também, é uma troca pequena.
- **Desempenho:** abre **139 ms** depois de tocar em salvar (meta: 300 ms).

### Progresso › Corpo

- **Módulo `analise/corpo.mjs`** (puro, com `corpo.test.mjs`, 6 testes):
  - **treinos registrados:** os do período salvos com o mapa do corpo, mesmo sem dor marcada;
  - **vezes por região:** dor acima de 0;
  - **faixas:** 1–2, 3–5, 6 ou mais.
- **Tela:**
  - período em 30 dias, 90 dias ou Ciclo;
  - título-conclusão ("A canela esquerda foi a que mais doeu: N de M treinos.");
  - o mapa colorido pela frequência, com o número dentro, e a legenda em palavras;
  - **tocar numa região:** a linha do tempo da intensidade e os últimos registros, com link para o treino;
  - **rodapé fixo:** "Registros só dos dias de treino. O app mostra o padrão; não faz diagnóstico.". Nenhum alerta.
- **Progresso:** card "Corpo".
- **Dados:** daqui em diante, todo treino salvo pelo formulário guarda `dorRegioes`, mesmo vazio ("registrado, sem dor"), para a contagem ficar certa. Treinos antigos continuam sem o campo até você editá-los.
- **Livro de fórmulas:** "O que mudou" e "Corpo (frequência de dor)".

## Testes

| Teste | Resultado |
|---|---|
| 6 testes do motor | todos passam |
| `test:analise` (22 arquivos, com `resumo.test` e `corpo.test`; inclui o golden) | todos passam |
| `npm test` · `test:app` · `test:offline` · `test:garmin` | 82 · 81 · 10 · 24 |
| `fala-app` · `equipamentos-app` e todas as suítes das Fases 3 e 4 | todas passam |
| `compare-views` | 100% |
| **Novo `scripts/resumo-app.mjs`** | **21** |

- `engine.mjs` sem diferença. Nenhum teste existente foi alterado.
- A busca pelos valores de exemplo do design não encontra nada no código.
