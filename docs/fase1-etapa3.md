# Fase 1 · Etapa 3 — Fotos, privacidade e compartilhar

Nenhum cálculo mudou. O formato de `apex.analise.v1` também não: entraram só 2 campos novos e opcionais, `privacy` no treino e `privacidadePadrao` no atleta. Fotos e miniaturas ficam no IndexedDB e não entram na sincronização.

## O que entrou

### Fotos do percurso
- **Onde adicionar:** no Completar, logo depois de importar o .FIT, e no Treino, na seção "Fotos do percurso".
- **Como o app encaixa cada foto:**
  - Lê a hora em que a foto foi tirada (`DateTimeOriginal`, via exifr). Não usa o GPS da foto.
  - Converte essa hora pelo fuso do treino, que vem do .FIT. Se o .FIT não tiver fuso, usa o fuso gravado na foto; se nenhum dos dois existir, o do aparelho.
  - Coloca a foto no ponto do trajeto mais próximo daquele horário.
- **Fora do percurso:** fotos a mais de 10 min do treino, ou sem horário, vão para essa seção. Ali dá para posicionar cada uma à mão (arrastando pelo trajeto) ou removê-la.
- **O que fica guardado:** só a miniatura (até 600 px, WebP), por id do treino.
- **No mapa:** as fotos aparecem no ponto onde foram tiradas, em Ruas e em Só trajeto. Tocar abre a foto. No replay, a foto "salta" quando o ponto passa por ela, a não ser que o aparelho peça menos movimento.
- **Reimportar o .FIT** reencaixa as fotos, menos as que você posicionou à mão.
- **Excluir o treino** apaga as fotos dele. Se um treino substitui outro, as fotos passam para o novo.

### Privacidade por treino
- **As opções:**
  - Mapa: completo, ocultar início e fim, ou sem mapa.
  - Raio: 200 m, 500 m ou 1 km.
  - Quem vê: só eu ou todos. "Todos" é a comunidade do app, que ainda não existe; por enquanto a escolha só fica guardada.
- **De onde vem:** do padrão em Configurações › Privacidade padrão, que é "ocultar · 500 m · todos", como no design. Cada treino pode mudar no escudo do topo do Treino ou no Completar.
- **Onde aparece:** o escudo fica no topo do Treino e na lista de Treinos.
- **Como "ocultar" funciona:** remove todo ponto a menos do raio da largada **e** da chegada, em linha reta sobre a Terra. A linha é cortada nesses trechos e nunca atravessa a zona escondida. Marcos de km dentro da zona também somem.
- **Quem vê o quê:** você sempre vê o treino completo. O filtro vale só para o que é compartilhado.

### Compartilhar
- **Como abrir:** pelo botão magenta "Compartilhar" no Treino. No celular, fica na gaveta; no computador, no topo do painel.
- **Formatos:** Stories, em 1080×1920, e Feed, em 1080×1350. Os dois saem em PNG.
- **Modelos:**
  - **Foto:** a foto escolhida no fundo (do treino ou da galeria), o trajeto em branco e magenta, os números e o logo branco.
  - **Mapa:** fundo escuro, trajeto colorido pelas suas zonas de FC e marcos de km.
  - **Só números:** o símbolo colorido e os números.
- **Números:** até 3. O padrão é distância, pace e tempo; na bike, a velocidade entra no lugar do pace.
- **Interruptor "Ocultar início e fim":** usa o raio do treino. Começa ligado quando a privacidade do treino é "ocultar". Com "Sem mapa", o modelo Mapa fica indisponível.
- **"Compartilhar imagem":** abre o menu nativo do celular. Se o aparelho não tiver esse menu, a imagem é baixada. **"Salvar"** sempre baixa.

## Critérios da Fase 1 atendidos nesta etapa

| # | Critério | Como foi verificado |
|---|---|---|
| 8 | 2 fotos dentro do treino caem no ponto certo (erro ≤ 1 amostra); a de fora vai para "Fora do percurso" | **Teste de fumaça:** 3 fotos geradas, com EXIF (06:10, 06:25:30 e 08:00), num .FIT com fuso −3 h. Resultado: pontos 600 e 1530 (esperados 600 e 1530), e a terceira em Fora do percurso. **Testes unitários:** fuso do treino, fuso da foto, margem de 10 min e leitura do EXIF. Com os seus .FIT reais, o fuso lido foi −3 h e o encaixe saiu exato. |
| 9 | Com "Ocultar · 500 m", nenhum ponto a menos de 500 m da largada ou da chegada no card | **Teste automático** sobre os pontos usados no desenho (linhas e marcos), com raios de 200, 500 e 1.000 m, num trajeto sintético e nos seus 3 .FIT. **No navegador:** o ponto mais próximo ficou a 549 m nos modelos Mapa e Foto. Com "Sem mapa", 0 pontos. |
| 10 | Stories em 1080×1920 e Feed em 1080×1350 (PNG); menu nativo ou download | **Teste de fumaça:** os 2 tamanhos medidos no PNG gerado. Com o menu nativo simulado (como o do iPhone), o PNG chega até ele. Sem o menu, o arquivo é baixado. **Ainda não testado num iPhone de verdade.** |

### Resultado dos testes
- `node analise/*.test.mjs` (6 arquivos), `npm run test:analise` (9 arquivos, com paridade, golden master e diferencial): todos verdes.
- `npm test`: 57 de 57. Entraram 15 testes novos, em `tests/share.test.ts`.
- Teste de fumaça: **76 de 76**. Entraram 22 verificações novas, sobre fotos, privacidade e compartilhar.
- Comparação de telas: os mesmos números da Etapa 2.
  - Exemplo: 508 de 511.
  - Sintético: 100%.
  - Seu backup: 1.334 de 1.356. A diferença são os 2 treinos de km corrigido, como antes.
- `npm run build` e `typecheck`: ok.

## Decisões que tomei (diga se quiser diferente)

1. **Sem o círculo pontilhado da zona escondida no card.** O design mostra esse círculo, mas o centro dele marcaria exatamente o lugar que se quer esconder. O trajeto só começa e termina fora da zona.
2. **Modelo Mapa sem ruas.** O card desenha o trajeto sobre fundo escuro, sem as ruas do mapa. Assim funciona sem internet e não mostra o bairro em volta. Dá para pôr as ruas, mas o card fica mais lento para gerar e depende de internet.
3. **Foto do card:** a foto do treino é a miniatura guardada (600 px), então no Stories fica um pouco suave. Para a melhor qualidade, escolha a foto na galeria: ela entra em resolução cheia e não fica guardada no app.
4. **Seu treino de 17/11 (5,28 km):** fica todo a menos de 160 m da largada ou da chegada. Com "ocultar · 500 m", não sobra trajeto. O card sai sem mapa e a tela explica o porquê.
5. **Quem vê:** é só guardado, até existir a comunidade (Fase 6).

## Respostas do Lucas (20/11)

1. **Fotos reais:** ele não tem fotos dos treinos. O encaixe fica validado com as fotos geradas no teste (EXIF verdadeiro) e com os seus .FIT reais.
2. **Cadência no ritmo de referência:** mantida no Progresso.
3. **Commit e push:** autorizados.

## Pontos em aberto

1. **iPhone:** confira o menu de compartilhar no seu celular depois da publicação.
