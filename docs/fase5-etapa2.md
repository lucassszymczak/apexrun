# Fase 5 · Etapa 2 — Equipamentos

Regra aprovada em 21/11 (`docs/fase5-formulas.md`, item 5), com as decisões da Etapa 0: tênis com nome, km atuais e km limite digitados; bike sem aviso.

## O que entrou

- **Módulo `analise/equipamentos.mjs`** (puro, com `equipamentos.test.mjs`, 25 testes):
  - **tênis:** km atuais + a distância das corridas salvas com ele depois do cadastro. A esteira conta; o pedal e as corridas sem tênis, não;
  - **estado em relação ao limite:**
    - até 90%: normal;
    - a partir de 90%: atenção;
    - de 100% em diante: limite;
    - sem limite: nenhum aviso;
  - **escolha padrão:** com um item ativo, ele; com mais de um, o último usado na modalidade; sem uso, o mais novo;
  - **bike:** pneus e corrente com os km dos pedais desde a última troca ou desde o cadastro. "Troquei" guarda a data;
    - o dia da troca fica com a peça antiga, porque a troca costuma ser registrada depois do pedal do dia;
  - **treinos sem distância** somam 0. Nada de km é guardado: editar ou excluir um treino já corrige a conta.
- **Mais › Equipamentos** (também no trilho do computador):
  - **tênis:**
    - card com nome, "desde", "N de M km", barra (`--ciano` até 90%, `--atencao` daí em diante) e o aviso em palavras;
    - "Corridas com ele", "Editar" e "Aposentar" (pede confirmação);
  - **"Novo par"** (ação principal): nome, km atuais e km limite (600 por padrão; em branco, sem aviso);
  - **bike:** "Cadastrar a bike". Pneus e corrente com "km desde a troca" (ou "desde o cadastro") e "Troquei" (pede confirmação). Sem barra nem aviso;
  - **"Aposentados e trocas anteriores":** os pares aposentados, com km e datas, e as trocas antigas.
- **Formulário do treino (Completar, novo treino e edição):**
  - bloco "Equipamento" com os itens ativos da modalidade (tênis na corrida, bike no pedal) e "Sem tênis" / "Sem bike";
  - **escolha automática:** com um item só, ele já vem escolhido. Ao trocar Corrida/Bike, a escolha acompanha;
  - **tênis:** barra e "N de M km com este treino", com a linha em `--atencao` a partir de 90%;
  - **bike:** "Pneus N km · Corrente N km desde a troca, com este treino".
  - Sem nenhum cadastrado, aparece o link "Cadastrar um tênis".
- **Hoje:** quando um tênis ativo chega ao limite, aparece o card "<nome> passou dos M km · N km. Hora de trocar o par." com "Ver equipamentos". Ele some ao aposentar o par ou ao aumentar o limite.
- **Dados (aditivos):**
  - catálogo em `athlete.equipamentos`;
  - em cada treino, `gearId` só quando há equipamento escolhido;
  - treinos antigos continuam sem o campo, e editar um deles não atribui nada sozinho;
  - o formulário passa a preservar `gearId` e `dorRegioes` ao editar (o campo de dor entra na Etapa 3).
- **Livro de fórmulas:** categoria nova "Rotina", com o verbete "Km do equipamento".

## Testes

| Teste | Resultado |
|---|---|
| 6 testes do motor | todos passam |
| `test:analise` (19 arquivos, com o novo `equipamentos.test`) | todos passam |
| `npm test` · `test:app` · `test:offline` · `test:garmin` | 82 · 81 · 10 · 24 |
| Fase 3: `fase3-telas` · `fantasma-app` · `segmentos-app` · `calor-app` · `consistencia-app` | 18 · 20 · 25 · 28 · 29 |
| `tracks-app` · `leitura-app` · Fase 4 (`fase4-telas`, `plano-app`, `ciclo-app`, `simulador-app`, `amanha-app`) | 11 · 28 · 10 · 21 · 21 · 13 · 12 |
| `compare-views` | 100% |
| **Novo `scripts/equipamentos-app.mjs`** | **24** |

- `engine.mjs` sem diferença. Nenhum teste existente foi alterado.
- **Valores de exemplo do design:** a busca por "625 km", "5:27:12", "Tênis de treino" e "518 de 600" não encontra nada no código.

## Pendências

- Cadastre o seu tênis em Mais › Equipamentos (nome, km atuais e limite). Daí em diante, as corridas somam sozinhas.
- Se quiser, cadastre a bike para contar os km de pneus e corrente.
