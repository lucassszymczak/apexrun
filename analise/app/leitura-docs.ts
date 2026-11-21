// Verbetes do Livro de fórmulas para a leitura do treino (Fase 2 · itens aprovados em 20/11,
// docs/fase2-formulas.md). Mesmo formato dos verbetes do motor (name, desc, formula, fields, conf).
export type Doc = { key: string; name: string; cat: string; desc: string; formula: string; fields: string; conf: string; fonte: string };
const CAT = 'Leitura do treino';
export const LEITURA_DOCS: Doc[] = [
  {
    key: 'clima-padrao', name: 'Pace em clima padrão', cat: CAT, conf: 'Baixa a Moderada',
    desc: 'Estimativa do seu pace com 8–18 °C e orvalho até 14 °C, pela regra temperatura + orvalho. É uma correção prática, útil para comparar treinos em dias quentes e úmidos.',
    formula: 'soma = temperatura (°F) + orvalho (°F)\ncorreção pela tabela (meio da faixa):\n≤100: 0% · 101–110: 0,25% · 111–120: 0,75% · 121–130: 1,5%\n131–140: 2,5% · 141–150: 3,75% · 151–160: 5,25%\n161–170: 7% · 171–180: 9% · >180: não aparece\npace em clima padrão = pace real × (1 − correção)',
    fields: 'Pace do treino e clima do Open-Meteo na hora do treino. Não aparece em clima padrão, no frio (< 8 °C), no calor extremo ou sem clima.',
    fonte: 'Regra de Mark Hadley (Runner\'s World). Ely, M. R. et al., Med Sci Sports Exerc 39(3), 2007.',
  },
  {
    key: 'vento', name: 'Vento por trecho', cat: CAT, conf: 'Baixa',
    desc: 'Componente do vento na direção em que você corria, trecho a trecho (Open-Meteo, a 10 m de altura). A favor, lateral ou contra. É indicativo: a rua pode ter mais ou menos vento.',
    formula: 'componente = vento × cos(para onde o vento sopra − seu rumo)\na favor: ≥ +40% do vento · contra: ≤ −40% · entre: lateral\nvento < 5 km/h: "vento fraco"\ncusto contra ≈ pace × f_ar × ((v + c)² − v²) / v², f_ar = 0,04 × (v / 5)²',
    fields: 'Trajeto com GPS e vento do Open-Meteo (velocidade e direção) na hora do treino.',
    fonte: 'Pugh, L. G. C. E., J Physiol 213, 1971. Davies, C. T. M., J Appl Physiol 48, 1980.',
  },
  {
    key: 'inicio-deriva', name: 'Início da deriva', cat: CAT, conf: 'Moderada',
    desc: 'O km em que a sua eficiência (pace ajustado à inclinação ÷ FC) caiu 5% abaixo do seu começo de treino e não voltou. Mostra até onde a sua base aeróbia segura o ritmo.',
    formula: 'EF do km = velocidade GAP ÷ FC média do km\nbase = mediana da EF do km 3 ao fim do 1º terço\ninício = 1º km em que a média de 2 km seguidos e a média do resto ficam < base × 0,95\nfora: último km incompleto e sprint final',
    fields: 'Splits de 1 km com FC. Só treinos contínuos (Fácil, Regenerativo, Longão, Tempo, Limiar, Prova) com 8 km ou 45 min.',
    fonte: 'Friel, J., The Triathlete\'s Training Bible. Maunder, E. et al., Sports Med 51, 2021.',
  },
  {
    key: 'tiros', name: 'Tiros', cat: CAT, conf: 'Alta (estruturado) · Moderada (voltas) · Baixa (automática)',
    desc: 'As voltas de esforço do treino. Vêm do treino estruturado do relógio, das voltas que você marcou ou de voltas por tempo ou distância que alternam rápido e lento. O km automático não conta.',
    formula: '1) treino estruturado: voltas "active"\n2) voltas que alternam: corte no maior salto de velocidade, grupo rápido ≥ 15% mais rápido, ≥ 3 tiros, voltas < 10 min\n   medida: distância (variação < 5%, arredonda 50 m), senão tempo (< 5%), senão "N tiros"\n3) sem voltas: detecção automática (média de 15 s acima da mediana + 15%, mín. +0,4 m/s, trechos de 45 s a 10 min)\nregularidade = variação (CV) do pace dos tiros',
    fields: 'Voltas do .FIT (lap, intensity, workout_step) ou o trajeto completo.',
    fonte: 'Convenção do Garmin FIT SDK (lap_trigger, intensity). A detecção automática não tem fórmula publicada.',
  },
  {
    key: 'melhor-esforco', name: 'Melhor esforço', cat: CAT, conf: 'Alta (GPS bom) · Moderada (gravação inteligente)',
    desc: 'O trecho contínuo mais rápido de cada distância (400 m, 800 m, 1 km, 5 km, 10 km, 21,1 km) dentro de um treino, pelo tempo do relógio. Só treinos com trajeto entram.',
    formula: 'janela mais curta em tempo decorrido que cobre a distância\ndistância interpolada entre os pontos\njanela com pausa > 60 s não vale\nRecorde pessoal: melhor de todos os treinos com trajeto\nMelhor do ciclo: melhor desde o início do ciclo atual',
    fields: 'Trajeto completo (1 Hz) e distância do relógio. Não aparece em esteira nem em distâncias maiores que o treino.',
    fonte: 'Convenção de best efforts (Strava Support, "Best Efforts").',
  },
  {
    key: 'custo-subida', name: 'Custo da subida', cat: CAT, conf: 'A do GAP do treino',
    desc: 'A diferença entre o seu pace real e o pace ajustado à inclinação (GAP) em cada faixa de inclinação. Mostra quanto as subidas pesaram no seu ritmo.',
    formula: 'faixas do motor: < −5% · −5 a −2% · ±2% · 2 a 5% · > 5%\npor faixa: tempo, pace real, GAP (vGap do motor) e FC\ncusto = pace real − GAP (s/km)\ntítulo: faixa de subida com ≥ 3 min e maior custo\ncurva pessoal: mediana do custo por faixa no período (≥ 3 treinos)',
    fields: 'Trajeto com altitude. Não aparece em esteira.',
    fonte: 'GAP do motor (Minetti, A. E. et al., J Appl Physiol 93, 2002).',
  },
  {
    key: 'historia', name: 'História do treino', cat: CAT, conf: 'A de cada número citado',
    desc: 'Três frases, sempre na mesma ordem: o que foi bem, o que observar e o que fazer amanhã. São regras fixas com os limiares que o app já usa; não é texto gerado por IA.',
    formula: 'bem: recorde > deriva < 5% > tiros com variação < 3% > negative split > EF acima da mediana de 30 dias > "treino cumprido"\nobservar: dor > deriva > 8% > RPE ≥ 7 em fácil > clima fora do padrão > "nada fora do normal"\namanhã: Recuperar ou TSB < −20 > plano da semana > "rodagem leve, em Z2"',
    fields: 'Números do próprio treino, do plano da semana e da prontidão.',
    fonte: 'Regras e limiares do app (deriva 5 e 8%, prontidão, TSB).',
  },
];
const CAT4 = 'Plano de prova';
LEITURA_DOCS.push(
  {
    key: 'pace-alvo', name: 'Pace alvo por km', cat: CAT4, conf: 'A do percurso',
    desc: 'Em que pace correr cada km para fechar no tempo-alvo com o mesmo esforço na subida e no plano. Na subida, cada 1% pesa 3,5%; na descida, cada 1% alivia 1,5% (a mesma regra do GAP do app).',
    formula: 'pace do km = P × gradeCostMult(inclinação do km)\nP é o pace no plano, escolhido para a soma dos km dar o tempo-alvo\ninclinação do km: altitude a cada 100 m, suavizada em 500 m',
    fields: 'Tempo-alvo do ciclo e, se houver, o percurso. Sem percurso, o pace é o mesmo do início ao fim.',
    fonte: 'Modelo de GAP do motor (Minetti, A. E. et al., J Appl Physiol 93, 2002).',
  },
  {
    key: 'segunda-metade', name: 'Segunda metade mais rápida', cat: CAT4, conf: 'Moderada',
    desc: 'Começa mais contido e acelera depois da metade, no mesmo tempo final: cada km da 1ª metade fica 1% mais lento que o plano constante, e cada km da 2ª, 1% mais rápido.',
    formula: '1ª metade: pace × 1,01 · 2ª metade: pace × 0,99\ndepois, tudo é ajustado junto para fechar no tempo-alvo',
    fields: 'Estratégia escolhida em Editar ciclo.',
    fonte: 'Díaz, J. J. et al., Eur J Sport Sci 18(6), 2018 e 19(10), 2019; March, D. S. et al., J Strength Cond Res 25(2), 2011. O valor de 1% é decisão do Lucas, não vem de estudo.',
  },
  {
    key: 'clima-plano', name: 'Clima no plano', cat: CAT4, conf: 'Baixa a Moderada',
    desc: 'Quanto o calor e a umidade do dia da prova pesam no pace. Faltando 16 dias ou menos, cada km recebe a correção da hora em que você estará nele. Antes disso, o plano usa o clima padrão.',
    formula: 'correção da hora = regra temperatura + orvalho (0 em clima padrão)\npace do km = pace do plano × (1 + correção da hora)\nmais de 16 dias antes, sem previsão ou sem local: clima padrão',
    fields: 'Previsão do Open-Meteo para o local de largada do percurso e o horário da largada.',
    fonte: 'Regra de Mark Hadley; Ely, M. R. et al., Med Sci Sports Exerc 39(3), 2007.',
  },
  {
    key: 'tempo-realista', name: 'Tempo realista', cat: CAT4, conf: 'Moderada (âncora de prova ou teste) · Baixa (treino comum)',
    desc: 'Que tempo é honesto esperar hoje, numa faixa. Parte da projeção de Riegel do seu melhor esforço e soma o percurso e o clima. Na maratona, a ponta lenta soma 20 min. Estimativa, não garantia: o app não prevê ganho de treino.',
    formula: 'Riegel: tempo = tempo da âncora × (distância ÷ distância da âncora)^1,06\nmaratona (30 km ou mais): de Riegel a Riegel + 20 min\nabaixo de 30 km: Riegel ± 2,5%\n× (1 + custo do percurso) × (1 + correção do clima)\n"Terminar bem": o plano usa a ponta lenta',
    fields: 'A âncora do card "Estimativa de prova" (prova ou teste mais recente; sem eles, o treino mais recente).',
    fonte: 'Riegel, P. S., American Scientist 69, 1981; Vickers, A. J. e Vertosick, E. A., BMC Sports Sci Med Rehabil 8:26, 2016 (Riegel erra para menos na maratona de amadores: metade termina 10 min ou mais acima, um quarto 20 min ou mais).',
  },
);
LEITURA_DOCS.push(
  {
    key: 'semana-consistente', name: 'Semana consistente', cat: 'Evolução', conf: 'Alta (conta das horas registradas)',
    desc: 'De segunda a domingo, pelo menos 80% das horas da sua meta e pelo menos 1 dia de descanso. O descanso conta a favor. A semana atual não quebra a sequência.',
    formula: 'semana = segunda a domingo, horário de Brasília\nhoras = soma da duração de corrida, pedal e força da semana\nmeta = a sua (Configurações › Treino) ou, em branco, a média das 4 semanas anteriores com treino, arredondada a 0,5 h, mínimo de 1 h\nconsistente = horas ≥ 80% da meta E pelo menos 1 dia sem treino\nparcial = treinou, mas não fechou a regra · sem treino = 0 h\nsequência = semanas consistentes seguidas até a última semana encerrada; a semana em andamento não quebra',
    fields: 'Data e duração dos treinos. A semana atual aparece como "em andamento" até domingo.',
    fonte: 'Regra do app, aprovada em 21/11/2026 (docs/fase3-formulas.md, item 6).',
  },
);
LEITURA_DOCS.push(
  {
    key: 'mapa-calor', name: 'Mapa de calor', cat: 'Evolução', conf: 'Alta (contagem dos trajetos)',
    desc: 'As ruas por onde você treinou, coloridas pelo número de treinos que passaram por elas. Cada treino conta uma vez por trecho de 25 m, mesmo que vá e volte. Só você vê.',
    formula: 'o mapa é dividido em quadrículas de 25 m\ncada treino marca as quadrículas por onde passou (o trajeto é preenchido a cada 5 m), uma vez cada\npassagens da quadrícula = número de treinos que passaram por ela\nfaixas: 1–2 · 3–5 · 6–10 · 11–19 · 20 ou mais\nkm de ruas diferentes ≈ quadrículas × 25 m\nrua tocada = a quadrícula mais perto e as vizinhas com exatamente os mesmos treinos\ncorrida e pedal nunca se misturam',
    fields: 'Trajeto com GPS salvo neste aparelho (completo ou a versão leve). Esteira, bike indoor e treinos sem trajeto ficam de fora, com aviso.',
    fonte: 'Regra do app, aprovada em 21/11/2026 (docs/fase3-formulas.md, item 1).',
  },
);
LEITURA_DOCS.push(
  {
    key: 'segmento', name: 'Segmento', cat: 'Evolução', conf: 'Alta (trajeto completo, 1 s) · Moderada (versão leve, ±5 s)',
    desc: 'Um trecho de 500 m ou mais que você percorreu no mesmo sentido em pelo menos 3 treinos. O app encontra sozinho; você pode renomear. Só você vê.',
    formula: 'corredor de 25 m: a quadrícula do mapa de calor ou a vizinha\nida e volta são segmentos separados\nsobreposição: fica o de mais passagens; no empate, o mais longo; o outro é cortado e sai se ficar com menos de 500 m\naté 40 por modalidade; corrida e pedal separados\npassagem: do ponto do trajeto mais perto do início ao mais perto do fim (tempo decorrido); uma por treino, a mais rápida\nnome automático: Subida (> +2%), Descida (< −2%) ou Plano, e a distância',
    fields: 'Trajetos com GPS neste aparelho. Com a versão leve do trajeto, o tempo tem cerca de ±5 s.',
    fonte: 'Regra do app, aprovada em 21/11/2026 (docs/fase3-formulas.md, item 2).',
  },
  {
    key: 'tempo-ajustado', name: 'Tempo ajustado', cat: 'Evolução', conf: 'A do GAP do treino',
    desc: 'O tempo do trecho como se fosse plano e em clima padrão. Usa o GAP do app e a regra temperatura + orvalho. Só corrida.',
    formula: '1) tempo no plano = tempo × (distância ÷ distância GAP), com o vGap do motor segundo a segundo\n2) ajustado = tempo no plano × (1 − correção do clima)\ncorreção do clima = regra temperatura + orvalho (a mesma do pace em clima padrão); em clima padrão, 0\nsem clima salvo: só a inclinação ("sem clima")',
    fields: 'Velocidade e inclinação do trajeto; clima do treino (Open-Meteo). Pedal: só o tempo real.',
    fonte: 'Regra do app, aprovada em 21/11/2026 (docs/fase3-formulas.md, item 3). GAP: Minetti, A. E. et al., J Appl Physiol 93, 2002. Clima: regra de Mark Hadley.',
  },
  {
    key: 'tendencia', name: 'Tendência no segmento', cat: 'Evolução', conf: 'Moderada',
    desc: 'A média das suas 3 passagens mais recentes comparada com a das 3 anteriores. Diferença de 2% ou mais vira mais rápido ou mais lento; menos que isso, estável.',
    formula: 'tempo = ajustado na corrida, real no pedal\ndiferença = (média das 3 anteriores − média das 3 recentes) ÷ média das 3 anteriores\n≥ +2%: mais rápido · ≤ −2%: mais lento · entre: estável\nmenos de 6 passagens: "poucas passagens"',
    fields: 'Pelo menos 6 passagens no segmento.',
    fonte: 'Regra do app, aprovada em 21/11/2026 (docs/fase3-formulas.md, item 4).',
  },
);
export const leituraDoc = (k: string): Doc | null => LEITURA_DOCS.find((d) => d.key === k || d.name === k) || null;
