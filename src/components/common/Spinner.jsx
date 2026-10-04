/**
 * O ANEL DE CARREGAMENTO (04/10/2026, escolhido pelo dono entre quatro).
 *
 * Era o `Loader2` do lucide, um traço solto girando. Agora é um anel de trilho
 * apagado com um arco correndo por cima: o trilho mostra onde o arco anda, e
 * lê melhor no sol que um traço sem chão. É o que o `Button loading` desenha
 * — "Salvando" com o anel ao lado — e, quando termina, quem chamou mostra o
 * "Pronto" com o certo.
 *
 * É uma EXCEÇÃO NOMEADA do design system: espera real, que acaba sozinha.
 * Com "reduzir movimento" o arco para no lugar.
 */
export default function Spinner({ size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      role="img"
      aria-label="Carregando"
      // Gira o SVG inteiro: o trilho é um círculo e não muda girando, e assim
      // não depende de `transform-box`, que cada navegador trata de um jeito.
      className={`shrink-0 animate-spin [animation-duration:900ms] motion-reduce:animate-none ${className}`}
    >
      <circle cx="13" cy="13" r="10" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <circle
        cx="13"
        cy="13"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="44 100"
      />
    </svg>
  );
}
