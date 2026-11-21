# Fase 5 · Etapa 3 — "Diga como foi" e mapa do corpo

Regras aprovadas em 21/11 (`docs/fase5-formulas.md`, itens 1 e 2, opção a).

## O que entrou

- **Módulo `analise/fala.mjs`** (puro, com `fala.test.mjs`, 33 testes):
  - lê a frase com as regras aprovadas (números escritos ou por extenso, "e meia", 7h30, RPE, sono, 19 regiões com sinônimos, lado, "nas duas", equipamento pelo nome);
  - região sem lado ou sem intensidade fica **pendente**;
  - "dor articular" só gera aviso;
  - **as 24 frases da tabela aprovada dão exatamente o resultado esperado;**
  - entender a frase leva **0,06 ms** (meta: 20 ms).
- **No formulário do treino** (Completar, novo treino e edição), no topo:
  - **"Diga como foi":**
    - campo de texto com a dica do microfone do teclado e o botão "Preencher pela frase";
    - a frase só é lida ao tocar no botão;
    - "Entendi: …" em `aria-live`, com as pendências e os avisos embaixo;
    - **nada é salvo** até "Salvar treino";
  - **campos preenchidos pela frase:** ganham contorno `--ciano-forte` e "· pela fala" (RPE, sono, "Onde doeu?"). O tênis citado é escolhido;
  - **"Onde doeu?"** (mapa do corpo):
    - frente e costas com "D" e "E" e as 19 regiões da tela. Cada uma é um `<button>` com nome, lado e dor ("Canela esquerda, dor 3");
    - tocar seleciona, e "−" e "+" (44 px) ajustam de 0 a 10. Voltar a 0 desmarca;
    - cores: 1 a 3 em `--atencao` a 50%, 4 a 6 em `--atencao`, 7 a 10 em `--alerta`, com o número dentro;
    - dá para usar só pela lista ("Ou escolha a região na lista") e pelo teclado;
    - "Marcadas: …" em palavras;
    - rodapé: "Registro só do dia de treino. O app mostra o padrão; não faz diagnóstico.";
  - **pendências da frase:** "Falta o lado: canela 3" com os botões "Esquerda" e "Direita", ou "Marcar no mapa";
  - **dor muscular (regra a):** vem com a maior dor do mapa, com "· do mapa do corpo", só se o campo estava vazio.
    - Se você digitar no campo, o mapa para de mudar o valor.
    - Treinos antigos com dor muscular não mudam.
  - **"Dor articular ou suspeita de lesão":** continua só manual. A frase e o mapa nunca ligam o interruptor.
  - **Computador:** duas colunas, com a voz e a percepção à esquerda e o mapa do corpo à direita.
- **Dados (aditivos):**
  - `dorRegioes` no treino (lista de { região, lado, intensidade }), só com as regiões acima de 0. Sincroniza com o treino (testado com a junção do motor);
  - treinos antigos continuam sem o campo e abrem normalmente.
- **Livro de fórmulas:** verbetes "Diga como foi" e "Dor muscular e mapa do corpo".

## Testes

| Teste | Resultado |
|---|---|
| 6 testes do motor | todos passam |
| `test:analise` (20 arquivos, com o novo `fala.test`; inclui o golden master) | todos passam |
| `npm test` · `test:app` · `test:offline` · `test:garmin` | 82 · 81 · 10 · 24 |
| `equipamentos-app` e todas as suítes das Fases 3 e 4 | todas passam |
| `compare-views` | 100% |
| **Novo `scripts/fala-app.mjs`** | **24** |

- `engine.mjs` sem diferença. Nenhum teste existente foi alterado.
- A prontidão dos treinos já salvos não muda: o golden passa.

## Para você testar no iPhone

1. Depois de um treino, abra "Completar treino".
2. Toque no campo "Diga como foi" e no microfone do teclado.
3. Fale do seu jeito, por exemplo: "RPE 7, dormi 7 e meia, canela esquerda 3".
4. Toque em "Preencher pela frase" e confira.
5. **Me mande o texto que apareceu no campo.** Ajusto o vocabulário com o que o seu iPhone escreve de verdade.

## Observação

- O mapa tem regiões pequenas (pé e Aquiles), de 16 px de altura no desenho, para não sobrepor as vizinhas. Para elas, a lista "Ou escolha a região na lista" garante o alvo de 44 px.
