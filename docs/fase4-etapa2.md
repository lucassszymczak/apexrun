# Fase 4 · Etapa 2 — Ciclo e percurso

## O que entrou

- **Ciclo de prova › Editar** (`#/mais/ciclo`):
  - tela inteira, no lugar do card "Editar meta da prova";
  - campos: nome, data da prova, **horário da largada** (novo, padrão 06:00), início do ciclo e distância;
  - **Objetivo:** Terminar bem / Tempo-alvo. No tempo-alvo, o campo h:mm mostra o pace médio ao vivo;
  - **Estratégia:** Esforço constante / Segunda metade mais rápida;
  - **Percurso:** a linha mostra fonte, km, D+ e confiança, ou "Adicionar";
  - **Mais metas do ciclo** (longão e volume), recolhido;
  - **Salvar ciclo** como ação principal.
- **Percurso da prova** (`#/mais/percurso`):
  - **Vazio:** 3 fontes com a confiança escrita. A menção ao "percurso salvo no Garmin Connect" saiu, porque a API pessoal não entrega percursos (Etapa 0). O GPX pode vir do site da prova ou ser exportado do Strava ou do Garmin Connect pelo navegador.
  - **Arquivo (GPX):** um arquivo.
  - **Gravação:**
    - de 1 a 4 arquivos .FIT ou GPX, em ordem de horário, que você pode reordenar;
    - aceita bike e caminhada;
    - o app mostra cada parte e o total, e avisa se houver um buraco de mais de 200 m entre as partes.
  - **Digitada:**
    - subida e descida de cada km;
    - sem a fonte, não salva;
    - confiança sempre baixa, e a fonte aparece na tela.
  - **Distância oficial:**
    - até 2% de diferença, ajusta e avisa;
    - acima de 2%, pergunta: "Ajustar mesmo assim" ou "Trocar arquivo".
  - **Tela importada:**
    - mapa (Ruas / Só trajeto), com o trecho mais duro em `--atencao`;
    - km, D+ e D−;
    - o título "Trecho mais duro: do km A ao B, +X m";
    - o perfil, com o trecho mais duro a 12% e tracejado na metade e no km 30;
    - o quadro da fonte, com a confiança e o gravado × oficial;
    - as partes, só na gravação.
- **Confiança automática da gravação:** o .FIT diz se o relógio tem altímetro barométrico. O seu FR920XT tem, então uma gravação dele fica com confiança moderada. Só com GPS, ela fica baixa.
- **Onde fica o percurso:** em `race.course`, cerca de 4 KB numa maratona. Ao salvar, o app atualiza `race.updatedAt`, então o percurso vai para o outro aparelho na sincronização do ciclo.
- **Módulo novo `analise/percurso.mjs`:**
  - lê o GPX sem biblioteca;
  - junta as partes;
  - reamostra a cada 100 m;
  - ajusta a distância à oficial;
  - calcula km a km, com a altitude suavizada em 500 m;
  - calcula D+ e D−, o trecho mais duro (km seguidos de 2% ou mais) e a confiança;
  - guarda o perfil leve.

## O que ficou para a próxima etapa (de propósito)

- **"Realista hoje" e "Testar metas no simulador"** na tela de editar: entram com o simulador (Etapa 4). Antes de programar o tempo realista, ainda falta conferir as fontes citadas de memória.
- **"Ver plano de prova"** na tela do percurso: entra na Etapa 3. Por enquanto, a ação principal é "Voltar ao ciclo".

## Critérios verificados nesta etapa

| # | Critério | Situação | Como foi verificado |
|---|---|---|---|
| 1 | Testes atuais, golden e paridade do motor | ok | Os 7 testes do motor, `test:analise` (11 arquivos), `npm test` (82), `test:app` (81), offline (9), Garmin (24), trajeto (11), leitura (28), compare-views 100% |
| 2 | Ciclo antigo sem os campos novos funciona | ok | `ciclo-app`: o ciclo de teste abre igual, e os campos antigos ficam intactos depois de salvar |
| 3 | GPX de 42,195 km: perfil igual ao arquivo (até 1 m) | ok | `percurso.test`: diferença máxima de 0,10 m |
| 4 | Gravação em 2 partes: ordem certa, total = soma | ok | `percurso.test` e `ciclo-app`, com arquivos trocados de propósito |
| 5 | 1,4%: ajusta e avisa. 3%: pergunta antes | ok | `percurso.test` e `ciclo-app` |
| 6 | Digitada sem fonte não salva; com fonte, confiança Baixa e a fonte na tela | ok | `percurso.test` e `ciclo-app` |
| 17 | Nenhum valor de exemplo no código | ok | Busca por "5h30", "5h40", "106 m" e "28/03/2027": nada |

**Testes novos:**
- `node analise/percurso.test.mjs`: 33/33;
- `node scripts/ciclo-app.mjs`, no navegador: 21/21.
