# Fase 2 · Etapa 3 — Trajeto nos dois aparelhos + período de análise

Nenhuma fórmula muda. O formato de `apex.analise.v1` também não muda.

## Trajeto nos dois aparelhos
- **Versão leve** (`analise/app/track-light.ts`):
  - **Traçado:** simplificado para até 400 pontos, com latitude e longitude em inteiros (×10⁵) e em diferenças.
  - **Séries a cada 10 s:** tempo, distância, FC, velocidade, altitude e inclinação, em inteiros.
  - **Meia de Floripa real: 19,0 KB.** A meta era até 30 KB.
  - **Acima de 30 KB:** o app avisa, mas sincroniza normalmente (decisão do Lucas). Uma maratona sintética ficou entre 30 e 64 KB.
  - **Acima de 64 KB** (o limite do servidor): o intervalo das séries cresce sozinho (15 s, 20 s…) até caber.
- **Sincronização** (`analise/app/track-sync.ts`, tabela `analise_tracks`):
  - **Sobe ao:** salvar o treino, reimportar o .FIT ou buscar o trajeto no Garmin.
  - **Na abertura:** o app sobe os trajetos que o servidor ainda não tem e baixa os 10 mais recentes que faltam no aparelho.
  - **Ao abrir um treino sem trajeto local:** o app baixa a versão leve. Mapa, replay e gráfico funcionam com ela.
  - **Ao excluir o treino:** o trajeto também é apagado do servidor.
  - **Fotos:** nunca sobem.
- **"Buscar trajeto dos treinos antigos"**, em Configurações › Garmin, e **"Buscar trajeto no Garmin"**, no menu do Treino:
  - para os treinos ligados ao Garmin, baixa o .FIT e guarda só o trajeto;
  - tem progresso e botão de pausa;
  - nenhum número muda (teste byte a byte).

## Período de análise (pedido do Lucas, 20/11)
Com o histórico do Garmin desde 2018, os treinos antigos pesavam nas telas de hoje.
- **Opções:** Desde o início, Ciclo atual, Ciclo anterior, Últimos 12 meses (padrão), Últimos 90 dias e cada ano que tem treinos.
- **Onde aparece:** no topo do Hoje, do Coach, do Progresso (com os sistemas e os recordes) e do Relatório semanal. É um só seletor, guardado neste aparelho.
- **Como funciona:** o período só escolhe quais treinos entram nas contas. As fórmulas são as mesmas do motor, e nada é apagado.
- **Hoje e Coach olham para agora:** só oferecem períodos que chegam até hoje. Com um período passado escolhido, eles usam os últimos 12 meses.
- **Recordes:** usam o período escolhido. Fora de "Desde o início", cada recorde mostra ao lado o seu melhor de todos os tempos e o ano em que foi feito.
- **Com os seus dados reais**, no Motor:
  - "Desde o início": economia −6% no bloco;
  - "Últimos 12 meses": +13%, e o Coach passa a mostrar "Motor subindo";
  - "2024": os números daquele ano.
- **Comparação com o app antigo:** os números das telas continuam batendo, com o mesmo resultado de antes (exemplo, sintético e backup).

## Testes
- `npm test`: 82/82, incluindo a versão leve com a Meia real.
- `node scripts/tracks-app.mjs`: 10/10.
  - Aparelho A importa e B vê o mapa, e o contrário também.
  - Excluir apaga o trajeto do servidor.
  - Buscar o trajeto antigo não muda nenhum número.
- Golden master e motor: verdes.
- Teste de fumaça: 81/81.
