# Apex Performance — Roteiro da Fase 2 (aprovado em 20/11/2026)

Projeto pessoal · base: Fase 1 publicada (PRs #48 e #49) · telas aprovadas em `design/telas-fase2/`

## Decisões do briefing (20/11)
- **Garmin:** os treinos entram sozinhos quando o app abre e ficam em "Para completar" no Hoje.
- **História do treino:** gerada por regras, sem IA.
- **Trajeto nos dois aparelhos:** sim. Trajeto simplificado e séries leves vão na sincronização; as fotos continuam só no aparelho.
- **Tiros:** usar as voltas do relógio (manuais ou do treino estruturado); detecção automática só quando não houver voltas.
- **Ordem:** 2A Garmin + trajeto nos dois aparelhos; depois 2B Leitura do treino.

## 2A · Garmin automático + trajeto nos dois aparelhos

### Como funciona
- **A chave pessoal** (criada pelo Lucas no Garmin Connect Web):
  - é colada uma vez no app;
  - vai para o servidor (função do Supabase), fica guardada criptografada e nunca volta para o aparelho;
  - a função só atende quem tem o código de sincronização do Lucas.
- **Token:** a função troca a chave por um token de acesso (vale 24 h; não há renovação automática, ela pede outro quando precisa). Depois, lista os treinos novos e baixa o .FIT de cada um.
- **O .FIT entra no mesmo motor do import manual** (conferência, clima, KPIs). Duplicatas com treinos importados à mão são reconhecidas.
- **Campos que a API não entrega:** VO₂máx, tempo de recuperação, condição de desempenho, Training Effect e perda de suor. Para o app, só afeta o campo "Training Effect" da bike, que fica "—". Os KPIs não dependem deles, e o VO₂máx vem do Apple Saúde.

### Telas
- **Configurações › Garmin** (nova)
  - Desconectado: os 3 passos para gerar a chave + "Conectar Garmin" (campo para colar a chave + "trazer treinos desde").
  - Conectado: "Conectado · chave vence em dd/mm/aaaa", última sincronização, "Sincronizar agora", "O que trazer", "Buscar trajeto dos treinos antigos", "Trocar chave", "Desconectar".
  - Aviso 30 dias antes de a chave vencer. A Garmin também manda e-mail uma semana antes.
  - Ação principal: Conectar (desconectado) / Sincronizar agora (conectado).
- **Hoje · "Para completar"** (novo bloco, logo abaixo da prontidão)
  - "N do Garmin": cada um com nome, data e 3 números.
  - "Completar treino" abre o passo 3 do Importar (Completar), já com tudo do .FIT preenchido.
  - Com pendências, a ação principal do Hoje vira "Completar treino" e o "+" vira contorno. Sem pendências, volta a ser "Importar treino".
- **Treinos (lista):** selo "Garmin" ou ".FIT manual" em cada treino; na linha de contagem, "sincronizado há 5 min".
- **Avisos:** chave vencida ou inválida, sem internet, Garmin fora do ar. Aviso discreto com a ação certa ("Renovar chave"), sem travar o app.
- **Primeira sincronização:** resumo "N treinos novos · M já existiam (ignorados)".

### Trajeto nos dois aparelhos
- Vão na sincronização: o trajeto simplificado e as séries leves para gráfico e replay (1 ponto a cada ~10 s). Meta: até 30 KB por meia maratona.
- Fotos não sincronizam.
- Treinos antigos sem trajeto: "Reimportar .FIT" continua; com o Garmin conectado, aparece "Buscar trajeto no Garmin".

## 2B · Leitura do treino

Tudo entra na tela de Treino. Celular: gaveta e mapa. Computador: painel lateral e mapa.

| Inovação | Onde aparece | O que mostra |
|---|---|---|
| História do treino | Topo da gaveta (altura média) e card "Último treino" do Hoje | 3 frases: o que foi bom, o que observar e o que fazer amanhã. Regras sobre o veredito, a leitura do Coach, a prontidão e os KPIs que já existem |
| Pace equivalente | Abaixo do pace, nos números principais | "≈ X em clima padrão" + selo de confiança + Folha do KPI |
| Vento por trecho | Novo modo de cor do mapa, "Vento" | Trecho a favor, contra ou lateral + seta do vento + "a volta contra o vento custou ≈ X s/km" |
| Onde a deriva começou | Gráfico (linha vertical) + marcador no mapa + sistema Resistência | "A deriva começa no km X" |
| Tiros | Seção "Tiros" na gaveta + trechos destacados no mapa e no gráfico | Pace de cada tiro sobre a faixa alvo + tabela por repetição (tempo, pace, FC, recuperação) + origem. Fonte: voltas do relógio; sem voltas, detecção pela velocidade |
| Melhores esforços | Seção na gaveta + Progresso › Recordes | 400 m a 21,1 km (o que couber), com selo "Melhor do ciclo" ou "Recorde pessoal". Tocar destaca o trecho no mapa |
| Custo da subida | Sistema Mecânica e ritmo + Progresso | Tempo por faixa de inclinação (as 5 que já existem), pace real × GAP e FC. No Progresso, a curva pessoal |

Modos de cor do mapa: FC, Pace, Zona, Inclinação e Vento.

### Regra para os cálculos novos
Vento, pace equivalente, início da deriva, detecção de tiros, melhor esforço, curva da subida e as regras da história são definições novas.
- O Claude Code propõe cada uma com fonte e limiares, e o Lucas aprova antes de implementar.
- Cada uma entra no Livro de fórmulas com selo de confiança e testes.
- Os cálculos existentes não mudam (golden master continua valendo).

## Jornadas
1. **Primeira conexão (computador):** Configurações › Garmin › Conectar → cola a chave → escolhe "trazer desde" → resumo do que entrou.
2. **Pós-treino (celular):** o relógio sincroniza com o Garmin Connect → abre o Apex → "Para completar" → RPE, sono e dor (30 s) → Treino com a história e o replay → Compartilhar.
3. **Análise (computador):** Treino → história → gráfico com o início da deriva → tiros → melhores esforços → Folha do KPI do pace equivalente.
4. **Renovação anual:** aviso no app 30 dias antes → nova chave no Garmin Connect → Configurações › Garmin › Trocar chave.
