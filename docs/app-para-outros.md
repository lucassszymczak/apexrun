# App para outras pessoas — plano (22/11/2026)

**Objetivo:**
- você manda o link `/apexrun/analise/`, e a pessoa usa o app no próprio aparelho;
- ela importa os próprios .FIT, sem login, sem comunidade e sem Garmin automático;
- nada seu aparece para ela, e nada dela passa pelos seus servidores.

**O que já funciona hoje:**
- os treinos ficam no aparelho de cada pessoa;
- o "+" importa .FIT;
- o clima (Open-Meteo) e o mapa (OpenFreeMap) são serviços públicos, sem conta, e não são seus.

## O que encontrei que é seu

1. **Primeiro acesso:** quem abre o app pela primeira vez recebe os dados de exemplo, que são seus:
   - 9 treinos (a meia de Floripa, o 5 km de base, pedais);
   - 6 dias de sono e de FC de repouso;
   - o ciclo "Maratona 28/03/2027".
2. **Perfil padrão do atleta** (`DEFAULT_ATHLETE`, dentro do motor). Fica por baixo de qualquer perfil: todo campo que a pessoa não preencher usa o seu valor.
   - Medidas suas:
     - nome, cidade, idade e peso;
     - FC de repouso 67 e FC máxima 198;
     - VO₂máx 39,4;
     - EF de base 0,0139;
     - zonas e FC máxima da bike;
     - altitude e clima de Guarapuava;
     - estágios do Teste do Motor;
     - o nome do ciclo "Base & Pace";
     - o aviso da tíbia.
   - Metas: cadência 173, deriva 7%, 35 km/semana e 3 treinos/semana.
3. **Configurações › Dados › "Substituir pelos dados de exemplo (baseline do Lucas)":** carrega os seus treinos.
4. **Telas que são suas:**
   - "Força e canela" (o seu protocolo da tíbia);
   - "Teste do Motor" (os seus estágios de FC);
   - "Baseline 5K".
5. **Seus servidores:**
   - o código de sincronização grava no seu Supabase;
   - o Garmin usa a sua função, que só aceita o seu código.

## Proposta

### A. Primeiro acesso vazio, com tour

**Como o app sabe quem é novo:** é novo o aparelho sem nenhum dado salvo do app.
- Os seus aparelhos já têm dados e não mudam nada.
- Num aparelho novo seu, você usa "Já uso o app" (passo 1).

**O tour tem 5 passos curtos, com "Pular" em todos:**
1. **Boas-vindas:** "Seus treinos ficam só neste aparelho."
   - Botão "Começar".
   - Link discreto "Já uso o app: conectar meu código", que só serve para você.
2. **Você:** nome (opcional), FC de repouso e FC máxima, com a explicação de onde achar (relógio ou teste).
   - Sem esses dois números, os indicadores que dependem de FC mostram "—" com o motivo, em vez de usar os seus.
   - Idade e peso são opcionais.
3. **Como o app funciona:** 3 telas de apresentação (Hoje, Treinos e Progresso), cada uma em uma frase, sem números.
4. **Primeiro treino:** como exportar o .FIT do Garmin Connect (passo a passo curto) e o botão "Importar .FIT".
5. **Pronto:** o Hoje vazio explica o que aparece depois do primeiro treino.

O resto (ciclo de prova, equipamentos, meta semanal) a pessoa preenche quando quiser, em Mais.

### B. Nada seu para quem é novo

- **O perfil novo nasce com tudo em branco ou com o padrão do app**, nunca com o seu. Isso é feito no app, sem mexer no motor.
  - **Medidas** (nome, cidade, idade, peso, FC, VO₂máx, EF de base, zonas da bike, aviso) começam vazias.
  - **Altitude e clima "padrão" (Guarapuava):** preciso da sua decisão, ver a pergunta 2.
  - **Metas** (cadência, deriva, km e treinos por semana): preciso da sua decisão, ver a pergunta 3.
- **Sem ciclo de prova:** o Ciclo de prova mostra "Crie seu ciclo".
- **Some para quem é novo:**
  - "Substituir pelos dados de exemplo";
  - "Força e canela";
  - "Baseline 5K";
  - os estágios do Teste do Motor (ver a pergunta 4).
- **Sincronização e Garmin escondidos para quem é novo.** Só aparecem no aparelho que já tem o seu código. Assim nada da pessoa chega ao seu Supabase.
  - **Garmin, para ela:** a tela Garmin vira "Importar do Garmin", com o passo a passo de exportar o .FIT no Garmin Connect.

### C. Limpeza da Fase 1

- **Tirar "Quem vê: Só eu / Todos"** da privacidade de cada treino. O campo continua no dado, para não mudar o formato, mas some da tela.
- **"Ocultar início e fim" nos cards compartilhados continua.**

### Sobre "meus repositórios"

- O app continua publicado no seu GitHub Pages: é de lá que o link abre.
- A pessoa só baixa o app. Nada dela vai para o GitHub, e ela não tem acesso ao seu código nem a nada privado seu.
- Se um dia quiser que ela tenha uma cópia totalmente separada, é outro projeto (conta própria no GitHub e no Supabase).

### Um teste antigo precisa de você

- A comparação de telas com o app antigo tem um cenário "seed": abre o app vazio e espera os seus dados de exemplo.
- Com o primeiro acesso vazio, esse cenário deixa de fazer sentido.
- As regras dizem para não alterar teste existente. Proposta: esse cenário passa a carregar os dados de exemplo de propósito antes de comparar, e os números continuam conferidos igual.
- Os outros cenários e o motor não mudam.

## Perguntas

1. **Tour:** os 5 passos acima estão bons?
2. **Altitude e clima "padrão":** hoje são os de Guarapuava (1.120 m, 8 a 18 °C).
   - (a) A pessoa informa a cidade, e o app usa a altitude dela, quando disponível. Sem isso, o ajuste de clima não aparece.
   - (b) Usar os mesmos valores para todos.
3. **Metas** (cadência 173, deriva 7%, 35 km e 3 treinos/semana):
   - (a) Começar vazias; a pessoa define quando quiser e, sem meta, o item mostra "—".
   - (b) Usar os seus números como padrão.
4. **Teste do Motor:** esconder para quem é novo, ou deixar com estágios em branco para a pessoa preencher?
5. **Corrigir o cenário "seed" da comparação de telas** como descrito?

## Decisões do Lucas (22/11/2026)

- **Garmin dos outros:** só manual, pelo .FIT.
- **Respostas às perguntas:**
  1. Tour: sim, os 5 passos.
  2. Altitude e clima: a pessoa informa a cidade e o estado.
  3. Metas: começam vazias, e ela preenche se quiser.
  4. Teste do Motor: fica escondido para quem é novo (recomendação).
  5. Cenário "seed" da comparação de telas: corrigido como proposto.

## O que foi feito

- **Primeiro acesso vazio** (`store.ts` + `perfil.ts`):
  - perfil em branco com `novo: true`;
  - sem treinos, sem sono e sem ciclo de exemplo.
- **Tour de 5 passos** (`screens/Tour.tsx`):
  - "Pular" em todos e "Já uso o app" no passo 1;
  - FC máxima menor que a de repouso não passa;
  - a cidade e o estado dão a altitude pela busca de cidades do Open-Meteo, que recebe só o nome da cidade.
- **Para quem é novo** (os aparelhos do Lucas não mudam):
  - **some:** "Força e canela", o tipo "Teste do Motor", o "Baseline 5K", "Restaurar dados de exemplo" e o link do app antigo;
  - **Garmin:** vira o passo a passo do .FIT, sem pedir chave;
  - **sincronização:** só "Já uso o app com um código de sincronização" (conectar um código que já existe); não dá para gerar um código novo;
  - **metas vazias:** aparecem como "sem meta definida", sem linha de alvo nos gráficos;
  - **Leitura do Coach:** sem as menções ao caso da tíbia. Os números e as regras são os mesmos.
- **Para todos:** "Quem vê: Só eu / Todos" saiu da privacidade do treino. O campo continua no dado.
- **Teste novo `scripts/novo-app.mjs`** (27 verificações):
  - nada do Lucas no aparelho novo;
  - o tour completo e o "Pular";
  - sem "NaN"/"undefined" em 14 telas, com 0, 1 e 2 treinos;
  - nenhum pedido ao Supabase nem ao Garmin;
  - o aparelho do Lucas igual a antes.
- **`compare-views seed`:** carrega os dados de exemplo antes de comparar. Resultado: 508 de 511 números, igual a antes da mudança.
