# Fase 5 · Etapa 0 — Descoberta

Nada no app mudou nesta etapa. Copiei para o repositório o `CLAUDE.md` novo, o `docs/roteiro-fase5.md` e a pasta `design/telas-fase5/`. O `CLAUDE.md` só acrescenta as regras da Fase 5 (dados, componentes e quatro "não fazer") e marca a Fase 3 como publicada.

## 1. A API pessoal do Garmin entrega o equipamento da atividade?

**Não.** Li a especificação oficial (OpenAPI "Garmin Connect Personal API 1.0.0", a mesma do Swagger usado na Fase 2), em 21/11:

- **Endpoints:** nenhum é de equipamento. Os de atividade são a lista, o resumo, os passos do treino, o .FIT e os tipos de atividade.
- **Campos:** nenhum campo do resumo da atividade fala de tênis ou bike. "Equipment" só aparece em dois lugares:
  - nos passos de treino de natação (`equipmentType`: nadadeira, prancha…);
  - no mergulho (`equipments`, texto livre).
- **Consequência:** o tênis não vem sozinho do Garmin.
  - Com um par só, o Completar já traz ele escolhido, como pede o roteiro. Na prática, você não precisa tocar em nada.
  - Quando houver dois pares, o app sugere o último usado na mesma modalidade, e você confere.
  - Não vou usar nenhum endpoint fora da especificação.

## 2. Como o ditado do iPhone chega ao campo

Não consigo testar o ditado do iPhone daqui. O que dá para afirmar e o que precisa do seu teste:

- **Como chega:** o ditado escreve no campo como se fosse o teclado. O app recebe só o texto.
  - O iOS pode reescrever a frase enquanto você fala e logo depois de parar.
  - Por isso a leitura acontece só quando você toca em "Preencher pela frase", nunca a cada letra.
- **Pontuação:** o iOS põe vírgulas e ponto final sozinho e começa com letra maiúscula.
  - O app vai ignorar pontuação e maiúsculas.
  - Vírgula entre números ("7,5") vira decimal; vírgula entre palavras separa itens.
- **Números:** em português, o ditado costuma escrever em algarismos ("RPE 7", "canela esquerda 3"), mas às vezes por extenso ("sete", "três").
  - Também pode sair "7 e meia", "sete e meia", "7,5" ou "7:30".
  - A regra da Etapa 1 vai aceitar todas essas formas.
- **"RPE":** pode sair "RPE", "rpe", "RP", "erre pê é" ou "esforço". A regra vai listar as variantes aceitas.
- **Seu teste (Etapa 3):** depois de um treino, dite a frase de exemplo e me mande o texto que apareceu no campo. Ajusto o vocabulário com o que o seu iPhone escreve de verdade.

## 3. Onde guardar o catálogo de equipamentos

**Recomendação: dentro de `athlete`, no campo novo e opcional `athlete.equipamentos`**, como os segmentos da Fase 3.

- **Por que em `athlete`:** a sincronização só junta as chaves que conhece (atleta, treinos, dias, ciclo e plano da semana). Um campo novo no topo de `apex.analise.v1` se perderia.
- **Tamanho:** cerca de 0,2 KB por item (nome, início, limite, aposentado e as datas de troca). Mesmo com anos de trocas, fica bem abaixo de 10 KB.
- **Em cada treino:**
  - `gearId` (o tênis ou a bike usada);
  - `dorRegioes` (lista de { região, lado, intensidade }).

  Os dois sincronizam com o treino.
- **Os km não são guardados:** são somados na hora a partir dos treinos com aquele `gearId`. Assim, editar ou excluir um treino já corrige os km. A troca de pneu ou corrente guarda só a data, e os km contam a partir dela.
- **Cuidado:** o atleta sincroniza inteiro, e vence a versão mais recente. Como você usa os dois aparelhos, uma edição de equipamento num deles e, ao mesmo tempo, outra edição no atleta no outro aparelho podem se sobrepor (vale a mais nova). É o mesmo comportamento das metas e dos segmentos.

## 4. Como o gerador de cards faz os 6 Stories

O que já existe (`analise/app/share/`):

- `card.ts`: os tokens de cor, o símbolo da marca, `toPng` e `shareOrDownload`.
  - `shareOrDownload` usa o compartilhar do sistema com arquivo; sem ele, baixa.
- `plano-img.ts`: a imagem 1080×1920 do plano de prova, com o topo e o pé livres para o relógio e os botões do iPhone, fonte mínima de 40 px e a marca no pé. **Você conferiu no iPhone que "Salvar imagem" funciona.**

Proposta:

- **Um arquivo novo, `share/retro-img.ts`,** no mesmo padrão do `plano-img.ts`:
  - uma função por card (capa, volume, consistência, recordes e longão, prova, tênis), cada uma desenhando num canvas de 1080×1920 com um número grande;
  - o mesmo fundo `--noite`, as mesmas margens livres e a marca no pé;
  - nenhum mapa: os cards só recebem números e séries, nunca trajeto.

  Um teste vai garantir que o gerador não recebe coordenadas.
- **Salvar:**
  - no iPhone, o compartilhar do sistema aceita várias imagens de uma vez. Os 6 vão juntos, e a folha mostra "Salvar 6 imagens";
  - se o aparelho não aceitar vários arquivos, o app compartilha um por vez;
  - no computador, baixa os 6.
- **Texto alternativo:** cada card terá a frase com os números ("Volume do ciclo: N km em M corridas"), usada na prévia da tela e no nome do arquivo.
- **Desempenho:** o card do plano já sai em poucas centenas de milissegundos. Seis cards devem ficar dentro da meta de 3 s no iPhone; vou medir.

## Com os seus dados (servidor, 21/11; só contagens)

| O quê | Quantidade |
|---|---|
| Treinos | 139 (110 corridas, 29 pedais) |
| Com RPE | 29 |
| Com sono (h) | 79 |
| Com dor muscular (0–10) | 12 |
| Com "dor articular" marcado ou desmarcado | 139 |
| Com equipamento ou regiões de dor | 0 (campos novos) |
| Corridas nos últimos 12 meses | 221 km, nenhuma em esteira |
| Pedais com distância | 25 (270 km no total) |
| Corridas sem distância | 0 |

- **Dor muscular:** só 12 treinos têm o campo preenchido. A regra 2 da Etapa 1 (preencher a dor muscular pela maior região do mapa) vai mudar a prontidão dos treinos novos em que você marcar o mapa. Vou mostrar 3 exemplos reais do efeito.
- **Km inicial do tênis:** preciso do nome do tênis que você usa hoje e da data aproximada em que começou com ele. Com isso, o app soma as corridas desde essa data.

## Próxima etapa

Etapa 1: só documento, `docs/fase5-formulas.md`, com os 6 itens para você aprovar. Se puder, mande junto:

1. o nome do tênis atual e a data em que começou com ele;
2. se quer aviso na bike: os limites de km dos pneus e da corrente (pode ficar para depois).

## Decisão do Lucas (21/11)

- **Tênis:** o app deixa em aberto o nome, os **km atuais** e o **km limite**, para você preencher em Mais › Equipamentos.
  - Os km atuais são o ponto de partida. Daí em diante, somam-se as corridas registradas com esse tênis.
  - Não haverá "Atribuir às corridas desde <data>".
- **Bike:** sem aviso. Pneus e corrente ficam só com os km desde a troca, sem limite.
