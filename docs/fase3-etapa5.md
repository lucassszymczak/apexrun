# Fase 3 · Etapa 5 — Replay com fantasma

Regra aprovada em 21/11 (`docs/fase3-formulas.md`, item 5).

## O que entrou

- **Módulo `analise/fantasma.mjs`** (puro, com `fantasma.test.mjs`, 22 testes):
  - **candidato:**
    - mesma modalidade;
    - pelo menos 80% em comum **nos dois sentidos** (o seu percurso no corredor de 25 m do dele e o dele no seu);
    - distância até 10% diferente;
  - **ordem:** "Seu melhor" (menor tempo), "Mais recente" (data mais próxima) e os outros por data;
  - **alinhamento pela distância:** no seu km X, a diferença é o seu tempo menos o dele no km X. No fim, compara na menor das duas distâncias;
  - **textos:** "Fantasma 12 s à frente" (`--atencao`), "Você 8 s à frente" (`--ok`), "Você terminou X s atrás/à frente".
- **Treino › replay:**
  - **botão:** fica ao lado do play. O padrão é "Sem fantasma". Sem candidatos, mostra "Sem treinos parecidos", desativado;
  - **"Correr contra":** folha com Sem fantasma, Seu melhor, Mais recente e os outros, com data, tempo e distância;
  - **no mapa:** você em `--ciano` e o fantasma num círculo tracejado `--texto` com fundo a 18%. Ele anda no relógio do treino dele, nas duas versões do mapa (com e sem as ruas);
  - **legenda e diferença:** "você (data) · fantasma (data)" e a diferença ao vivo, que o leitor de tela anuncia;
  - **gravação:** a escolha não é gravada. Vale só enquanto a tela está aberta.
- **Segmento › "Comparar no replay":** abre o treino da passagem mais recente com o fantasma do seu melhor (ou do 2º, se a recente já for o melhor).
  - Os dois começam juntos no início da passagem.
  - A passagem fica destacada no mapa.
  - A diferença final é medida no fim do segmento.
- **Livro de fórmulas:** verbete "Fantasma".
- **Computador:** os chips de cor do mapa subiram para não ficar atrás da barra do replay, que agora tem a linha do fantasma.

## Com os seus treinos (servidor, 21/11)

- **Corrida de 19/11 (6,09 km):** 2 candidatos, como na aprovação.
  - **18/08 (6,02 km):** "Seu melhor".
  - **21/08 (6,01 km):** "Mais recente".
  - A cobertura deu 100% nos dois. Na aprovação era 96% e 94%, sem o corredor de 25 m; com o corredor, o erro do GPS deixa de contar.
- **No total:** 49 das 108 corridas com trajeto têm pelo menos um fantasma.

## Testes

| Teste | Resultado |
|---|---|
| 6 testes do motor | todos passam |
| `test:analise` (18 arquivos, com o novo `fantasma.test`) | todos passam |
| `npm test` · `test:app` · `test:offline` · `test:garmin` | 82 · 81 · 10 · 24 |
| `segmentos-app` · `calor-app` · `consistencia-app` · `tracks-app` · `leitura-app` | 25 · 28 · 29 · 11 · 28 |
| `fase4-telas` · `plano-app` · `ciclo-app` · `simulador-app` · `amanha-app` | 10 · 21 · 21 · 13 · 12 |
| `compare-views` | 100% |
| **Novo `scripts/fantasma-app.mjs`** | **20** |

- `engine.mjs` sem diferença. Nenhum teste existente foi alterado.
- O `fantasma-app` confere, entre outros pontos:
  - o padrão "Sem fantasma" e a ordem da lista;
  - que um percurso diferente com a mesma distância fica de fora;
  - a diferença no meio e no fim (igual ao módulo) e o marcador no mapa;
  - que nada é gravado;
  - "Sem treinos parecidos";
  - o "Comparar no replay";
  - o replay com movimento reduzido.

## Próxima etapa

Etapa 6: acabamento e os 10 critérios. Nela entra também a pendência da Etapa 3: escolher uma rua do mapa de calor pelo teclado.
