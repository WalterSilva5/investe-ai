/**
 * Currículo do módulo de ensino: lições com teoria, exemplo com DADOS REAIS do
 * app e exercício validado ao vivo. O conteúdo é autoral (didática própria);
 * fontes externas (ex.: ebook) podem ser anexadas por lição via `sources`.
 */

export type ExerciseType = 'trend' | 'support' | 'resistance' | 'rsi-zone' | 'ratio' | 'quiz' | 'halving-days';

export interface LessonSection {
  title: string;
  text: string;
}

export interface Lesson {
  id: string;
  emoji: string;
  title: string;
  summary: string;
  /** Trilha de formação; quando ausente, deriva do prefixo do id (cripto/ ou fundamentos). */
  track?: string;
  sections: LessonSection[];
  /** Símbolo real usado no exemplo e no exercício (dados do app). */
  symbol: string;
  exercise: {
    type: ExerciseType;
    question: string;
    hint: string;
    /** Opções quando o tipo é de múltipla escolha. */
    choices?: string[];
    /** Resposta fixa para quizzes conceituais (sem dados de mercado). */
    answer?: string;
    /** Explicação do gabarito (quiz). */
    explanation?: string;
  };
  sources: string[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'leitura-grafico',
    emoji: '📈',
    title: 'Como ler um gráfico de preço',
    summary: 'Eixos, janela de tempo e o que o preço está contando.',
    sections: [
      {
        title: 'Os dois eixos',
        text: 'No eixo horizontal está o TEMPO (dias, semanas) e no vertical o PREÇO. Cada ponto é o fechamento de um pregão. Antes de qualquer análise, escolha a janela: 30 dias mostra o curtíssimo prazo, 1 ano mostra o ciclo. A mesma ação parece "em queda" em 1 mês e "em alta" em 5 anos — a janela é parte da análise.',
      },
      {
        title: 'Linha vs candles',
        text: 'A linha de fechamento é o suficiente para começar. Candlesticks mostram abertura, máxima, mínima e fechamento de cada dia: o corpo é a abertura→fechamento e as pavias são as extremidades. Corpo verde/azul = dia de alta; vermelho = dia de baixa. Candles servem para ver CONFLITO do dia; a linha serve para ver DIREÇÃO.',
      },
      {
        title: 'O que o gráfico não diz',
        text: 'Gráfico mostra o que JÁ aconteceu. Ele não sabe se a empresa vai bater lucro, se o governo vai mudar a regra ou se vem notícia. Por isso preço é uma das três pernas da análise (com fundamentos e cenário) — nunca a única.',
      },
    ],
    symbol: 'PETR4',
    exercise: {
      type: 'trend',
      question: 'Olhando o gráfico ao lado (e a leitura de tendência do app), qual é a tendência atual deste papel?',
      hint: 'Pense no conjunto: o preço está acima ou abaixo das médias? Os topos e fundos estão subindo ou descendo?',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'suporte-resistencia',
    emoji: '🧱',
    title: 'Suporte e resistência',
    summary: 'As zonas onde o preço costuma parar — e o que acontece quando rompe.',
    sections: [
      {
        title: 'O que são',
        text: 'SUPOORTE é uma zona de preço onde historicamente aparecem compradores e a queda desacelera (um "piso"). RESISTÊNCIA é onde aparecem vendedores e a alta desacelera (um "teto"). Eles surgem de topos e fundos anteriores: onde muita gente comprou/vendeu, aquela região fica na memória do mercado.',
      },
      {
        title: 'Por que funcionam (e quando falham)',
        text: 'Eles funcionam porque convergem decisões de muita gente (quem ficou no prejuízo quer sair no empate, quem vendeu quer recomprar). Mas não são leis: NOTÍCIAS E CICLOS rompem níveis. Rompimento com volume forte costuma continuar; rompimento fraco ("falso rompimento") volta para dentro. Regra prática: nível testado várias vezes fica mais fraco, não mais forte.',
      },
      {
        title: 'Como o app calcula',
        text: 'O Tracking marca S1–S3 e R1–R3 com mínimas e máximas locais agrupadas — são REFERÊNCIAS para você observar, não ordens. Se o preço está a 1% de um suporte, o ganho até a resistência é pequeno e o risco até o piso grande: a relação ganho/risco ruim é o sinal para esperar.',
      },
    ],
    symbol: 'PETR4',
    exercise: {
      type: 'support',
      question: 'Qual é o preço do suporte mais próximo (S1) deste papel agora? (com tolerância de 3%)',
      hint: 'Veja a linha tracejada verde "S1" no gráfico e a linha "Suporte" no card de níveis.',
    },
    sources: ['conteúdo autoral do app', 'método de mínimas/máximas locais do Tracking'],
  },
  {
    id: 'tendencia-medias',
    emoji: '🧭',
    title: 'Tendência e médias móveis',
    summary: 'MM20 e MM50: a direção "oficial" do papel e como ler cada combinação.',
    sections: [
      {
        title: 'O que é uma média móvel',
        text: 'A MM20 é o preço médio dos últimos 20 pregões — uma linha suavizada que anda junto com o preço. MM50 = 50 pregões. Serve para responder uma pergunta simples: o preço médio recente está SUBINDO ou DESCENDO?',
      },
      {
        title: 'As três tendências',
        text: 'ALTA: preço acima da MM20 e MM20 acima da MM50 (escalera subindo). BAIXA: preço abaixo da MM20 e MM20 abaixo da MM50. LATERAL: médias cruzadas ou preço no meio — sem direção definida. Tendência lateral é a mais perigosa para iniciante: parece oportunidade dos dois lados e não é nenhum.',
      },
      {
        title: 'Erro clássico',
        text: '"Está barato" não significa tendência de alta. Papel 40% abaixo da MM50 pode continuar caindo — médias não criam piso. Elas dizem QUAL É O MOMENTO, não qual é o fundo. Por isso o app separa "leitura" (o que é) de "gatilho" (o que faria mudar).',
      },
    ],
    symbol: 'VALE3',
    exercise: {
      type: 'trend',
      question: 'Qual é a tendência atual de VALE3 segundo a leitura de médias do app?',
      hint: 'Preço acima/abaixo da MM20 e da MM50 — a resposta é alta, baixa ou lateral.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'momentum-rsi',
    emoji: '🌡️',
    title: 'Momentum e RSI',
    summary: 'O termômetro 0–100 e por que sobrevenda não é "sinal de compra".',
    sections: [
      {
        title: 'O que o RSI mede',
        text: 'RSI (14) compara a força das altas contra as baixas dos últimos 14 pregões, numa escala 0–100. Acima de 70 = SOBRECOMPRA (subiu rápido demais, pode esfriar). Abaixo de 30 = SOBREVENDA (caiu rápido demais, pode repicar). 45–65 é zona neutra.',
      },
      {
        title: 'O erro que quebra iniciante',
        text: 'Sobrevenda NÃO é sinal de compra. Em papel com notícia ruim ou queda estrutural, o RSI pode ficar "pregado" abaixo de 30 por semanas — e continua caindo. Sobrevenda diz VELOCIDADE, não fundo. O app usa RSI como CONTEXTO (junto de suporte e tendência), nunca sozinho.',
      },
      {
        title: 'Como usar bem',
        text: 'Combinação útil: RSI baixo + preço ENCOSTADO em suporte + papel que você já conhece = cenário a observar. RSI alto + preço esticado acima das médias = momento de NÃO aumentar posição. O Radar contrário do app cruza exatamente esses sinais (RSI, suporte, ganho/risco) — use-o como treino.',
      },
    ],
    symbol: 'BTC',
    exercise: {
      type: 'rsi-zone',
      question: 'Em que zona está o RSI(14) do BTC agora?',
      hint: 'O app mostra o RSI no card de indicadores; a resposta é sobrecompra, neutro ou sobrevenda.',
      choices: ['sobrecompra', 'neutro', 'sobrevenda'],
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'ganho-risco',
    emoji: '⚖️',
    title: 'Ganho/risco: a conta antes da decisão',
    summary: 'Alvo × piso, a relação N:1 e por que ela filtra 80% das entradas ruins.',
    sections: [
      {
        title: 'A conta',
        text: 'GANHO = distância até a resistência mais próxima (onde faria sentido realizar). RISCO = distância até o suporte (onde a leitura falha). RELAÇÃO = ganho ÷ risco. Ex.: ganho +5%, risco −2% → 2,5:1. Ganho +1%, risco −4% → 0,25:1 (você arrisca 4 para ganhar 1).',
      },
      {
        title: 'Como filtrar',
        text: 'Antes de qualquer decisão, a conta precisa justificar. Relação abaixo de 1:1 significa "arrisco mais do que ganho" — em geral só vale se você tiver uma tese FORA do gráfico (fundamento forte, catalisador claro) e aceitar o risco consciente. O card de Resumo do Tracking mostra essa conta automaticamente com os níveis atuais.',
      },
      {
        title: 'O que a relação não cobre',
        text: 'Ela assume que os níveis vão se segurar. Papel com notícia quebrando suporte não respeita a conta. Por isso tamanho de posição importa mais que acertar: errar pequeno é sobreviver; acertar grande é bônus. Nunca confunda relação boa com certeza.',
      },
    ],
    symbol: 'ABEV3',
    exercise: {
      type: 'ratio',
      question: 'Qual é a relação ganho/risco atual (até a resistência ÷ até o suporte)? (tolerância 0,2)',
      hint: 'Card "Suporte / resistência" no Tracking, ou a linha "Relação ganho/risco" no resumo.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'ciclos-diversificacao',
    emoji: '🔄',
    title: 'Ciclos e diversificação',
    summary: 'Tudo gira: halving, juros, narrativas. E por que nunca tudo em uma aposta.',
    sections: [
      {
        title: 'Ciclos existem em todo mercado',
        text: 'Bitcoin tem o ciclo do halving (~4 anos; os fundos históricos ocorreram ~500 dias ANTES do halving e os topos 380–550 dias depois). Ações seguem o ciclo de juros: Selic alta empurra dinheiro para renda fixa e pune bolsas; a queda de juros faz o contrário. Narrativas (IA, cripto, agro) também giram: emergente → hype → desilusão → maturação — o Radar do app marca em qual estágio cada tema está.',
      },
      {
        title: 'Diversificação não é "10 ações"',
        text: 'Diversificar é evitar risco QUE NÃO PAGA: setores diferentes, classes diferentes (ações, FIIs, renda fixa, cripto em doses homeopáticas) e tamanhos de posição que não doem. Duas ações de banco não são diversificação. O próprio app é multi-workspace: separe PF de PJ e objetivos diferentes.',
      },
      {
        title: 'A regra que sobrevive a tudo',
        text: 'Tamanho de posição antes de certezas: nunca uma posição que, se falhar, te tire do jogo. Aprenda primeiro com tamanhos pequenos — o paper trading do app existe exatamente para treinar a MÃO sem arriscar dinheiro.',
      },
    ],
    symbol: 'BTC',
    exercise: {
      type: 'ratio',
      question: 'Contexto final: olhe o ganho/risco de BTC agora. Está acima de 1,5:1 (a favor) ou abaixo (contra)?',
      hint: 'Compare os percentuais até a resistência e até o suporte no card do Tracking.',
      choices: ['favorável (≥ 1,5:1)', 'contra (< 1,5:1)'],
    },
    sources: ['conteúdo autoral do app', 'ciclo do halving (módulo market/halving)'],
  },
  // ── Trilha de cripto ──────────────────────────────────────────────────────
  {
    id: 'cripto-101',
    emoji: '🪙',
    title: 'Cripto 101: por onde começar',
    summary: 'O que é, por que BTC é o principal e como lidar com a volatilidade real.',
    sections: [
      {
        title: 'O que é (sem hype)',
        text: 'Cripto é dinheiro digital sem banco central: o Bitcoin é uma rede que registra quem tem o quê em um livro público (blockchain) verificado por milhares de computadores. Ninguém "emite" mais BTC do que o código permite — isso é diferente do real, onde o Banco Central controla a oferta.',
      },
      {
        title: 'Comece pelo Bitcoin',
        text: 'BTC é o ativo mais líquido e com o histórico mais longo (2009+). ETH vem depois (poderia "acompanhar o ciclo" — no app, o card de halving cobre os dois). Altcoins são o risco multiplicado: a maioria delas MORRE (desvaloriza até quase zero em poucos anos). Se está começando, o raciocínio é: BTC primeiro, tamanhos pequenos, e altcoin só com sobra de capital e pesquisa própria.',
      },
      {
        title: 'A volatilidade é o preço de entrada',
        text: 'Quedas de 70–85% aconteceram em TODOS os ciclos do BTC (veja a tabela do card de halving). Quem entrou com tudo perto do topo não sobreviveu psicologicamente. Volatilidade anual do BTC gira em torno de 40–60% — o card do Tracking mostra a de hoje. Comece com valor que não faz falta; aportes pequenos e regulares (DCA) são o caminho clássico.',
      },
    ],
    symbol: 'BTC',
    exercise: {
      type: 'trend',
      question: 'Qual é a tendência atual do BTC segundo a leitura de médias do app?',
      hint: 'O mesmo exercício da aula de tendência, agora com o BTC: preço vs MM20 vs MM50.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'cripto-custodia',
    emoji: '🔐',
    title: 'Custódia: quem guarda suas chaves',
    summary: 'Exchange × carteira própria — "not your keys, not your coins".',
    sections: [
      {
        title: 'As três formas',
        text: 'EXCHANGE (Binance, Mercado Bitcoin…): cômodo para comprar e vender, mas as chaves são DA exchange — se ela quebrar (FTX, Mt. Gox), seu saldo entra na fila dos credores. HOT WALLET (carteira no celular/PC): você tem as chaves, conecta à internet — para valores do dia a dia. COLD WALLET (hardware wallet, tipo Ledger/Trezor): as chaves ficam OFFLINE — o padrão para guardar de longo prazo.',
      },
      {
        title: 'Seed phrase (frase de recuperação)',
        text: 'São 12–24 palavras que REGENERAM sua carteira em qualquer lugar. Quem tem as palavras, tem o dinheiro — não existe "esqueci minha senha" nem suporte que recupera. Regra absoluta: NUNCA digite a seed em site/aplicativo, NUNCA envie por foto/mensagem/nuvem. Anote em papel/aço e guarde em local físico seguro.',
      },
      {
        title: 'A regra prática',
        text: '"Not your keys, not your coins". Balanço comum: valores pequenos de trade ficam na exchange; o núcleo da posição migra para cold wallet. Teste sempre: envie um valor PEQUENO primeiro, confirme a chegada, só depois envie o resto. Erro de endereço em cripto é irreversível — não existe estorno.',
      },
    ],
    symbol: 'BTC',
    exercise: {
      type: 'quiz',
      question: 'Para guardar o núcleo de uma posição de BTC por vários anos, qual é a forma de custódia mais adequada?',
      hint: 'Pense em quem controla as chaves e se a chave fica offline.',
      choices: ['exchange', 'hot wallet', 'cold wallet'],
      answer: 'cold wallet',
      explanation:
        'Cold wallet: as chaves ficam offline, fora do alcance de hack de exchange ou congelamento. Exchange é para negociar; hot wallet, para o dia a dia. E a seed phrase nunca sai do papel.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'cripto-seguranca',
    emoji: '🛡️',
    title: 'Segurança: golpes e higiene',
    summary: 'Em cripto o estorno não existe — a deficiência mais barata é a prevenção.',
    sections: [
      {
        title: 'Os golpes clássicos',
        text: 'PHISHING: site/idêntico do seu wallet que rouba a seed (sempre confira o domínio letra a letra e use favorito). "SUPPORT": alguém chama no Telegram/WhatsApp fingindo suporte da exchange — NUNCA pedem seed, quem pede é golpista. RUG PULL: token de "oportunidade única" cujo criador some com a liquidez. FALSO RENDER: "invista aqui que dobro seu BTC" — esquema Ponzi.',
      },
      {
        title: 'Higiene mínima',
        text: '2FA por APP (Google Authenticator) — NUNCA por SMS (clonagem de chip é real). Senha única por serviço, gerenciador de senhas. Endereço de contrato: teste com valor pequeno. Seed: papel/aço, nunca foto/nuvem/nuvem de senha. Update de firmware da cold wallet só pelo site oficial.',
      },
      {
        title: 'O teste da dúvida',
        text: 'Se a oferta pressiona urgência ("só hoje"), promete retorno garantido ou pede sua seed/chave — é golpe, sem exceção. Retorno garantido em cripto não existe: até o BTC cai 80%. Desconfiança barata vale mais que prejuízo caro.',
      },
    ],
    symbol: 'ETH',
    exercise: {
      type: 'quiz',
      question: 'Um "suporte oficial" chama você no Telegram dizendo que precisa validar sua seed phrase para "migrar a carteira". O que fazer?',
      hint: 'Quem é legítimo NUNCA pede a seed phrase.',
      choices: ['enviar a seed para validar', 'nunca compartilhar e denunciar como golpe', 'digitar a seed no site que ele enviou'],
      answer: 'nunca compartilhar e denunciar como golpe',
      explanation:
        'Nenhum serviço legítimo pede seed phrase — 100% dos casos são golpe. A seed é a chave do cofre: quem a tem, retira tudo e não há estorno.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'cripto-tributacao',
    emoji: '💸',
    title: 'Tributação de cripto no Brasil',
    summary: 'Isenção mensal, alíquotas e declaração — o básico para não se surpreender.',
    sections: [
      {
        title: 'A regra geral (educacional, confira com contador)',
        text: 'Venda de cripto com ganho: tributável em DARF. Vendas totais até R$ 35 MIL no MÊS (soma de TODAS as criptos) em exchanges NACIONAIS costumavam ser isentas; operações em exchanges estrangeiras eself-custody passaram a ter tributação desde a IN 1888 (2023) mesmo abaixo da faixa. Alíquota histórica: 15% sobre o ganho (até R$ 5 mi de ganho), 22,5% para ganhos curtos em regras antigas — as faixas mudam, CONFIRME no site da Receita.',
      },
      {
        title: 'O que a Receita enxerga',
        text: 'Desde 2023 exchanges brasileiras reportam operações à Receita (IN 1888). Transferência ENTRE carteiras próprias não é venda (não gera imposto), mas compra com cripto, pagamento e swap são eventos taxáveis. Guardar histórico de TODAS as operações é obrigação sua — o app guarda transações, use-o.',
      },
      {
        title: 'O aviso importante',
        text: 'Tributação muda todo ano e depende do seu caso (carteira total, exchange, mês). Este módulo é EDUCACIONAL: use como mapa, não como orientação fiscal final. Na dúvida real de valores, contador ou o site da Receita.',
      },
    ],
    symbol: 'ETH',
    exercise: {
      type: 'quiz',
      question: 'Você vendeu R$ 20 mil em cripto no mês (exchange nacional). De forma geral, essa operação é tributável?',
      hint: 'Existe um limite mensal de vendas somadas abaixo do qual era isento (nas exchanges nacionais).',
      choices: [
        'sim, toda venda é tributável',
        'não, abaixo do limite mensal de R$ 35 mil (exchanges nacionais) era isento',
        'só é tributável se o ganho passar de R$ 1 milhão',
      ],
      answer: 'não, abaixo do limite mensal de R$ 35 mil (exchanges nacionais) era isento',
      explanation:
        'A isenção histórica cobria vendas totais de até R$ 35 mil no mês em exchanges nacionais — a soma de TODAS as criptos conta. Em exchanges estrangeiras/custódia própria, a IN 1888 tributa mesmo abaixo. Regras mudam: confirme na Receita/contador.',
    },
    sources: ['conteúdo autoral do app', 'IN RFB 1888/2023 (educacional)'],
  },
  {
    id: 'cripto-ciclo-halving',
    emoji: '🔁',
    title: 'O ciclo do halving',
    summary: 'O relógio de ~4 anos do BTC e onde estamos agora — com dados ao vivo.',
    sections: [
      {
        title: 'O que é o halving',
        text: 'A cada ~210 mil blocos (≈4 anos), a recompensa dos mineradores CAI PELA METADE: entra menos BTC novo no mercado. 2012, 2016, 2020, 2024… próximo estimado: veja o card ao vivo com a contagem real de dias.',
      },
      {
        title: 'O padrão histórico (observado, não garantido)',
        text: 'Nos últimos 3 ciclos: FUNDO ~500 dias ANTES do halving; TOPO entre 380 e 550 dias DEPOIS; queda de 77–85% após o topo. A leitura sensata: o halving é um RELÓGIO de contexto, não um interruptor de preço. Em nov/2026 estamos na zona pré-halving — veja a contagem no card.',
      },
      {
        title: 'Como usar sem cair no conto',
        text: 'Ciclo serve para calibrar EXPECTATIVA e tamanho de posição, não para "comprar porque o halving vem aí". Combinar com o Radar contrário (queda + sinal de virada) é o jeito educado de usar o relógio: comprar o pânico cedo demais é o erro clássico do ciclista iniciante.',
      },
    ],
    symbol: 'BTC',
    exercise: {
      type: 'halving-days',
      question: 'Quantos dias faltam (aprox.) para o próximo halving do BTC? (tolerância ±25 dias)',
      hint: 'O card "Ciclo do halving" na aula mostra a contagem exata de dias.',
    },
    sources: ['conteúdo autoral do app', 'módulo market/halving'],
  },
  {
    id: 'cripto-altcoins-risco',
    emoji: '🎲',
    title: 'Altcoins: risco, liquidez e stablecoins',
    summary: 'Por que a maioria morre e como sobreviver ao mercado de milhares de moedas.',
    sections: [
      {
        title: 'A matemática brutal',
        text: 'Existem milhares de altcoins; a maioria desvaloriza até quase zero dentro de poucos ciclos. O índice de altcoins vs BTC mostra que segurar altcoin no long term COSTUMA perder para simplesmente segurar BTC. Altcoin é trade de ciclo, não "investimento para aposentadoria".',
      },
      {
        title: 'Liquidez é sobrevivência',
        text: 'Altcoin pequena tem livro raso: vender R$ 5 mil pode derrubar o preço 10% (slippage). Antes de comprar, verifique volume diário real e onde está listada. O Tracking do app aceita qualquer par do CoinGecko — teste a liquidez antes de tamanho grande.',
      },
      {
        title: 'Stablecoins (USDT/USDC)',
        text: 'São criptos ancoradas no dólar — servem para SAIR da volatilidade sem voltar para o real. Risco: a emissora de fato ter as reservas (USDC passou por isso em 2023 e desancorou por dias). Não é renda, é abrigo temporário — e tem risco de emissora.',
      },
    ],
    symbol: 'ETH',
    exercise: {
      type: 'trend',
      question: 'ETH é a altcoin mais líquida e ainda assim segue o ciclo. Qual é a tendência atual dela?',
      hint: 'Preço vs MM20 vs MM50 no card de indicadores.',
    },
    sources: ['conteúdo autoral do app'],
  },
  // ── Trilha: Renda fixa ────────────────────────────────────────────────────
  {
    id: 'rf-juros',
    emoji: '🏦',
    title: 'Juros: Selic, CDI e juro real',
    track: 'renda-fixa',
    summary: 'O juro básico governa todos os preços — e o juro real é o que realmente importa.',
    sections: [
      {
        title: 'A cadeia das taxas',
        text: 'SELIC é a taxa básica definida pelo Copom: o preço do dinheiro entre bancos e o gatilho de TODAS as outras taxas. CDI acompanha a Selic de perto e é a régua dos CDBs e fundos. Tudo no mercado é comparado a essas taxas: bolsa cai quando Selic sobe porque renda fixa passa a competir mais forte pelo capital.',
      },
      {
        title: 'Nominal vs juro real',
        text: 'Se o CDI paga 13,6% e a inflação (IPCA) é 4%, o juro REAL é ~9% — é esse que faz seu dinheiro crescer de verdade. Juro nominal alto com inflação alta é ilusão. A fórmula exata: (1+nominal)/(1+inflação)−1; a aproximação nominal−inflação funciona para decisões rápidas.',
      },
      {
        title: 'Por que isso muda decisões',
        text: 'Juro real alto: renda fixa fica imbatível para reserva e curtíssimo prazo; ações e FIIs sofrem. Juro real baixo: o risco passa a ser recompensado. O card de mercado mostra Selic e IPCA — use para contextualizar. E o ceticismo do app vale aqui: juro alto demais costuma indicar risco fiscal, não força.',
      },
    ],
    symbol: 'PETR4',
    exercise: {
      type: 'quiz',
      question: 'CDI nominal de 13% ao ano com IPCA de 4% ao ano. Qual é o juro real aproximado?',
      hint: 'Aproximação: nominal − inflação.',
      choices: ['9% ao ano', '17% ao ano', '4% ao ano'],
      answer: '9% ao ano',
      explanation: 'Juro real ≈ nominal − inflação = 13% − 4% = 9%. A conta exata dá ~8,65%, mas a aproximação serve para decisões rápidas. É o juro REAL que cresce patrimônio.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'rf-tesouro',
    emoji: '🇧🇷',
    title: 'Tesouro Direto: os três tipos',
    track: 'renda-fixa',
    summary: 'Selic (flutuante), Prefixado (aposta) e IPCA+ (proteção contra inflação).',
    sections: [
      {
        title: 'Tesouro Selic',
        text: 'Acompanha o CDI diário, liquidez D+1, risco mínimo. É o padrão para RESERVA DE EMERGÊNCIA: quando precisar do dinheiro, ele estará lá (pequena marcação a mercado, mas estável).',
      },
      {
        title: 'Tesouro Prefixado',
        text: 'Você trava a taxa HOJE para o vencimento. Vantagem: se os juros caírem, você ganha mais que o mercado. Risco: se a Selic SUBIR, o preço do título CAI (marcação a mercado) — vender no meio dá prejuízo. É aposta de direção dos juros: use só para prazos que você consegue levar até o fim.',
      },
      {
        title: 'Tesouro IPCA+',
        text: 'Paga IPCA + taxa fixa (ex.: IPCA + 6%): protege o PODER DE COMPRA no longo prazo — o único que garante crescimento real contratado. Ideal para metas de longo prazo. O risco é o mesmo do prefixado: preço oscila no meio do caminho.',
      },
    ],
    symbol: 'TESOURO_SELIC',
    exercise: {
      type: 'quiz',
      question: 'Você quer garantir o PODER DE COMPRA do dinheiro em 15 anos, sem apostar em juro nominal. Qual título?',
      hint: 'Qual dos três indexa a inflação e ainda paga uma taxa fixa acima dela?',
      choices: ['Tesouro Selic', 'Tesouro Prefixado', 'Tesouro IPCA+'],
      answer: 'Tesouro IPCA+',
      explanation: 'Tesouro IPCA+ paga a inflação medida (IPCA) MAIS uma taxa fixa contratada — protege o poder de compra. Selic protege contra líquidez; prefixado é aposta de direção.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'rf-cdb-lci',
    emoji: '🏛️',
    title: 'CDB, LCI/LCA e o FGC',
    track: 'renda-fixa',
    summary: 'O banco paga mais que o Tesouro porque toma risco — e o FGC cobre até R$ 250 mil.',
    sections: [
      {
        title: 'CDB',
        text: 'Empréstimo para o banco, que paga % do CDI. Pode ser pós-fixado (CDB 100% CDI), prefixado ou IPCA+. Geralmente paga mais que o Tesouro porque tem risco do banco — mitigado pelo FGC (até R$ 250 mil por CPF por instituição).',
      },
      {
        title: 'LCI/LCA',
        text: 'Letras de crédito imobiliário/agro: ISENTAS de IR para pessoa física. A taxa anunciada (ex.: 93% do CDI) é LÍQUIDA. Compare sempre LÍQUIDO: CDB 100% CDI com 15% de IR ≈ 85% CDI líquido; LCI 93% CDI isenta vence.',
      },
      {
        title: 'FGC e os limites',
        text: 'O Fundo Garantidor cobre até R$ 250 mil por CPF por instituição (CDB, LCI/LCA contam no mesmo teto por banco). Tática: valores acima disso se distribuem entre instituições diferentes. O FGC cobre o principal, não os juros acima do limite — leia as regras.',
      },
    ],
    symbol: 'TESOURO_SELIC',
    exercise: {
      type: 'quiz',
      question: 'LCI paga 93% do CDI isenta; CDB paga 100% do CDI com IR de 15%. Qual rende mais LÍQUIDO em 1 ano?',
      hint: 'Compare líquido: 93% × 1 (isenta) contra 100% × (1 − 0,15).',
      choices: ['LCI 93% CDI', 'CDB 100% CDI líquido ≈ 85% CDI', 'Empatam'],
      answer: 'LCI 93% CDI',
      explanation: 'CDB 100% líquido = 85% do CDI. LCI isenta = 93% do CDI. A LCI vence SEM depender de FGC. Sempre compare líquido, nunca nominal.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'rf-debentures',
    emoji: '📜',
    title: 'Debêntures e crédito privado',
    track: 'renda-fixa',
    summary: 'Você vira credor de EMPRESAS — mais rendimento, mais risco, e isenção nas incentivadas.',
    sections: [
      {
        title: 'O que são',
        text: 'Dívida de empresa: você empresta à companhia em troca de juros (IPCA+, CDI+ ou prefixado). SEM FGC: o risco é da empresa quebrar. Leia o RATING (AAA→CCC) e o setor — crédito privado exige mais análise que banco.',
      },
      {
        title: 'Debêntures incentivadas',
        text: 'Emitidas para infraestrutura (saneamento, energia, logística) com lei de incentivo: ISENTAS de IR para pessoa física. Rendimento líquido excelente em IPCA+ — por isso dominam carteiras de longo prazo. Não são isentas de risco: empresa falida não paga.',
      },
      {
        title: 'Liquidez e preço',
        text: 'Mercado secundário raso: vender no meio pode dar desconto. Trate como comprar-e-capturar (levar até vencimento) e diversifique emissor/segmento. Cuidado com "IPCA+ 12%" de empresa frágil: o extra é pagamento de RISCO, não presente.',
      },
    ],
    symbol: 'TESOURO_SELIC',
    exercise: {
      type: 'quiz',
      question: 'Debênture incentivada de saneamento paga IPCA + 7% isenta. O que a difere do Tesouro IPCA+ 6%?',
      hint: 'Duas diferenças: isenção fiscal e QUEM deve o dinheiro.',
      choices: [
        'nada, é igual ao Tesouro',
        'isenta de IR e crédito de empresa (sem FGC, mais risco)',
        'tem garantia do FGC',
      ],
      answer: 'isenta de IR e crédito de empresa (sem FGC, mais risco)',
      explanation: 'A isenção fiscal é o atrativo; o custo é assumir risco de CRÉDITO da empresa (sem FGC). O IPCA+ extra é o prêmio por esse risco. Diversifique emissores.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'rf-escada',
    emoji: '🪜',
    title: 'Escada de vencimentos e liquidez',
    track: 'renda-fixa',
    summary: 'Distribuir vencimentos dá previsibilidade e evita vender no prejuízo.',
    sections: [
      {
        title: 'O que é a escada',
        text: 'Em vez de vencimento único, você distribui: vencimento em 2027, 2028, 2029... Cada ano "sobe um degrau" um título vencendo. Aumenta a previsibilidade do fluxo e reduz o risco de marcação a mercado concentrada.',
      },
      {
        title: 'Liquidez ANTES de retorno',
        text: 'Reserva de emergência = liquidez D+1 (Tesouro Selic). Depois vem a escada de médio/longo prazo. Erro clássico: colocar reserva em prefixado 5 anos e precisar vender no meio → prejuízo de marcação. Ordem: liquidez primeiro, retorno depois.',
      },
      {
        title: 'Regra da divisão',
        text: 'Prática: 6–12 meses de despesa em Selic; o resto em escada de IPCA+ e debêntures com vencimentos escalonados. Cada aporte reforça um degrau. O módulo Análise calcula o runway — use-o para calibrar os primeiros degraus.',
      },
    ],
    symbol: 'TESOURO_SELIC',
    exercise: {
      type: 'quiz',
      question: 'Onde fica a RESERVA DE EMERGÊNCIA?',
      hint: 'Liquidez D+1 e risco mínimo vencem retorno alto aqui.',
      choices: ['Tesouro Prefixado 5 anos', 'Tesouro Selic', 'Ação de banco sólido'],
      answer: 'Tesouro Selic',
      explanation: 'Reserva precisa de LIQUIDEZ D+1 e estabilidade — Tesouro Selic. Prefixado oscila com marcação; ação oscila muito mais. Retorno é a última prioridade da reserva.',
    },
    sources: ['conteúdo autoral do app'],
  },
  // ── Trilha: Ações & fundamentalista ───────────────────────────────────────
  {
    id: 'acoes-fundamentais',
    emoji: '📊',
    title: 'O que é uma ação e por que ela sobe',
    track: 'acoes',
    summary: 'Você é sócio de um negócio — e o preço segue o lucro (no longo prazo).',
    sections: [
      {
        title: 'Sócio, não apostador',
        text: 'Uma ação é uma FATIA da empresa: sua receita, seu lucro, suas dívidas. No curto prazo o preço é um leilão de humor; no longo prazo segue o LUCRO. Se os lucros dobram em 10 anos, o preço tende a acompanhar.',
      },
      {
        title: 'Os dois motores do preço',
        text: 'Preço ≈ lucro por ação × múltiplo que o mercado paga. O preço sobe quando (a) o lucro cresce, (b) o múltiplo expande (otimismo, juros caindo), ou ambos. Só o (a) é sólido; o (b) é humor — e humor desanda.',
      },
      {
        title: 'A pergunta certa',
        text: 'Não pergunte "vai subir?". Pergunte: "a empresa vai ganhar mais dinheiro nos próximos 5 anos? E o preço de hoje já embute quanto crescimento?". O app mostra P/L e DY — comece a olhar essas âncoras.',
      },
    ],
    symbol: 'VALE3',
    exercise: {
      type: 'quiz',
      question: 'No LONGO prazo, o que puxa o preço de uma ação?',
      hint: 'Humor do mercado é curto prazo; o que sustenta é outro motor.',
      choices: [
        'o humor e as manchetes do dia',
        'o crescimento sustentado do lucro da empresa',
        'o número de pessoas falando do papel',
      ],
      answer: 'o crescimento sustentado do lucro da empresa',
      explanation: 'Curto prazo = leilão de humor. Longo prazo = lucro. Preço ≈ LPA × múltiplo: sem crescimento de lucro, a expansão de múltiplo é inflação de expectativa — e ela estoura.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'acoes-multiplos',
    emoji: '📐',
    title: 'Múltiplos: P/L, P/VP e DY',
    track: 'acoes',
    summary: 'Quanto o mercado paga por cada real de lucro — e por que "baixo" não é "barato".',
    sections: [
      {
        title: 'P/L (preço/lucro)',
        text: 'P/L 15 = o mercado paga 15 anos de lucro atual pela empresa. Comparável entre empresas SIMILARES e com o histórico do próprio papel. P/L 8 pode ser pechincha — ou armadilha de valor de empresa em queda. P/L negativo = prejuízo.',
      },
      {
        title: 'P/VP e DY',
        text: 'P/VP: preço sobre o PATRIMÔNIO (útil em bancos e seguradoras — negócios de balanço). DY: dividendo anual ÷ preço — DY alto demais pode ser armadilha (preço caindo) ou empresa madura. Nunca um número sozinho: SEMPRE contexto do setor e da trajetória.',
      },
      {
        title: 'A armadilha de valor',
        text: 'P/L 4 numa empresa quebrando é compra ruim disfarçada. P/L 30 numa empresa crescendo 30% ao ano com margem subindo pode ser razoável. Múltiplo só faz sentido comparado com: o setor, o histórico do papel e a QUALIDADE do lucro (recorrente vs pontual).',
      },
    ],
    symbol: 'ITUB4',
    exercise: {
      type: 'quiz',
      question: 'Ação A tem P/L 5; ação B tem P/L 25. O que você conclui?',
      hint: 'Múltiplo baixo sem contexto é armadilha clássica.',
      choices: [
        'A é sempre melhor que B',
        'B é sempre melhor que A',
        'depende: setor, trajetória de lucro e qualidade — o número sozinho não decide',
      ],
      answer: 'depende: setor, trajetória de lucro e qualidade — o número sozinho não decide',
      explanation: 'P/L 5 pode ser empresa em decadência (armadilha de valor); P/L 25 pode ser crescimento alto de qualidade. Múltiplo é ferramenta de comparação com contexto, não etiqueta de barato/car.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'acoes-roe',
    emoji: '💎',
    title: 'ROE, margens e qualidade',
    track: 'acoes',
    summary: 'Quanto a empresa gera com o capital dos sócios — o motor do longo prazo.',
    sections: [
      {
        title: 'ROE',
        text: 'ROE = lucro líquido ÷ patrimônio líquido. ROE 20% sustentado significa que a empresa transforma cada R$ 100 dos sócios em R$ 20 de lucro por ano — motor de crescimento sem emitir ações. Bancos e empresas com "fossa" competitiva sustentam ROE alto.',
      },
      {
        title: 'Margens',
        text: 'M. bruta → EBITDA → líquida: mostra a estrada do dinheiro. Margem líquida ESTÁVEL ou crescente indica poder de precificação. Margem caindo com receita subindo = guerra de preço ou custo fora de controle — investigue antes de comprá-la barata.',
      },
      {
        title: 'A armadilha do endividamento',
        text: 'ROE alto com DÍVIDA LÍQUIDA/PL alto é trapaça aparente: a alavancagem infla o retorno E o risco. Cruzar sempre com Dív. líquida/EBITDA. O app mostra esses indicadores — treine ler o conjunto.',
      },
    ],
    symbol: 'ITUB4',
    exercise: {
      type: 'quiz',
      question: 'ROE de 25% com Dív. líquida/PL de 3,0× vs ROE de 15% com dívida quase nula. Leitura sã?',
      hint: 'Alavancagem infla o ROE — e o risco junto.',
      choices: [
        'o 25% é melhor, ponto',
        'o 15% é melhor, ponto',
        'o 25% vem com risco de alavancagem — cruzar com Dív./EBITDA e qualidade',
      ],
      answer: 'o 25% vem com risco de alavancagem — cruzar com Dív./EBITDA e qualidade',
      explanation: 'Alavancagem infla ROE (lucro sobre PL pequeno por causa da dívida). ROE alto SÓ com dívida controlada e margens estáveis é qualidade real. Sempre o conjunto.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'acoes-dividendos',
    emoji: '💰',
    title: 'Dividendos e payout',
    track: 'acoes',
    summary: 'Renda que vem do lucro real — e a diferença entre DY sustentável e armadilha.',
    sections: [
      {
        title: 'De onde vem o dividendo',
        text: 'Dividendo é parte do LUCRO distribuído aos sócios (mínimo 25% do lucro ajustado por lei no Brasil). JCP é a outra forma (tributado na fonte). DY = proventos 12 meses ÷ preço. O que sustenta o DY é o LUCRO — sem lucro, dividendo é temporário.',
      },
      {
        title: 'DY alto ≠ melhor',
        text: 'DY 15% geralmente significa: preço caiu muito (empresa em crise) OU provento pontual (venda de ativo). DY armadilha é o erro nº 1 de quem busca renda. Olhe HISTÓRICO: DY sustentado por 5+ anos com lucro cobrindo o payout é qualidade.',
      },
      {
        title: 'Renda real no app',
        text: 'O app calcula o DY RECEBIDO por você (proventos 12m ÷ valor atual) — diferente do DY "anunciado". Compare o recebido com CDI: se a carteira de dividendos não compete com renda fixa SEM risco de preço, questione a tese.',
      },
    ],
    symbol: 'PETR4',
    exercise: {
      type: 'quiz',
      question: 'Ação com DY de 14% hoje. O que fazer ANTES de comemorar?',
      hint: 'DY = proventos ÷ preço. O que fez o DY ficar tão alto?',
      choices: [
        'comprar mais porque é renda garantida',
        'verificar se o preço caiu (crise) ou o provento foi pontual',
        'nada, DY alto sempre é bom',
      ],
      answer: 'verificar se o preço caiu (crise) ou o provento foi pontual',
      explanation: 'DY altíssimo geralmente = preço em queda (armadilha) ou provento não recorrente. DY sustentável = lucro recorrente cobrindo o payout por anos. Verifique a origem antes.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'acoes-balanco',
    emoji: '📋',
    title: 'Lendo um balanço: o essencial',
    track: 'acoes',
    summary: 'Receita, lucro, dívida e caixa — quatro números que contam a história.',
    sections: [
      {
        title: 'A DRE em três linhas',
        text: 'RECEITA LÍQUIDA (o que faturou de verdade) → LUCRO OPERACIONAL (EBIT/EBITDA: o negócio em si) → LUCRO LÍQUIDO (o que sobra para os sócios). Compare com o mesmo período do ano passado: crescer receita com margem caindo é menos bom do que parece.',
      },
      {
        title: 'Balanço: dívida e caixa',
        text: 'DÍVIDA LÍQUIDA = dívida bruta − caixa. Dív. líquida/EBITDA ~2-3× é comum em indústria; acima disso o risco de refinanciamento cresce. CAIXA alto pode ser alavanca consciente — leia as notas para saber o custo.',
      },
      {
        title: 'O que mata empresas',
        text: 'Não é margem caindo: é DÍVIDA curta demais + receita caindo. A trinca mortal: endividamento alto, vencimento curto, receita encolhendo. O app mostra esses indicadores no contexto — treine ler os quatro números antes de olhar o gráfico.',
      },
    ],
    symbol: 'VALE3',
    exercise: {
      type: 'quiz',
      question: 'Empresa com receita +20%, margem líquida caindo de 15% para 8% e Dív. líquida/EBITDA subindo de 2× para 3,5×. Leitura?',
      hint: 'Crescimento com margem caindo e alavancagem subindo.',
      choices: [
        'crescendo 20%: compre mais',
        'crescimento veio com margem caindo e dívida subindo — investigar antes',
        'irrelevante, só olhar o gráfico',
      ],
      answer: 'crescimento veio com margem caindo e dívida subindo — investigar antes',
      explanation: 'Crescer COMPRANDO margem e alavancagem é crescer com mais risco. Pode ser estratégia (escala) ou deterioração — os três números juntos contam. "Cresceu 20%" sozinho engana.',
    },
    sources: ['conteúdo autoral do app'],
  },
  // ── Trilha: FIIs & fundos ─────────────────────────────────────────────────
  {
    id: 'fundos-fiis',
    emoji: '🏢',
    title: 'FIIs: tijolo vs papel',
    track: 'fundos',
    summary: 'Imóveis fracionados com renda mensal — e o DY como armadilha clássica.',
    sections: [
      {
        title: 'Tijolo vs papel',
        text: 'FIIs de TIJOLO possuem imóveis físicos (galpões, shoppings, lajes): renda de aluguel + possível valorização das cotas. FIIs de PAPEL investem em títulos de crédito imobiliário (CRI, LCI): renda maior, mas depende da inadimplência dos devedores — mais sensível a juros.',
      },
      {
        title: 'Vacância e inadimplência',
        text: 'Nos de tijolo: VACÂNCIA (quanto do imóvel está vazio) e INADIMPLÊNCIA dos inquilinos são as duas métricas de saúde. Galpão com vacância 2% e inquilino âncora forte é outro mundo de um shopping com vacância 20%. O DY alto com vacância subindo é armadilha.',
      },
      {
        title: 'Juros e DY',
        text: 'FIIs competem com renda fixa: juros altos pressionam as cotas para baixo (o DY tem que compensar). Juros caindo = vento a favor. A mesma lógica do ganho/risco: DY alto com vacância subindo = pagar por risco sem perceber.',
      },
    ],
    symbol: 'HGLG11',
    exercise: {
      type: 'quiz',
      question: 'FII de galpões com DY de 13% e vacância subindo de 5% para 18%. Leitura?',
      hint: 'DY alto com saúde caindo = armadilha clássica de FII.',
      choices: [
        'comprar mais pelo DY alto',
        'o DY subiu porque a saúde piorou — investigar vacância, inquilinos e contrato',
        'irrelevante, DY é DY',
      ],
      answer: 'o DY subiu porque a saúde piorou — investigar vacância, inquilinos e contrato',
      explanation: 'DY = renda ÷ COTA. Se a renda caiu menos que a cota, o DY dispara — sinal de crise, não de pechincha. Vacância e inadimplência primeiro; DY depois.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'fundos-etf',
    emoji: '🧺',
    title: 'ETFs: a cesta que acompanha o índice',
    track: 'fundos',
    summary: 'Diversificação instantânea com uma compra — e por que vencer o índice é difícil.',
    sections: [
      {
        title: 'O que é',
        text: 'ETF é um FUNDO listado na bolsa que replica um índice (BOVA11 = Ibovespa, IVVB11 = S&P 500, EWZ = Brasil em NY). Você compra UMA ação e tem a diversificação de dezenas/centenas de empresas. Taxa baixa, transparente, liquidez de bolsa.',
      },
      {
        title: 'Passivo vence ativo (na média)',
        text: 'A maioria dos fundos ATIVOS perde do índice no longo prazo (estudos consistentes). Motivos: taxa + timing errado. ETF é o veículo padrão para expor o mercado inteiro sem tentar vencer. IVVB11 dá acesso a 500 empresas dos EUA em BRL — atenção: inclui risco CÂMBIO.',
      },
      {
        title: 'Onde o ETF entra',
        text: 'Núcleo da carteira (o "motor de mercado") + satélites ativos do que você entende é a estrutura clássica. Ex.: 70% ETF (núcleo) + 30% escolhas suas (satélite). O app mostra a alocação real por tipo — compare com essa arquitetura.',
      },
    ],
    symbol: 'IVVB11',
    exercise: {
      type: 'quiz',
      question: 'IVVB11 replica o S&P 500 em BRL. Qual risco ADICIONAL ele traz além do mercado americano?',
      hint: 'O ETF é em reais, mas as 500 empresas têm receita em dólar.',
      choices: [
        'nenhum risco adicional',
        'risco cambial: o preço em BRL varia com USD/BRL também',
        'risco de a bolsa brasileira cair',
      ],
      answer: 'risco cambial: o preço em BRL varia com USD/BRL também',
      explanation: 'ETF em BRL de ativos em USD carrega câmbio: dólar sobe, IVVB11 sobe mesmo com o índice flat (e vice-versa). É feature e bug ao mesmo tempo — saber que ela existe é o que importa.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'fundos-taxa',
    emoji: '📉',
    title: 'Taxa de administração: o inimigo silencioso',
    track: 'fundos',
    summary: '1% a mais por ano come décadas de retorno composto.',
    sections: [
      {
        title: 'A matemática cruel',
        text: 'R$ 100 mil a 10% a.a. por 20 anos = R$ 673 mil. Com 2% a.a. a mais de taxa (retorno líquido 8%) = R$ 466 mil. Os 2% custaram R$ 207 MIL — não é "só 2%": é juro composto trabalhando para o gestor.',
      },
      {
        title: 'O que justificar taxa',
        text: 'Fundos ativos podem justificar taxa com retorno CONSISTENTE acima do índice (difícil: a maioria não consegue) ou acesso exclusivo (crédito privado por dentro, ativos ilíquidos). ETFs a 0,1-0,5% são o baseline. Previdência com taxa de carregamento é red flag.',
      },
      {
        title: 'Onde olhar',
        text: 'Lâmina do fundo: taxa de administração + performance fee (20% sobre o que passar do CDI é padrão em multimercados — entenda o benchmark!). Taxa escondida no plano de previdência também conta.',
      },
    ],
    symbol: 'BOVA11',
    exercise: {
      type: 'quiz',
      question: 'Dois fundos iguais: A cobra 0,3% a.a., B cobra 2,3% a.a. Em 20 anos a diferença é...',
      hint: 'Juro composto por 20 anos sobre 2% de diferença.',
      choices: [
        'pequena, ~2% do total',
        'grande: dezenas de % do patrimônio final',
        'irrelevante se o B rende mais',
      ],
      answer: 'grande: dezenas de % do patrimônio final',
      explanation: '2% a.a. de diferença em 20 anos = ~30% do patrimônio final a menos. Taxa composta como retorno: no curto é pouca coisa, no longo é a diferença entre independência e não.',
    },
    sources: ['conteúdo autoral do app'],
  },
  // ── Trilha: Risco & portfólio ─────────────────────────────────────────────
  {
    id: 'risco-position',
    emoji: '🎯',
    title: 'Position sizing: o tamanho salva',
    track: 'risco',
    summary: 'Errar pequeno é sobreviver; acertar grande é bônus — nessa ordem.',
    sections: [
      {
        title: 'A regra 1–2%',
        text: 'Nenhuma operação deve arriscar mais que 1–2% do patrimônio TOTAL (distância até o stop × quantidade). Com R$ 100 mil e risco de 5% por trade, 4 erros seguidos tiram 20%. Com 1%, são 4% — você continua no jogo.',
      },
      {
        title: 'Teto por tema e classe',
        text: 'Além do risco por operação, TETO por tema/ativo (ex.: máx 10% em cripto, 20% em uma ação, 25% num setor). O app mostra a alocação real por tipo — use-o para medir concentração. Concentração no que você ENTENDE MUITO é aceitável para quem já sabe; para quem aprende, é roleta.',
      },
      {
        title: 'Sizing vence timing',
        text: 'Você não precisa acertar o momento perfeito: precisa errar barato. Paper trading do app existe exatamente para treinar o sizing sem custo. Anote no Diário — o erro anotado é aula; o erro não anotado é recorrente.',
      },
    ],
    symbol: 'PETR4',
    exercise: {
      type: 'quiz',
      question: 'Patrimônio de R$ 100 mil. Você compra R$ 40 mil de uma ação com stop a −20%. Qual o risco real da operação?',
      hint: 'Risco = valor da posição × distância até o stop ÷ patrimônio total.',
      choices: ['20% do patrimônio', '8% do patrimônio', '1% do patrimônio'],
      answer: '8% do patrimônio',
      explanation: '40 mil × 20% = R$ 8 mil = 8% do patrimônio TOTAL. Acima da regra 1–2%: ou reduz o tamanho, ou o stop. O tamanho da posição é a única variável que você controla 100%.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'risco-correlacao',
    emoji: '🔗',
    title: 'Correlação: 10 ações de banco não são diversificação',
    track: 'risco',
    summary: 'Ativos diferentes que caem juntos são UMA aposta com nomes diferentes.',
    sections: [
      {
        title: 'O que é correlação',
        text: 'Correlação mede se dois ativos andam JUNTOS (+1), opostos (−1) ou independentes (0). ITUB4, BBDC4 e BBAS3 caem juntos em crise de crédito: três posições, UMA aposta (banco brasileiro). Diversificar = reduzir a correlação de CAUSAS, não de nomes.',
      },
      {
        title: 'Os eixos de diversificação',
        text: 'Diversifique por: classe (ações/FIIs/renda fixa/cripto/internacional), setor (banco × agro × tecnologia), moeda (real × dólar) e prazos (liquidez D+1 × longo prazo). As classes do app (STOCK, FII, FIXED_INCOME, ETF, CRYPTO, CASH) já mapeiam os eixos principais.',
      },
      {
        title: 'O teste simples',
        text: 'Pergunta: "se a Selic subir 2 pontos, quais posições CAEM juntas?". Se a lista é longa, sua carteira tem correlação escondida. O radar contrário + a alocação por tipo do app ajudam a enxergar o conjunto real.',
      },
    ],
    symbol: 'ITUB4',
    exercise: {
      type: 'quiz',
      question: 'Carteira com 8 ações: 5 do setor bancário, 1 mineradora, 1 varejo, 1 ETF. Diversificada?',
      hint: '5 das 8 na mesma tese (banco brasileiro) = correlação alta.',
      choices: [
        'sim, 8 ações diferentes',
        'não: 5/8 dependem do mesmo setor — a carteira é dominada por uma tese',
        'só falta adicionar mais um banco',
      ],
      answer: 'não: 5/8 dependem do mesmo setor — a carteira é dominada por uma tese',
      explanation: 'Diversificação é sobre CAUSAS, não nomes: crise de crédito derruba os 5 bancos juntos. O ETF e a mineradora diversificam; os 5 bancos são uma aposta multiplicada.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'risco-drawdown',
    emoji: '🏔️',
    title: 'Drawdown: a queda que dói',
    track: 'risco',
    summary: 'Queda de 50% exige +100% para voltar — o tamanho do prejuízo não é simétrico.',
    sections: [
      {
        title: 'O que é',
        text: 'Drawdown é a queda desde o TOPE até o fundo. A matemática é brutal: −50% exige +100% para voltar ao ponto inicial; −80% exige +400%. Por isso preservar capital em queda é mais valioso que acertar na alta — assimetria do prejuízo.',
      },
      {
        title: 'Conheça sua tolerância REAL',
        text: 'Todo mundo diz que aguenta −30% até acontecer. O teste real é quanto dinheiro você NÃO vende no pânico. Paper trading e tamanhos pequenos calibram isso sem custo real. Saiba o seu número antes do próximo bear.',
      },
      {
        title: 'Volatilidade como previsão de dor',
        text: 'Volatilidade anual do papel (o Tracking mostra) é a previsão de "normalidade": vol 50% significa oscilações grandes o tempo todo. Papel vol 20% e papel vol 60% exigem tamanhos de posição diferentes para a mesma dor.',
      },
    ],
    symbol: 'BTC',
    exercise: {
      type: 'quiz',
      question: 'Seu ativo caiu 60%. Qual a valorização necessária para voltar ao preço inicial?',
      hint: 'Preço final = preço inicial × (1 − 0,60). Quanto falta multiplicar?',
      choices: ['60%', '100%', '150%'],
      answer: '150%',
      explanation: 'Caiu para 40% do valor inicial: precisa multiplicar por 2,5 = +150%. Assimetria do prejuízo: quanto mais fundo o drawdown, mais desproporcional a volta. Preservar > acertar.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'risco-perfil',
    emoji: '🧬',
    title: 'Perfil de risco e a ordem das coisas',
    track: 'risco',
    summary: 'Reserva antes de oportunidade; horizonte antes de produto.',
    sections: [
      {
        title: 'A ordem clássica',
        text: '1) RESERVA de emergência (6–12 meses, liquidez D+1). 2) Dívidas caras quitadas (cartão/juros > qualquer retorno). 3) Proteção real (IPCA+, previdência para longo prazo). 4) RISCO (ações, FIIs, cripto, internacional). Pular etapas pula o alicerce — em crise, o alicerce é o que impede de vender tudo no pânico.',
      },
      {
        title: 'Horizonte define produto',
        text: 'Dinheiro que você precisa em 6 meses NÃO vai para ações (volatilidade alta demais para o prazo). Dinheiro de 10+ anos NÃO deveria ficar 100% em CDI (juro real menor que o potencial de ações). Horizonte curto = segurança; horizonte longo = risco remunerado.',
      },
      {
        title: 'Perfil não é formulário',
        text: 'Perfil de risco é o que você FAZ na crise, não o que responde no questionário. O diário do app + o histórico de operações revelam o perfil REAL: se você vendeu tudo no pânico de 2022, seu perfil real é conservador — e a carteira deveria refletir isso até o próximo treino.',
      },
    ],
    symbol: 'TESOURO_SELIC',
    exercise: {
      type: 'quiz',
      question: 'Dinheiro que você pode precisar em 6 meses. Onde NÃO colocar?',
      hint: 'Horizonte curto + volatilidade alta = desastre.',
      choices: ['Tesouro Selic', 'CDB liquidez diária', 'ações de banco sólido'],
      answer: 'ações de banco sólido',
      explanation: 'Mesmo papel sólido oscila: em 6 meses pode estar −20% no dia que você precisa vender. Horizonte curto pede liquidez e estabilidade (Selic/CDI diário). "Sólido" não protege de volatilidade.',
    },
    sources: ['conteúdo autoral do app'],
  },
  // ── Trilha: Psicologia ───────────────────────────────────────────────────
  {
    id: 'psico-vieses',
    emoji: '🧠',
    title: 'Viéses que quebram investidores',
    track: 'psicologia',
    summary: 'Seu cérebro evoluiu para fugir de predadores, não para investir bem.',
    sections: [
      {
        title: 'Os três campeões',
        text: 'AVERSÃO À PERDA: dói 2× mais perder do que ganhar o mesmo — por isso seguramos prejuízo "até voltar" e vendemos lucro cedo. VIÉS DE CONFIRMAÇÃO: procuramos notícias que confirmam a tese e ignoramos as que contradizem (o ceticismo do app existe por isso). ANCORAGEM: "comprei a 40, saio no empate" — o mercado não sabe seu preço de entrada.',
      },
      {
        title: 'FOMO e manada',
        text: 'FOMO (medo de ficar de fora) é o que compra no topo: cripto em nov, papel em hype. A manada na subida paga o desconto da queda — entrar tarde é pagar o preço dos que saem cedo. O Radar marca HYPE exatamente para esse viés: atenção alta + hype alto = o momento em que o cérebro grita "entra!" e a leitura diz "cuidado".',
      },
      {
        title: 'O antídoto é processo',
        text: 'Viés não se cura, se GERENCIA: regras escritas antes (plano), registro depois (diário), tamanhos pequenos (sobrevivência emocional). O app é seu antídoto estrutural: nota no Diário, conta de ganho/risco antes de comprar, alerta de hype antes do FOMO.',
      },
    ],
    symbol: 'BTC',
    exercise: {
      type: 'quiz',
      question: 'Você comprou a R$ 40 e está a R$ 30. O papel piorou na sua análise. O que o viés te empurra a fazer?',
      hint: '"Até voltar ao empate" é o viés, não a decisão.',
      choices: [
        'segurar até voltar aos 40, sem reanalisar',
        'reavaliar a tese com os dados de hoje: se piorou, sair; se melhorou, segurar',
        'dobrar a posição para empatar mais rápido',
      ],
      answer: 'reavaliar a tese com os dados de hoje: se piorou, sair; se melhorou, segurar',
      explanation: 'O mercado não sabe seu preço de entrada (ancoragem). "Voltar ao empate" ignora a tese atual. Dobrar no prejuízo sem tese = média para baixo = viés + alavancagem emocional.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'psico-plano',
    emoji: '📝',
    title: 'Plano, diário e disciplina',
    track: 'psicologia',
    summary: 'O investidor profissional não é quem mais acerta — é quem tem processo.',
    sections: [
      {
        title: 'O plano escrito ANTES',
        text: 'Antes de comprar, escreva: POR QUÊ (tese em 2 linhas), ALVO (onde realizaria), INVALIDAÇÃO (onde a tese morre), TAMANHO (% do patrimônio). O card de ganho/risco do app entrega o esqueleto — preencha e anote. Decisão escrita antes = viés fora do caminho no calor.',
      },
      {
        title: 'O diário DEPOIS',
        text: 'Registre o resultado e o que APRENDEU (não só o lucro): "segui o plano? onde errei a leitura? o que faria diferente?". O Diário do app existe para isso — e o Aprendizado mede os sinais: processo que melhora com dados vence talento.',
      },
      {
        title: 'A régua de profissional',
        text: 'Profissional não é quem dobra em uma semana — é quem tem PROCESSO que sobrevive a vários ciclos: plano antes, registro depois, tamanho sempre. O resto (sorte) vem e vai; processo fica.',
      },
    ],
    symbol: 'PETR4',
    exercise: {
      type: 'quiz',
      question: 'O que o diário de investimentos deve registrar?',
      hint: 'O que gera aprendizado medível — não só o resultado financeiro.',
      choices: [
        'só o lucro/prejuízo de cada operação',
        'tese, gatilhos, tamanho, e o que faria diferente — antes e depois',
        'só as operações que deram certo',
      ],
      answer: 'tese, gatilhos, tamanho, e o que faria diferente — antes e depois',
      explanation: 'Diário é ferramenta de PROCESSO: o que você pensava antes vs o que aconteceu revela vieses e padrões. Só o resultado financeiro ensina pouco (sorte se disfarça de habilidade).',
    },
    sources: ['conteúdo autoral do app'],
  },
  // ── Trilha: Internacional ────────────────────────────────────────────────
  {
    id: 'intl-dolar',
    emoji: '💵',
    title: 'Dólar e ativos internacionais',
    track: 'internacional',
    summary: 'Proteção de moeda: BDRs, ETFs em BRL e a conta do câmbio embutida.',
    sections: [
      {
        title: 'Por que dólar',
        text: 'Seu custo de vida é em REAL, mas crise fiscal/externa bate no real — ativos em USD funcionam como seguro. O histórico do Brasil mostra o real perdendo valor no longo prazo (inflação estrutural + câmbio). A parte internacional é proteção, não especulação de câmbio.',
      },
      {
        title: 'Os caminhos',
        text: 'BDR (ROXO34, AAPL34...): ação americana em BRL na B3 — fácil, mas carrega risco do custodiante. ETF internacional em BRL (IVVB11, WRLD11): diversificação ampla. Conta no exterior: mais controle, mais burocracia (declaração de bens). No app todos aparecem: BDRs no tracking, IVVB11 como ETF.',
      },
      {
        title: 'A conta do câmbio embutida',
        text: 'ROXO34 em BRL = NU em USD × câmbio. Se a ação sobe 5% e o dólar sobe 10%, o BDR sobe ~15,5% — o câmbio é metade do movimento. E BDR tem regras próprias de imposto. Nunca compre BDR achando que é "a mesma coisa mais fácil".',
      },
    ],
    symbol: 'IVVB11',
    exercise: {
      type: 'quiz',
      question: 'Ação americana sobe 5% e o dólar sobe 10% no período. Quanto sobe o BDR em BRL (aprox.)?',
      hint: 'BDR = ação × câmbio. Multiplique os fatores.',
      choices: ['~5%', '~15,5%', '~2%'],
      answer: '~15,5%',
      explanation: '(1,05 × 1,10) − 1 ≈ 15,5%. O BDR embute o câmbio: metade do movimento de um BDR pode ser moeda, não empresa. É a proteção que você quer — sabendo de onde ela vem.',
    },
    sources: ['conteúdo autoral do app'],
  },
  {
    id: 'intl-macro-mundo',
    emoji: '🌐',
    title: 'Juros globais e o mundo lá fora',
    track: 'internacional',
    summary: 'Fed, guerra, commodities: o Brasil é um país pequeno em um mundo grande.',
    sections: [
      {
        title: 'Fed manda no mundo',
        text: 'Quando o Fed (banco central dos EUA) sobe juros, o dólar forte suga capital dos emergentes — Brasil sofre mesmo sem problema próprio. Juro americano é o piso global do risco. Acompanhar Fed é acompanhar o TETO da sua carteira de risco.',
      },
      {
        title: 'Commodities e o Brasil',
        text: 'Brasil exporta minério, soja, petróleo, açúcar: preço de COMMODITY global move VALE3, PETR4, o agro e o real juntos. Guerra → petróleo sobe → PETR4 e câmbio sobem juntos. Essa correlação é a razão de diversificar setores E moedas (aula de correlação).',
      },
      {
        title: 'Geopolítica sem pânico',
        text: 'Guerras e eleições movem preço no curto prazo; o longo prazo é lucro + juro + câmbio. O ceticismo do app vale para geopolítica também: manchete apocalíptica ≠ previsão. O papel do alerta é te informar, não te mover.',
      },
    ],
    symbol: 'PETR4',
    exercise: {
      type: 'quiz',
      question: 'O Fed sobe juros fortemente. O que tipicamente acontece com emergentes como o Brasil?',
      hint: 'Dólar forte suga capital de mercados mais arriscados.',
      choices: [
        'nada, o Brasil é independente',
        'entrada de capital e bolsa em alta',
        'saída de capital, pressão no câmbio e queda de ativos de risco',
      ],
      answer: 'saída de capital, pressão no câmbio e queda de ativos de risco',
      explanation: 'Juro global alto = dinheiro migra para o "sem risco" americano. Emergentes sofrem em câmbio e bolsa mesmo sem problema interno — por isso o Fed faz parte do cenário.',
    },
    sources: ['conteúdo autoral do app'],
  },
];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id.toLowerCase());
}

/** Trilhas de formação: rótulo e ordem. */
export const TRACK_LABELS: Record<string, string> = {
  fundamentos: 'Fundamentos do mercado',
  cripto: 'Cripto',
  'renda-fixa': 'Renda fixa',
  acoes: 'Ações & fundamentalista',
  fundos: 'FIIs & fundos',
  risco: 'Risco & portfólio',
  psicologia: 'Psicologia do investidor',
  internacional: 'Internacional',
};

export function trackOf(lesson: Lesson): string {
  if (lesson.track) return lesson.track;
  return lesson.id.startsWith('cripto-') ? 'cripto' : 'fundamentos';
}
