# Apex Performance — Roteiro da Fase 4 · Planejamento (aprovado em 20/11/2026)

Projeto pessoal · 20/11/2026 · base: Fase 2 publicada (PRs #50 a #55)

## Decisões do briefing (20/11)
- A Fase 4 vem antes da Fase 3.
- **Percurso:** ainda não há arquivo. O app aceita 3 caminhos, do mais confiável para o menos confiável.
- **Meta e estratégia:** escolhidas ao definir o ciclo.
- **Janela de treino:** das 5h às 10h.
- **Plano no dia da prova:** no celular.

## Telas

### 1. Ciclo de prova › Editar ciclo (ajuste)
- **Objetivo:** Terminar bem | Tempo-alvo (h:mm).
- **Estratégia:** Esforço constante | Segunda metade mais rápida.
- **Percurso:** "Adicionar percurso".
- **Ação principal:** Salvar ciclo.

### 2. Percurso da prova (nova)
- **O que mostra:**
  - mapa (Ruas / Só trajeto) e perfil de altimetria;
  - resumo: distância, subida e descida acumuladas (D+ e D−) e o trecho mais duro;
  - fonte e confiança, sempre visíveis.
- **3 caminhos para o percurso:**
  1. **Arquivo oficial:** GPX da prova ou percurso do Garmin Connect (se a API permitir; a confirmar). Confiança Alta.
  2. **Reconhecimento gravado:** caminhada ou bike no percurso, em até 4 partes, que o app junta na ordem. Confiança Alta ou Moderada.
  3. **Altimetria digitada:** subida e descida de cada km, copiadas de uma fonte oficial que fica registrada. Confiança Baixa.
- **Se a distância diferir mais de 2% da oficial:** o app avisa e não estica o percurso sem avisar.
- **Ação principal:** Importar percurso.

### 3. Plano de prova (nova, dentro do Ciclo de prova)
- **Título-conclusão:** por exemplo, "Mire 6:45/km no plano; do km 18 ao 22, 7:05/km".
- **Chips:** objetivo, estratégia e clima.
- **Perfil de altimetria** com o pace alvo de cada km.
- **Tabela:** km · inclinação · pace alvo · tempo acumulado, em blocos de 5 km, com a meia maratona e o km 30 destacados.
- **Clima:**
  - até 16 dias antes da prova, usa o clima padrão;
  - depois, usa a previsão da hora da largada, pela regra temperatura + orvalho aprovada na Fase 2.
- **Ação principal:** Salvar no celular. Gera uma imagem 9:16 do plano para a tela de bloqueio ou para o app Fotos. A tela do plano também abre sem internet.
- **Sem percurso:** o plano sai só por ritmo, com aviso.

### 4. Simulador de meta (substitui "Estimativa de prova")
- **Título-conclusão:** "Hoje, seu tempo realista é de X a Y".
- **Como chega lá:** a previsão de Riegel, que já existe, a partir dos melhores esforços do ciclo; depois, o custo do percurso e, por fim, o clima.
- **Controles:**
  - tempo-alvo: mostra o pace necessário no plano e a diferença para o tempo realista;
  - clima: padrão, quente e úmido, ou previsão;
  - percurso: plano ou real.
- **Ação:** "Usar como meta", que grava o tempo-alvo no ciclo.
- **Não promete ganho de treino** ("se treinar X, seu tempo cai Y"): não há fórmula confiável para isso.

### 5. Hoje · card "Amanhã cedo" (novo)
- **Quando aparece:** do meio-dia à meia-noite.
- **O que mostra:**
  - "Melhor horário amanhã: 5h30 · X °C, orvalho Y °C";
  - barras com o custo do clima em cada hora da janela (5h a 10h), com a melhor hora destacada;
  - chuva e vento com ícone e palavra.
- **Ligação com o resto:** fica logo abaixo do "Amanhã: …" da história do treino.
- **Ação principal do Hoje:** não muda.

### 6. Configurações › Treino (ajuste)
- **Janela de horário:** padrão das 5h às 10h.
- **Local da previsão:** automático (onde os últimos treinos começaram) e editável.

### Computador
- **Plano de prova:** mapa e perfil à esquerda, tabela à direita.
- **Simulador:** ao lado do resumo do ciclo.

## Cálculos novos (você aprova antes de programar)

| Cálculo | Base proposta | O que você aprova |
|---|---|---|
| Pace alvo por km | GAP do motor (Minetti) no sentido inverso: do pace no plano para o pace com a inclinação de cada km | Como suavizar a inclinação |
| Segunda metade mais rápida | 1ª metade X% mais lenta, 2ª metade X% mais rápida, no mesmo tempo final | O valor de X e a fonte |
| Clima no plano e no simulador | Regra temperatura + orvalho (aprovada na Fase 2), aplicada do clima padrão para o clima do dia | O uso nesse sentido |
| Tempo realista | Riegel do motor a partir dos melhores esforços do ciclo | Quais distâncias entram, como vira uma faixa e a correção para a maratona |
| "Terminar bem" | A ponta mais lenta da faixa do tempo realista | A regra |
| Melhor horário | Menor custo de clima na janela, com chuva e vento como desempate | Os limiares |
| Percurso gravado ou digitado | Junção das partes, suavização da altitude e checagem da distância | As tolerâncias |

**Ponto de atenção:** a fórmula de Riegel costuma ser otimista na maratona para corredores amadores, ainda mais quando a referência é uma prova curta. A proposta da fórmula precisa tratar isso com fonte. O app continua dizendo "estimativa, não garantia".

## Jornadas
1. **Definir o ciclo:** Ciclo de prova › Editar → objetivo e estratégia → Adicionar percurso → Plano de prova.
2. **Ao longo do ciclo:** o simulador se atualiza a cada novo melhor esforço.
3. **Véspera de treino:** Hoje, à tarde → "Amanhã cedo" → você programa o despertador.
4. **Últimas 2 semanas:** o plano passa a usar a previsão do dia → Salvar no celular.

## O que depende do Lucas
- O percurso, por qualquer um dos 3 caminhos.
- Os dados do ciclo: nome, data e, se escolher, o tempo-alvo.
