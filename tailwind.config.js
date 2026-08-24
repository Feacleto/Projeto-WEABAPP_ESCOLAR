/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
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
        primary: '#1F5F3F',
        primaryDark: '#143F2A',
        secondary: '#F5A623',
        secondaryDark: '#D48816',
        accent: '#52C41A',
        accentDark: '#3F9B12',
        text: '#111827',
        textMuted: '#6B7280',
        success: '#52C41A',
        danger: '#EF4444',
        warning: '#F5A623',
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
