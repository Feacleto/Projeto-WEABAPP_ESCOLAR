/**
 * O FUNDO ESCURO QUE SE MEXE — as três camadas das portas de entrada.
 *
 * POR QUE ISTO É UM COMPONENTE
 * As mesmas três camadas estavam escritas à mão em `DriverSignup` e em
 * `FirstAccess`, e o login ia receber uma terceira cópia. Três cópias de seis
 * valores de gradiente é o jeito de as portas divergirem sem ninguém decidir
 * isso: bastava alguém ajustar a opacidade numa e as duas telas que a pessoa
 * atravessa na mesma sessão passariam a ter fundos diferentes.
 *
 * AS TRÊS CAMADAS, E O QUE CADA UMA FAZ
 *   1. o halo verde-escuro do canto de cima à esquerda — dá profundidade e é
 *      de onde a luz vem;
 *   2. o halo verde-vivo do canto de cima à direita, mais lento — é o que faz
 *      o fundo respirar em vez de piscar;
 *   3. a grade de 44px a 6% — o único elemento com forma, e ela existe para o
 *      movimento ter referência. Sem a grade, dois halos difusos parecem
 *      apenas um degradê estático.
 *
 * O MOVIMENTO É LENTO DE PROPÓSITO (os keyframes estão em index.css) e morre
 * inteiro em `prefers-reduced-motion` — o fundo fica parado e continua
 * legível parado, porque nada de informação mora aqui.
 *
 * `aria-hidden` e `pointer-events-none`: é decoração atrás de conteúdo, e
 * quem usa leitor de tela não ouve nada disto.
 */
export default function FundoNoturno() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0 opacity-80 animate-glow-drift"
        style={{
          background:
            'radial-gradient(110% 80% at 10% 0%, rgba(31,95,63,.6) 0%, rgba(11,18,16,0) 62%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-60 animate-glow-drift-slow"
        style={{
          background:
            'radial-gradient(90% 70% at 100% 10%, rgba(82,196,26,.2) 0%, rgba(11,18,16,0) 58%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.06] animate-grid-drift"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />
    </div>
  );
}
