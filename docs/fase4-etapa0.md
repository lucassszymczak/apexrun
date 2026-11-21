# Fase 4 · Etapa 0 — Descoberta

Nada no app mudou nesta etapa. Copiei para o repositório o `CLAUDE.md` novo (só acrescenta regras da Fase 4), o `docs/roteiro-fase4.md` e a pasta `design/telas-fase4/`.

## 1. A API pessoal do Garmin entrega percursos (courses)?

**Não.**
- **Fonte:** o Swagger oficial da API pessoal (developer.garmin.com, o mesmo da Fase 2, em `docs/fase2-etapa0.md`). Ele tem 28 endpoints, todos de leitura:
  - atividades e o download do arquivo;
  - sono, VFC, passos, peso, hidratação, estresse e outros dados de saúde.
- Nenhum endpoint fala de percurso ("course"), nem de rota ou trajeto planejado.
- **Consequência:** a opção "Percurso do Garmin Connect" sai da tela de percurso. Ficam:
  - **GPX:** exportado do site da prova, do Strava, do Garmin Connect pelo navegador ou de outro app;
  - **Gravação:** de 1 a 4 arquivos .FIT ou GPX, do reconhecimento de bike ou caminhada;
  - **Digitada:** km a km, com a fonte obrigatória.

## 2. Previsão do Open-Meteo

**Fontes:**
- open-meteo.com/en/docs;
- open-meteo.com/en/terms;
- a própria API, consultada em 21/11 (`api.open-meteo.com/v1/forecast`).

| Pergunta | Resposta |
|---|---|
| Campos por hora | `temperature_2m` (°C), `dew_point_2m` (°C), `precipitation_probability` (%), `wind_speed_10m` (km/h), `wind_direction_10m` (°, de onde o vento vem) |
| Até quantos dias | **16**. A documentação diz: "By default, we provide forecasts for 7 days, but you can access forecasts for up to 16 days". Pedir 17 devolve o erro "Forecast days is invalid. Allowed range 0 to 16." |
| O que é a chance de chuva | "Probability of precipitation with more than 0.1 mm of the preceding hour", calculada com 30 simulações de modelos de conjunto, com resolução de cerca de 27 km |
| Limite de uso (gratuito, não comercial) | Menos de 10.000 chamadas por dia, 5.000 por hora e 600 por minuto. O app faz no máximo 1 chamada por abertura, com cache de 3 h |
| Fuso | `timezone=UTC`, como o clima e o vento já fazem hoje. O app converte para a hora local |

**O que muda para o app:**
- O plano só usa a previsão nos 16 dias antes da prova. Antes disso, usa o clima padrão e mostra a data em que a previsão abre: o dia da prova menos 16.
- O mesmo endereço (`api.open-meteo.com`) já recebe a coordenada e o horário para o clima e o vento. Nenhum servidor novo.

## 3. O app abre sem internet hoje?

**Sim.**
- O app instalado guarda no aparelho todos os arquivos que ele precisa (o service worker da Fase 1).
- Teste `npm run test:offline`, rodado hoje: 9 de 9. Hoje, Treinos, Treino, Progresso e Configurações abrem sem internet, e a fonte Outfit também carrega.

**O que falta para a tela do plano funcionar em modo avião:**
1. **A tela entra no pacote do app,** como as outras. Isso é automático: todo arquivo novo do build é guardado.
2. **O plano é calculado só com dados do aparelho:** o ciclo, o percurso e a última previsão guardada. Nenhuma busca na rede bloqueia a tela.
3. **A previsão fica guardada no aparelho** por até 3 h para o "Amanhã cedo". Para o plano, a última previsão da prova fica guardada sem prazo, com a data em que foi buscada.
4. **O mapa de ruas do percurso não funciona sem internet,** porque o mapa vem de um servidor. "Só trajeto" funciona. É o mesmo comportamento do Treino.
5. **Um teste novo** no `test:offline`: abrir `#/mais/plano` em modo avião, já com um percurso salvo.

## 4. Onde guardar o percurso (`course`)

**Recomendação: dentro do ciclo (`race.course`).**
- **Tamanho medido** com a sua Meia, num formato leve:
  - rota com até 400 pontos;
  - altitude a cada 100 m;
  - posições guardadas como diferenças de inteiros.

  | Distância | Tamanho |
  |---|---|
  | Meia | 2,3 KB |
  | Maratona (estimada, o dobro) | 4,2 KB |
  | Meta | 30 KB |

- **Por que dentro do ciclo:**
  - o ciclo já sincroniza inteiro, e vence a versão mais recente (`updatedAt`);
  - o percurso vai junto, sem tabela nova, sem função nova no Supabase e sem migração;
  - trocar ou apagar o ciclo leva o percurso junto, sem sobra no servidor.
- **Por que não em `analise_tracks`:**
  - aquela tabela é por treino, e teria um id artificial (`prova:<data>`);
  - precisaria de limpeza separada quando o ciclo muda.
- **Cuidado:** ao salvar o percurso, o app atualiza `race.updatedAt`, para o outro aparelho receber a versão nova.
- **Ponto da previsão escolhido à mão:** fica só no `localStorage` do aparelho, numa chave própria (`apex.previsao.ponto`), fora de `apex.analise.v1`. Por isso não entra na sincronização. Um teste vai conferir que o payload de sync não tem essas coordenadas.

## 5. Compartilhar a imagem no Safari do iPhone

**Fonte:**
- MDN, páginas `Navigator.share` e `Navigator.canShare`;
- dados oficiais de compatibilidade do MDN (`@mdn/browser-compat-data` 8.1.10).

| Pergunta | Resposta |
|---|---|
| Compartilhar arquivo (`files`) no iPhone | Desde o **iOS 14**, no Safari e no app instalado na tela inicial (WebView do iOS, mesma versão). O `canShare` também existe desde o iOS 14 |
| Exigências | Só em HTTPS (o GitHub Pages é HTTPS). A chamada precisa vir logo depois de um toque do usuário: sem isso, o navegador recusa com `NotAllowedError` |
| "Salvar imagem" no Fotos | É uma opção da folha de compartilhar do iOS, para imagens. Não está nas páginas do MDN, que descrevem a API e não a folha do iPhone. **Confirme no seu iPhone na Etapa 3** |
| Cuidado conhecido | Se a imagem for gerada depois do toque e demorar, o iPhone pode recusar o compartilhar. Por isso a imagem do plano será gerada **antes** do toque, ao abrir a tela, e o botão só a entrega |

O app já usa esse caminho nos cards de compartilhar (`shareOrDownload`): se o aparelho não compartilha arquivo, a imagem é baixada. No computador, o botão é "Baixar imagem do plano".

## Outras descobertas

- **Funções do motor que a Fase 4 vai reaproveitar:** `gradeCostMult`, `riegel` e `bestAnchor` existem e estão exportadas no `engine.mjs`. Serão importadas, sem cópia.
- **Leitor de .FIT:** o prompt cita o `fit-file-parser`. O app novo lê .FIT com o `@garmin/fitsdk`, o mesmo da importação de treinos, que também funciona sem internet. Proponho usar o mesmo para o percurso. O `fit-file-parser` continua no projeto para os módulos antigos.
- **Data de exemplo e o motor:** o motor tem como ciclo padrão uma maratona em `2027-03-28`. O critério 17 busca "28/03/2027", outro formato, que não existe no código. A data padrão do motor não muda.
- **Branch:** esta sessão trabalha no ramo `claude/new-session-842fjl`, o mesmo das fases anteriores. O prompt fala em `fase-4`. Posso criar esse ramo quando você autorizar o primeiro commit.

## Próxima etapa

Etapa 1: só documento, `docs/fase4-formulas.md`, com os 7 cálculos para você aprovar item por item.
