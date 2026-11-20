# Apex Performance — Roteiro da Fase 1 (aprovado em 19/11/2026)

## Escopo da Fase 1
- Nova identidade aplicada no app inteiro: logo, ícones, cores, Outfit, ícones de contorno e nenhum emoji.
- Redesenho de todas as telas atuais, sem mudar nenhum cálculo.
- Inovações:
  - 1 · Mapa colorido por FC, pace, zona ou inclinação
  - 2 · Mapa ligado ao gráfico
  - 3 · Replay
  - 11 · Card para Stories com zona de privacidade
  - 12 · Explicação de cada KPI ao tocar
- Também entram: fotos no mapa, card para Feed, alternância Ruas / Só trajeto e privacidade por treino.
- Fica de fora: vento e o restante da Fase 2+, Garmin automático (Fase 2) e comunidade (Fase 6).

## Mapa de telas
Navegação inferior no celular / trilho lateral no computador:
- **Hoje**
- **Treinos** → Treino → Compartilhar
- **Botão central "+"** → Importar: escolher arquivo(s) → Conferência → Completar → abre o Treino
- **Progresso** → Detalhe do sistema
- **Mais:** Maratona, Relatório semanal, Recuperação, Força e canela, Livro de fórmulas, Configurações

Componente global: a **Folha do KPI**. Ao tocar em qualquer número, ela mostra o que significa, o seu valor e faixa, a confiança e o link para o Livro de fórmulas.

Na Fase 6, a Comunidade ocupa o lugar de "Mais", e "Mais" vai para o avatar no topo.

## Telas

### 1. Hoje
- **Mensagem:** como você está e o que fazer hoje.
- **Seções, em ordem:**
  1. Alerta ativo, se houver (ex.: pausa protetora), em `alerta` com ícone.
  2. Prontidão: anel de 0 a 100 + recomendação numa frase + chips de forma, sono, FC de repouso e km em 7 dias.
  3. Leitura do Coach: 2 a 3 linhas que expandem para a leitura completa (o conteúdo da antiga aba Coach).
  4. Plano da semana.
  5. Último treino: mini-trajeto + 3 números, que abre o Treino.
  6. Ciclo: fase, semana X de Y e dias até a prova, que abre Maratona.
- **Ação principal:** "Importar treino" quando ainda não há treino no dia; depois disso, "Ver último treino".
- **Computador:** 2 colunas. À esquerda, prontidão, Coach e plano; à direita, último treino com mapa e ciclo.

### 2. Treinos (lista)
- **Mensagem:** todos os seus treinos, do mais recente.
- **Conteúdo:**
  - Busca e filtros: modalidade, tipo (fácil, longão, qualidade, prova, teste) e período.
  - Lista agrupada por mês, com os totais do mês.
  - Cada item mostra: mini-trajeto (ou ícone, se não tiver GPS), nome, data, 3 números, selo do tipo e ícone de privacidade.
- **Ação principal:** importar .FIT (aceita vários arquivos).

### 3. Treino (detalhe)
- **Mensagem:** o treino num olhar: onde, quanto e como foi.
- **Mapa em tela cheia:**
  - Ruas / Só trajeto.
  - Cor: FC, pace, zona ou inclinação (a legenda sempre traz os rótulos).
  - Marcos de km, fotos no ponto onde foram tiradas, largada e chegada.
  - Play do replay.
- **Topo:** voltar, nome e data, Privacidade (escudo) e Mais (editar, excluir, reimportar .FIT).
- **Gaveta com 3 alturas:**
  - Recolhida: distância, pace e FC + play e barra de progresso.
  - Média: gráfico de pace, FC e elevação ligado ao mapa (arrastar move o ponto) + splits por km, com o mais rápido em destaque.
  - Expandida: os sistemas que já existem (Motor/economia, Resistência/fadiga, Mecânica e ritmo, Carga e zonas, Condições e notas), mais Percepção (RPE, sono, dor, hidratação) e Qualidade dos dados (o banner de conferência e a auditoria).
- **Ação principal:** Compartilhar.
- **Estados especiais:**
  - Treino sem GPS (esteira, bike indoor, natação em piscina): o mapa dá lugar ao gráfico.
  - Treino antigo sem trajeto salvo: aviso "Reimporte o .FIT para ver o mapa; nada nas análises muda".
- **Computador:** mapa ao centro e painel fixo de 380 px à direita, com o conteúdo da gaveta.

### 4. Importar (botão "+")
1. **Escolher arquivos:** um ou vários .FIT. No computador, dá para arrastar e soltar. O registro manual continua como opção secundária.
2. **Conferência:**
   - O que foi lido.
   - Achados: pausas, lacunas, gravação inteligente, clima buscado.
   - Aviso de duplicata: substituir / manter os dois / cancelar.
3. **Completar:**
   - Modalidade e tipo.
   - Percepção: RPE, sono, dor muscular, dor articular.
   - Hidratação e notas.
   - Fotos (opcional; o app encaixa cada foto pelo horário).
   - Privacidade (já vem com o padrão).
- **Ação principal:** Salvar treino. Depois de salvar, abre o Treino.

### 5. Compartilhar
- **Mensagem:** seu treino pronto para postar.
- **Opções:**
  - Formato: Stories 9:16 ou Feed 4:5.
  - Modelo: Foto, Mapa ou Só números.
  - Foto: uma das fotos do treino ou da galeria.
  - Até 3 números exibidos.
  - Privacidade aplicada: ocultar início e fim, ou sem mapa.
  - Logo branco.
- **Ação principal:** Compartilhar imagem (menu nativo do celular). Secundária: Salvar imagem.

### 6. Progresso
- **Mensagem:** para onde a sua forma está indo.
- **Seções:**
  - Seu perfil.
  - Foco atual: IMP, Pace-GAP@145, cadência no ritmo de referência.
  - Sistemas (Motor, Resistência, Mecânica e ritmo, Carga e forma, Hidratação, Recuperação), cada um com mini-tendência.
  - Histórico: recordes e linha do tempo.
- **Ação principal:** abrir um sistema.
- **Computador:** grade de 3 colunas.

### 7. Detalhe do sistema
- Gráfico de evolução, explicação em uma linha, sessões que compõem o número, confiança e auditoria.

### 8. Maratona (Ciclo)
- **Mensagem:** faltam X dias: fase, ritmo e estimativa.
- **Seções:**
  - Fase atual, numa linha do tempo das fases.
  - Resumo do ciclo.
  - Treinos da semana.
  - Ritmo de prova por zona de FC.
  - Zonas de FC da semana.
  - Evolução do volume.
  - Estimativa de prova (Riegel).
  - Recordes do ciclo.
- **Ação principal:** lançar os treinos da semana.

### 9. Relatório semanal
- Um card por semana: volume, carga, zonas, consistência, destaques e a leitura do Coach.
- Tela só de leitura, sem ação principal.

### 10. Recuperação
- **Seções:** estado atual, prontidão da semana, tendências (FC de repouso, HRV, sono, VO₂máx) e diário.
- **Ação principal:** registrar o dia. Secundária: trazer do Apple Saúde.

### 11. Força e canela
- Conteúdo atual: alerta clínico, semana, programa de exercícios, como progredir e como saber se está funcionando.
- Ação principal: [VERIFICAR] se hoje existe registro de sessão de força. Se não existir, a tela é só de leitura.

### 12. Livro de fórmulas
- Busca + grupos (Motor, Mecânica, Carga, Forma, Proprietário).
- Cada KPI mostra confiança, fórmula e fonte.
- É também o destino do link da Folha do KPI.

### 13. Configurações
- Atleta: FC de repouso, FC máxima, VO₂ e metas.
- Novo ciclo de prova.
- Zonas de FC (corrida e bike).
- Mapa: padrão Ruas ou Só trajeto, e cor padrão.
- Privacidade padrão: mapa, raio e quem vê.
- Aparência: escuro, claro ou automático.
- Sincronizar entre aparelhos.
- Dados: exportar e importar JSON, e o backup automático antes da migração.

## Jornadas principais
1. **Pós-treino (celular):** + → escolher .FIT → conferência → percepção e fotos → Salvar → Treino no mapa → play → Compartilhar no Stories.
2. **Manhã (celular):** Hoje → prontidão e Coach → plano da semana → decide o treino do dia.
3. **Análise (computador):** Progresso → sistema → treino que puxou a tendência → mapa ligado ao gráfico → toque num KPI → Livro de fórmulas.

## Onde foi parar cada coisa do app atual
| Antes | Depois |
| --- | --- |
| Hoje | Hoje |
| Treinos | Treinos e Treino |
| Progresso | Progresso |
| Maratona | Mais › Maratona (+ card no Hoje) |
| Coach | Hoje (Leitura do Coach) e gaveta do Treino |
| Relatório | Mais › Relatório semanal |
| Recuperação | Mais › Recuperação (+ prontidão no Hoje) |
| Força | Mais › Força e canela |
| KPIs | Mais › Livro de fórmulas (+ Folha do KPI em qualquer número) |
| Config | Mais › Configurações |
| Faixa rolante no topo | Removida; os números foram para o Hoje |
