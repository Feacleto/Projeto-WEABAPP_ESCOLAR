/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── SUPERFÍCIES CLARAS ──────────────────────────────────────────
        //
        // FUNDO DA PÁGINA — cinza com viés verde levíssimo.
        //
        // O valor anterior (#F7F8F7) tinha só 6% de separação do branco dos
        // cartões: na prática, cartão branco sobre fundo branco, sem borda
        // visível. Este tem 12,7% — o cartão flutua sem precisar de borda,
        // e o texto quase-preto mantém 15,6:1 de contraste (o mínimo da WCAG
        // pra texto normal é 4,5:1, então há folga enorme pra leitura sob sol
        // e em tela de celular barato, que é o caso do tio dentro da perua).
        //
        // O viés é VERDE e não neutro nem azul: o G fica um degrau acima do
        // R e do B, o que amarra o cinza ao esmeralda da marca. Cinza puro
        // lê como "não escolhido"; azul brigaria com a marca e o app pareceria
        // ter dois sistemas de cor.
        bg: '#EEF1EF',
        card: '#FFFFFF',
        // Superfície recuada DENTRO de um cartão branco (código PIX, blocos
        // de observação). Nome próprio pra o código novo não precisar de
        // bg-gray-50 solto, que perde o sentido se o fundo mudar de novo.
        surface: '#F6F8F7',
        // A LINHA DESATIVADA: criança fora da rota de hoje, campo disabled.
        // Não é o mesmo que `surface` — aquilo é um bloco que RECUA, este é
        // um item que APAGOU. Substitui os usos de gray-50.
        sunken: '#F9FAFB',

        // AS TRÊS BORDAS, do mais fraco pro mais forte. Existiam como
        // gray-100/200/300 espalhados (~340 usos), e a escolha entre eles
        // era pelo dedo, não pela regra.
        //
        // `neutro` NÃO se chama `divider` de propósito: dos 88 usos, 47 são
        // PREENCHIMENTO (o X redondo das folhas, o trilho do gráfico, o
        // esqueleto de carregamento, o segmento inativo de um seletor) e 41
        // são linha. Não há uso dominante, e `bg-divider` num botão seria uma
        // classe válida e mentirosa. A regra dele é por PESO: é o cinza mais
        // fraco do sistema, seja como risco ou como fundo em repouso.
        neutro: '#F3F4F6',
        border: '#E5E7EB', // a borda de tudo — 94% dos usos são borda mesmo
        borderStrong: '#D1D5DB', // borda de campo, tracejado, e a ALÇA de
        // arrastar das folhas (que é affordance física: precisa ser vista)

        // ── SUPERFÍCIE ESCURA — só a home pública do motorista ───────────
        //
        // Ela está COMPRANDO: escuro, negócio, decisão. A porta da família é
        // clara, igual ao app dela — ver o cabeçalho de Familia.jsx.
        night: '#0B1210',
        glass: 'rgba(255,255,255,0.055)',
        glassBorder: 'rgba(255,255,255,0.1)',
        onNight: '#FFFFFF', // 18,7:1 sobre night
        onNightMuted: '#B3B6B5', // 9,3:1. Substitui SEIS opacidades de branco
        // (white/70 a white/40) usadas pro mesmo papel, duas das quais
        // reprovavam contraste — inclusive o CNPJ e os links legais do rodapé.
        //
        // O VERDE NO ESCURO é outro verde. O `primary` da marca (#1F5F3F) é
        // quase invisível sobre o quase-preto — 1,4:1 — então a porta escura
        // sempre usou um verde claro, e ele merece nome em vez de continuar
        // como `emerald-300` solto em onze arquivos. São dois porque têm dois
        // papéis, igual ao âmbar: um é palavra e ícone, o outro é massa.
        onNightAccent: '#6EE7B7', // texto, ícone e borda sobre night
        onNightAccentFill: '#34D399', // preenchimento e tinta sobre night

        // ── TEXTO ───────────────────────────────────────────────────────
        text: '#111827', // 15,6:1 sobre bg. Não mexer: é a folga do sol.
        // CORRIGIDO. Era #6B7280, que dava 4,8:1 sobre o branco do cartão e
        // só 4,3:1 sobre o fundo da PÁGINA — passava onde foi testado e
        // reprovava onde mais aparece. É o segundo texto mais usado do app.
        // Agora: 5,6:1 sobre bg, 6,4:1 sobre card, 5,8:1 sobre divider.
        textMuted: '#55606E',

        // ── MARCA E AÇÃO ────────────────────────────────────────────────
        primary: '#1F5F3F', // 6,7:1 sobre bg; branco sobre ele dá 7,6:1
        primaryDark: '#143F2A',
        // O degrau claro do verde da marca — o painel, o chip e a borda de
        // tudo que está EM ORDEM. Os valores são os do emerald do Tailwind,
        // que é o que já estava na tela: a diferença de matiz entre ele e o
        // verde-floresta da marca é imperceptível nessas saturações, e trocar
        // por um tom derivado do `primary` mudaria a aparência de ~60 lugares
        // sem ninguém ter pedido. Fica registrado que são famílias diferentes.
        primarySoft: '#ECFDF5',
        primaryChip: '#D1FAE5',
        primaryBorder: '#A7F3D0',
        // O verde-limão das ondas da marca. Em interface significa CONCLUÍDO.
        // Só preenchimento e ícone — como TEXTO dá 2,3:1 e é ilegível.
        accent: '#52C41A',
        // O verde quando ele precisa ser PALAVRA. Já existia à mão como
        // text-lime-700 (#4D7C0F) no PaymentRow e no StatusBadge — mas aquele
        // dá 4,4:1 sobre o fundo da página, a mesma armadilha do textMuted.
        // Este é o lime-800: 6,2:1 sobre bg, 7,1:1 sobre card, 6,5:1 sobre o
        // chip de success/10 onde ele de fato vive.
        accentText: '#3F6212',

        // ── SINAIS ──────────────────────────────────────────────────────
        //
        // ÂMBAR É AVISO E NADA MAIS: algo que a pessoa precisa atender.
        // Fatura vencida, falta marcada, criança sem horário. Ele tinha um
        // gêmeo (`secondary`, o mesmo hex) que era usado como enfeite — e
        // gastar a cor de alerta em decoração queima o sinal.
        warning: '#F5A623', // preenchimento e ícone. Como texto dá 2,0:1.
        warningText: '#92400E', // 7,1:1 sobre branco, 6,8:1 sobre warningSoft
        warningSoft: '#FFFBEB', // o PAINEL inteiro de um aviso
        warningChip: '#FEF3C7', // o CHIP e o quadradinho atrás do ícone. Era o
        // degrau que faltava: com só Soft e Border, um chip sobre cartão branco
        // ou sumia (Soft é quase branco) ou virava borda usada como fundo.
        warningBorder: '#FDE68A',
        // Perda e irreversível: encerrar rota por engano, apagar, atraso.
        danger: '#EF4444', // preenchimento. Como texto dá 3,8:1 — reprovava
        // justamente na mensagem de erro do Input, que aparece no pior momento.
        dangerText: '#B91C1C', // 6,5:1 sobre branco, 5,9:1 sobre dangerSoft
        dangerSoft: '#FEF2F2', // o painel
        dangerChip: '#FEE2E2', // o chip — 5,3:1 com o dangerText
        dangerBorder: '#FECACA',

        // ── INFORMAÇÃO — a quarta família de sinal, e a que quase escapou
        //
        // Azul e índigo estavam em ~30 lugares e eu levei quatro varreduras
        // pra ver que eram UMA coisa: o fato neutro. A notificação recente, o
        // valor previsto (que ainda não venceu, então não é âmbar), o cartão
        // de aviso do mapa, a dica do funil. Nada disso pede ação e nada
        // disso é conclusão — mandar pro `warning` seria alarmar por um fato,
        // e mandar pro `accent` seria dar por resolvido o que não está.
        //
        // O índigo virou azul: eram duas escadas pro mesmo papel, e a mistura
        // já tinha produzido um `bg-indigo-500` com texto branco em 4,5:1 —
        // exatamente no piso, sem folga nenhuma pra tela sob sol.
        info: '#1D4ED8', // branco sobre ele dá 6,7:1
        infoSoft: '#EFF6FF', // o painel
        infoChip: '#DBEAFE', // o chip — 5,5:1 com o infoText
        infoBorder: '#BFDBFE',
        infoText: '#1D4ED8', // 6,7:1 sobre branco, 5,9:1 sobre bg

        // ── SEMÂNTICA DO PRODUTO ────────────────────────────────────────
        //
        // A ESCOLA, em toda tela: a parada na lista do motorista, o pin no
        // mapa, o recado da escola. É LEGENDA, não decoração — casa é verde,
        // perua é âmbar, escola é violeta — e legenda precisa de nome, senão
        // diverge entre telas (eram violet-700 e violet-900 pro mesmo rótulo).
        // Ele serve de texto E de preenchimento: 7,1:1 nas duas direções
        // contra o branco, o que é raro e vale registrar — por isso a escola
        // não precisa de um `escolaText` como o âmbar e o vermelho precisam.
        escola: '#6D28D9',
        escolaSoft: '#F5F3FF', // o painel
        escolaChip: '#EDE9FE', // o chip — 6,0:1 com o escola
        escolaBorder: '#DDD6FE', // e o ícone de escola sobre `night`: 13,6:1

        // ── AS OUTRAS DUAS FAMÍLIAS DE ÂMBAR ────────────────────────────
        //
        // A regra do sistema é que âmbar significa ATENDER — fatura vencida,
        // falta marcada, criança sem horário. Só que existem no produto duas
        // coisas âmbar que não pedem nada a ninguém, e fingir o contrário
        // seria consertar a regra e quebrar a tela.
        //
        // A PERUA. Casa é verde, perua é âmbar, escola é violeta: é a LEGENDA
        // do produto, e ela aparece no pin do mapa, na arte da home e no chip
        // de estado. O hex é o mesmo do `warning`, e isso NÃO repete o erro
        // que este trabalho desfez — o problema do `secondary` nunca foi
        // compartilhar tinta, foi não ter significado. "A segunda cor" serve
        // pra qualquer coisa; "a perua" não serve pra nada além da perua.
        perua: '#F5A623',
        //
        // O OURO: o âmbar que não quer dizer nada. A estrela de avaliação, a
        // moeda da arte, os pontinhos de enfeite. Sem este nome, todo enfeite
        // dourado ia bater na porta do `warning` e queimar o sinal de novo —
        // foi exatamente assim que o `secondary` virou decoração.
        //
        // Ele fica em 1,7:1 sobre o branco, abaixo do piso de 3:1 pra objeto
        // gráfico. É dívida herdada, registrada de propósito: quem for
        // consertar, o conserto é CONTORNO na estrela vazia, e não ouro mais
        // escuro — escurecer o ouro resolve a medição e estraga a leitura.
        ouro: '#FBBF24',

        // FORAM REMOVIDOS DAQUI: `secondary`, `secondaryDark`, `success` e
        // `accentDark`. Eram quatro nomes pra duas tintas que já existiam, e
        // o custo não era o arquivo — era a tela. "Secundária" não diz nada,
        // então servia pra tudo: foi assim que a cor de AVISO virou enfeite da
        // porta de entrada, e o botão verde de confirmar ficou com rótulo
        // branco em 2,3:1. Nome vago não é economia, é permissão.
      },
      // ── ELEVAÇÃO ───────────────────────────────────────────────────
      //
      // As sombras do app carregavam COR, e cada arquivo escolhia a sua:
      // esmeralda a 15%, 20%, 25%, 30% e 40%, índigo, violeta, âmbar, preto
      // em seis opacidades. Vinte e cinco combinações pra três situações.
      //
      // O custo não é a bagunça, é que sombra colorida CHAMA. Quando cinco
      // coisas chamam na mesma tela, nenhuma chama — e a que precisava
      // chamar (a criança em foco, o botão de iniciar rota) perde a briga
      // pro cartão decorativo do lado.
      //
      // Três níveis, e o do meio tem cota:
      boxShadow: {
        // Em repouso. Cinza, discreta, e a maioria absoluta dos cartões.
        rest: '0 1px 3px 0 rgb(17 24 39 / 0.07), 0 1px 2px -1px rgb(17 24 39 / 0.05)',
        // O foco da tela — colorida com o verde da marca. UMA POR TELA.
        // Duas sombras coloridas na mesma tela e nenhuma das duas chama.
        focus: '0 8px 24px -6px rgb(31 95 63 / 0.28)',
        // O que de fato FLUTUA: folha, barra de abas, modal, chamada em
        // tela cheia. Preta e forte, porque tem conteúdo por baixo.
        float: '0 12px 32px -8px rgb(0 0 0 / 0.38)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        mobile: '480px',
      },
    },
  },
  plugins: [],
};
