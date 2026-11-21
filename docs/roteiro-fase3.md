# Apex Performance — Roteiro da Fase 3 · Evolução (aprovado em 21/11/2026)

Projeto pessoal · 21/11/2026 · base: Fase 4 publicada (PRs #56 a #62)

## Decisões do briefing (21/11)
- **Mapa de calor:** só o Lucas vê. Ele não aparece em cards, compartilhamento nem comunidade.
- **Segmentos:** o app encontra sozinho os trechos repetidos.
- **Fantasma:** o Lucas escolhe contra qual treino corre e pode desligar. Padrão: sem fantasma.
- **Consistência:** contada por semanas, e o descanso conta a favor.
- **Pedais:** entram no mapa de calor e nos segmentos, sempre separados da corrida.

## Telas

### 1. Progresso › Mapa de calor (nova)
- **O que mostra:**
  - mapa em tela cheia (Ruas / Só trajeto) com as ruas acesas pela frequência: quanto mais vezes você passou, mais forte;
  - legenda com palavras ("1 vez … 20 vezes ou mais").
- **Filtros:**
  - modalidade: Corrida / Pedal;
  - período: 12 meses / Ciclo atual / Tudo.
- **Resumo:** "N treinos · X km de ruas diferentes". Os treinos sem trajeto ficam de fora, com aviso e "Buscar trajetos antigos" quando o Garmin estiver conectado.
- **Tocar numa rua:** mostra os treinos que passaram por ali.
- **Selo fixo:** "Só você vê".
- **Ação principal:** nenhuma; é uma tela para olhar.

### 2. Progresso › Segmentos (nova)
- **Lista:**
  - cada segmento tem o desenho do trecho, distância, inclinação média, quantas vezes você passou, o seu melhor tempo e a tendência;
  - nome automático ("Segmento 4 · 1,2 km · +18 m"), que você pode renomear;
  - corrida e pedal em abas separadas.
- **Detalhe:**
  - mapa com o trecho destacado;
  - ranking das suas passagens: data, tempo, tempo ajustado e FC;
  - gráfico de linha com a evolução do tempo ajustado;
  - título-conclusão (ex.: "Você está 18 s mais rápido que em agosto").

### 3. Treino › Segmentos deste treino (nova seção)
- Lista os segmentos do treino, com a posição no ranking ("2º de 7", "melhor ajustado").
- Tocar destaca o trecho no mapa.

### 4. Treino › Replay com fantasma (ajuste)
- **Botão "Fantasma"** ao lado do play. O padrão é "Sem fantasma".
- **Escolha do fantasma:**
  - lista dos treinos que fizeram o mesmo percurso, com "Seu melhor" e "Mais recente" no topo;
  - o resto, por data.
- **No replay:**
  - você em `--ciano`, o fantasma em contorno claro;
  - a diferença ao vivo, escrita: "12 s à frente" ou "8 s atrás".
- **No detalhe do segmento:** "Comparar no replay" abre já com as duas passagens escolhidas.

### 5. Progresso › Consistência (nova)
- **Título-conclusão:** "9 das últimas 12 semanas consistentes".
- **Grade de semanas:** últimas 26 no celular, 52 no computador. Cada semana é consistente, parcial ou vazia, sempre com ícone e palavra.
- **Tocar numa semana:** mostra os 7 dias (corrida, pedal, força, descanso), as horas e se a meta foi cumprida.
- **Sequência atual:** "6 semanas seguidas". Ela também aparece no Relatório semanal.

### Computador
- Mapa de calor grande.
- Segmentos em lista + detalhe lado a lado.
- Consistência com 52 semanas.

## Cálculos novos (você aprova antes de programar)

| Cálculo | O que você aprova |
|---|---|
| Mapa de calor | Tamanho da quadrícula da contagem, quantas passagens viram "forte" e como tratar o vaivém na mesma rua |
| Detecção de segmentos | Distância mínima, mínimo de passagens, sentido, tolerância do trajeto e como evitar segmentos repetidos |
| Tempo ajustado no segmento | Corrida: ajuste por inclinação (GAP) do motor + regra de clima da Fase 2 |
| Fantasma | Como alinhar os dois treinos (pela distância percorrida) e o quanto o percurso precisa coincidir para virar candidato |
| Semana consistente | A definição: por exemplo, cumprir ao menos 80% das horas da meta da semana e ter ao menos um dia de descanso. A meta vem do ciclo ou da média das suas últimas semanas |

**Ponto de atenção (pedal):** as fórmulas de ajuste por inclinação e por clima são de corrida. No pedal, a comparação dos segmentos fica só pelo tempo real, com o vento anotado, sem "tempo ajustado". Ajustar pedal de verdade pediria um medidor de potência.

## Jornadas
1. **Depois do treino:** Treino → "2º melhor no Segmento 4" → replay com o fantasma do seu melhor.
2. **Domingo:** Relatório semanal → "semana consistente · 6 seguidas" → Consistência.
3. **Curiosidade:** Progresso › Mapa de calor → Corrida ou Pedal → toca numa rua → treinos que passaram ali.
4. **Evolução:** Progresso › Segmentos → detalhe → a linha do tempo ajustado caindo.

## O que depende do Lucas
- Nada além dos treinos com trajeto. Quanto mais treinos antigos tiverem o trajeto (pelo "Buscar trajetos antigos"), mais completos ficam o mapa e os segmentos.
