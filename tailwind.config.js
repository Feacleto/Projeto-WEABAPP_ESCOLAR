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
        warningSoft: '#FFFBEB',
        warningBorder: '#FDE68A',
        // Perda e irreversível: encerrar rota por engano, apagar, atraso.
        danger: '#EF4444', // preenchimento. Como texto dá 3,8:1 — reprovava
        // justamente na mensagem de erro do Input, que aparece no pior momento.
        dangerText: '#B91C1C', // 6,5:1 sobre branco, 5,9:1 sobre dangerSoft
        dangerSoft: '#FEF2F2',
        dangerBorder: '#FECACA',

        // ── SEMÂNTICA DO PRODUTO ────────────────────────────────────────
        //
        // A ESCOLA, em toda tela: a parada na lista do motorista, o pin no
        // mapa, o recado da escola. É LEGENDA, não decoração — casa é verde,
        // perua é âmbar, escola é violeta — e legenda precisa de nome, senão
        // diverge entre telas (eram violet-700 e violet-900 pro mesmo rótulo).
        escola: '#6D28D9', // branco sobre ele dá 7,1:1
        escolaSoft: '#F5F3FF',
        escolaBorder: '#DDD6FE',

        // ── A SAIR NA FASE 4 ────────────────────────────────────────────
        // Quatro nomes pra duas tintas que já existem acima. Ficam só até os
        // 39 usos serem decididos um a um (aviso ou enfeite?); removê-los
        // antes é build vermelha e pressa pra escolher errado.
        secondary: '#F5A623', // = warning
        secondaryDark: '#D48816',
        accentDark: '#3F9B12',
        success: '#52C41A', // = accent
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
