/** @type {import('tailwindcss').Config} */
/*
 * ═══ O DESIGN SYSTEM MORA AQUI (03/10/2026) ═══
 *
 * Este arquivo é a FONTE ÚNICA das cores, fontes, raios, sombras e tempos
 * de animação do app E do site. O site (landing/) é HTML estático sem build
 * e não lê Tailwind: `npm run tokens` gera `src/design/tokens.css` e
 * `landing/tokens.css` a partir daqui, e `npm run testar:design` falha se as
 * cópias ficarem para trás. Mudou um valor aqui → rode `npm run tokens`.
 *
 * As regras de uso (qual peça, qual cor, quando animar) estão em
 * docs/design-system.md. Os VALORES moram só aqui.
 *
 * O sistema nasceu de nove diferenças entre o site e o app (D1–D9 no
 * documento): o site tinha a cara da marca, o app tinha as cores medidas.
 * Ficou a cara de um com a régua do outro.
 */
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
        sunken: '#F4F6F5',

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
        //
        // ⚠️ OS TRÊS VIERAM DO SITE (03/10/2026, D4 do design system). Eram
        // os cinzas do Tailwind (#F3F4F6, #E5E7EB, #D1D5DB), puxados para o
        // AZUL, e ao lado do site o app parecia frio — outro produto. Agora
        // puxam para o verde, como o fundo da página sempre puxou.
        neutro: '#EDF0EE',
        border: '#D9E0DB', // a borda de tudo — 94% dos usos são borda mesmo
        borderStrong: '#BFC9C2', // borda de campo, tracejado, e a ALÇA de
        // arrastar das folhas (que é affordance física: precisa ser vista)

        // ── O PAPEL É OUTRO SUPORTE, E PEDE OUTRA BORDA ──────────────────
        //
        // `borderStrong` (#D1D5DB) é calibrado para tela. Numa impressora a
        // jato quase sem tinta — que é a que o motorista tem — ele
        // simplesmente não sai, e linha de assinatura invisível é folha
        // inutilizada.
        //
        // Este token existe para que essa exceção tenha NOME. Ela estava no
        // extrato como `border-gray-400` cru, e cor crua fora dos três
        // endereços de paleta é o que a regra 1 proíbe: nome vago (ou nenhum
        // nome) é permissão para o próximo uso.
        //
        // Só em superfície IMPRESSA: extrato, contrato, recibo.
        linhaImpressa: '#9CA3AF',

        // ── SUPERFÍCIE ESCURA — só a home pública do motorista ───────────
        //
        // Ela está COMPRANDO: escuro, negócio, decisão. A porta da família é
        // clara, igual ao app dela — ver o cabeçalho de Familia.jsx.
        night: '#0B1210',
        glass: 'rgba(255,255,255,0.055)',
        glassBorder: 'rgba(255,255,255,0.1)',
        onNight: '#FFFFFF', // 18,7:1 sobre night
        onNightMuted: '#C9D3CD', // 12,3:1 — o do site. Substitui SEIS opacidades de branco
        // (white/70 a white/40) usadas pro mesmo papel, duas das quais
        // reprovavam contraste — inclusive o CNPJ e os links legais do rodapé.
        //
        // O VERDE NO ESCURO é outro verde. O `primary` da marca (#1F5F3F) é
        // quase invisível sobre o quase-preto — 1,4:1 — então a porta escura
        // sempre usou um verde claro, e ele merece nome em vez de continuar
        // como `emerald-300` solto em onze arquivos. São dois porque têm dois
        // papéis, igual ao âmbar: um é palavra e ícone, o outro é massa.
        // ⚠️ ERAM QUATRO VERDES CLAROS (o site tinha #6EE07A e #8EF0AE, o app
        // #6EE7B7, e ainda a menta). Ficaram dois: este, que é palavra e
        // ícone (13,7:1 sobre night), e o `menta` abaixo, do rótulo em mono.
        onNightAccent: '#8EF0AE', // texto, ícone e borda sobre night
        onNightAccentFill: '#34D399', // preenchimento e tinta sobre night
        menta: '#A7F3D0', // o rótulo em mono sobre night ou sobre primary

        // ── TEXTO ───────────────────────────────────────────────────────
        // 16,7:1 sobre bg. Não mexer: é a folga do sol. Era #111827, o
        // quase-preto AZULADO do Tailwind; virou o `preto` do site, que puxa
        // para o verde (D4). A folga até subiu.
        text: '#0B1210',
        // O parágrafo LONGO — termos, explicações, o corpo do site. 11,0:1.
        // Título, valor e nome continuam em `text`.
        textBody: '#2C3631',
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
        //
        // ⚠️ ATUALIZADO (03/10/2026, D5): eram os do emerald (#ECFDF5,
        // #D1FAE5, #A7F3D0), e o site usava outros (#DDF5E5). Ficaram os do
        // site — a caixinha de ícone, o chip "em dia" e o avatar são a mesma
        // tinta nos dois lados agora. 6,6:1 do primary sobre o chip.
        primarySoft: '#EEF8F1',
        primaryChip: '#DDF5E5',
        primaryBorder: '#B9E4C6',
        // O verde-limão das ondas da marca. Em interface significa CONCLUÍDO.
        // Só preenchimento e ícone — como TEXTO dá 2,3:1 e é ilegível.
        accent: '#52C41A',
        // O verde quando ele precisa ser PALAVRA. Já existia à mão como
        // text-lime-700 (#4D7C0F) no PaymentRow e no StatusBadge — mas aquele
        // dá 4,4:1 sobre o fundo da página, a mesma armadilha do textMuted.
        // Este é o lime-800: 6,2:1 sobre bg, 7,1:1 sobre card, 6,5:1 sobre o
        // chip de success/10 onde ele de fato vive.
        //
        // ⚠️ ATUALIZADO (03/10/2026, D5): era o lime-800 (#3F6212), e o chip
        // verde do app misturava o fundo esmeralda com a letra limão. Virou o
        // verde do chip do site: 5,7:1 sobre bg, 6,5:1 sobre card, 5,7:1
        // sobre o primaryChip, e branco sobre ele dá 6,5:1.
        accentText: '#1C6B3F',
        // A TINTA SOBRE O LIMÃO — o rótulo do botão `accent`. Só existe junto
        // dele: o limão é botão apenas sobre verde ou escuro, onde o
        // verde-escuro some (design system, D3). 7,5:1.
        onAccent: '#06210A',

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
        // ⚠️ AS SOMBRAS DO TAILWIND APONTAM PARA AS DO SISTEMA (03/10/2026, D7).
        // `shadow-sm` aparecia 52 vezes e `shadow-2xl` 16, fora dos três
        // níveis abaixo. Em vez de caçar cada uso, o nome velho passou a
        // significar o nível certo: o que é cartão vira `rest`, o que flutua
        // vira `float`. Classe nova usa o nome do nível.
        sm: '0 1px 3px 0 rgb(11 18 16 / 0.07), 0 1px 2px -1px rgb(11 18 16 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(11 18 16 / 0.07), 0 1px 2px -1px rgb(11 18 16 / 0.05)',
        md: '0 1px 3px 0 rgb(11 18 16 / 0.07), 0 1px 2px -1px rgb(11 18 16 / 0.05)',
        lg: '0 12px 32px -8px rgb(0 0 0 / 0.38)',
        xl: '0 12px 32px -8px rgb(0 0 0 / 0.38)',
        '2xl': '0 12px 32px -8px rgb(0 0 0 / 0.38)',
        // Em repouso. Cinza, discreta, e a maioria absoluta dos cartões.
        rest: '0 1px 3px 0 rgb(11 18 16 / 0.07), 0 1px 2px -1px rgb(11 18 16 / 0.05)',
        // O foco da tela — colorida com o verde da marca. UMA POR TELA.
        // Duas sombras coloridas na mesma tela e nenhuma das duas chama.
        focus: '0 14px 30px -14px rgb(20 63 42 / 0.6)',
        // O que de fato FLUTUA: folha, barra de abas, modal, chamada em
        // tela cheia. Preta e forte, porque tem conteúdo por baixo.
        float: '0 12px 32px -8px rgb(0 0 0 / 0.38)',
        // O CARTÃO DE FUNDO do login — e ele é o oposto do `float`.
        //
        // `float` é 0.38 de preto porque tem conteúdo por baixo e precisa
        // vencer. Estes cartões precisam PERDER: eles mostram o app
        // funcionando atrás do formulário, e sombra forte os promove a
        // primeiro plano — a pessoa tenta ler o fundo em vez de entrar.
        // Descola do fundo e para aí. Ver marca/fundoDoLogin.js.
        fundo: '0 10px 30px -6px rgb(11 18 16 / 0.10)',
      },
      /* ══ A ENTRADA DA TELA — a microinteração do rodapé ══════════════
       * A tela nova entra PELO LADO DA PRÓPRIA ABA: o Início mora à esquerda
       * e o Financeiro à direita. Assim a direção sai de graça nos dois
       * caminhos — indo pro Financeiro ele entra pela direita, voltando, pela
       * esquerda — e ninguém precisa guardar de onde a pessoa veio.
       *
       * ⚠️ DEZ PIXELS, NÃO UMA TELA INTEIRA. Deslizamento longo é lento e
       * embaralha quem está dentro de um veículo em movimento. O deslocamento
       * existe para dar SENTIDO, não para transportar.
       *
       * ⚠️ E É `animation`, NÃO `transition` COM `requestAnimationFrame`.
       * A primeira tentativa foi rAF em dois passos, e ela tem uma falha real:
       * com a aba do navegador em segundo plano o rAF é suspenso, o segundo
       * passo não roda e a tela nova fica PRESA INVISÍVEL. Animação declarada
       * roda na montagem, sem estado transitório para ficar preso — quem
       * interpola é o navegador.
       *
       * A opacidade termina em 69% do tempo (180 ms de 260 ms): o conteúdo
       * fica legível antes de parar de andar, em vez de chegar e só então
       * aparecer.
       *
       * ⚠️ POR QUE AQUI E NÃO NO `index.css`, que é onde moram os outros
       * keyframes do projeto: aquele arquivo estava em edição por outra
       * sessão, e um arquivo por vez é a regra deste repositório. Uma duração,
       * uma curva e uma distância são token de desenho — este arquivo é uma
       * casa defensável para eles. */
      keyframes: {
        'entra-esq': {
          from: { opacity: '0', transform: 'translateX(-10px)' },
          '69%': { opacity: '1' },
          to: { opacity: '1', transform: 'none' },
        },
        'entra-dir': {
          from: { opacity: '0', transform: 'translateX(10px)' },
          '69%': { opacity: '1' },
          to: { opacity: '1', transform: 'none' },
        },
        /* Sem direção: as telas que não são aba (children, rota, agenda) não
           têm lado, e inventar um ensinaria uma geografia que não existe. */
        'entra-plano': { from: { opacity: '0' }, to: { opacity: '1' } },
        /* O anel do tutorial. Cresce pela BORDA (`inset` negativo), e não por
           `scale`: numa caixa do tamanho do cartão do Início, escalar o dobro
           cobriria a tela inteira — o `animate-ping` faz exatamente isso. */
        'tour-pulso': {
          from: { inset: '-4px', opacity: '0.9' },
          to: { inset: '-16px', opacity: '0' },
        },
        /* A criança que acabou de entrar na turma: chega com um pulinho e
           fica respirando. O joinha balança do lado. Tela de cadastro feito. */
        'crianca-chega': {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(.7)' },
          '60%': { opacity: '1', transform: 'translateY(-6px) scale(1.04)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        'crianca-respira': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        joinha: {
          '0%, 100%': { transform: 'rotate(-10deg) scale(1)' },
          '50%': { transform: 'rotate(12deg) scale(1.08)' },
        },
      },
      animation: {
        'entra-esq': 'entra-esq 260ms cubic-bezier(.22,.9,.24,1) both',
        'entra-dir': 'entra-dir 260ms cubic-bezier(.22,.9,.24,1) both',
        'entra-plano': 'entra-plano 180ms linear both',
        'tour-pulso': 'tour-pulso 1.4s ease-out infinite',
        'crianca-chega': 'crianca-chega 600ms cubic-bezier(.22,.9,.24,1) both',
        'crianca-respira': 'crianca-respira 2.6s ease-in-out 600ms infinite',
        joinha: 'joinha 900ms ease-in-out 500ms infinite',
      },

      // ⚠️ AS FONTES DO SITE (03/10/2026, D1). O app usava Inter em tudo, e
      // quem vinha da landing achava que tinha aberto outro produto. A
      // Bricolage é a voz da marca e aparece POUCO: título de tela, a marca,
      // o número que importa (`font-display`). Todo o resto é Instrument Sans.
      // A letra de máquina é só do rótulo em maiúsculas e do código PIX.
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      // ⚠️ QUATRO DEGRAUS DE CANTO (03/10/2026, D6). Os nomes do Tailwind
      // ficaram, os valores mudaram — o app tinha botão a 12px e campo a
      // 16px lado a lado no mesmo formulário, e o site usava cinco raios
      // sem regra. Quanto maior a peça, maior o canto:
      //   lg 10 (chip quadrado, botão pequeno) · xl 14 (botão, campo)
      //   2xl 20 (cartão) · 3xl 28 (folha, cartão de destaque) · full (pílula)
      borderRadius: {
        lg: '10px',
        xl: '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      // O MOVIMENTO: quatro durações e duas curvas (ver docs/design-system.md).
      // Toda animação dura menos de meio segundo, roda uma vez e para.
      transitionDuration: {
        toque: '120ms', // o botão afundando no dedo
        estado: '200ms', // cor, chip, interruptor, e o que sai de cena
        entrada: '300ms', // tela, folha, aviso e item que entra
        festa: '450ms', // conquista: o check, o contador. O teto.
      },
      transitionTimingFunction: {
        freio: 'cubic-bezier(.2,.8,.2,1)', // sai rápido e freia: quase tudo
        mola: 'cubic-bezier(.3,1.5,.5,1)', // passa do ponto e volta: só conquista
      },
      maxWidth: {
        mobile: '480px',
      },
    },
  },
  plugins: [],
};
