/**
 * O ÍCONE DO PIX — um losango de cantos redondos com as duas ondas por dentro
 * (pedido do dono, 04/10/2026, a partir da imagem do símbolo).
 *
 * O lucide não tem ícone de PIX, e o losango puro (`Diamond`) não lembrava
 * nada. Este é desenhado no MESMO sistema dos ícones do lucide — caixa de
 * 24×24, traço em `currentColor`, pontas redondas —, então aceita as mesmas
 * props (`size`, `strokeWidth`, `className`) e entra onde um ícone do lucide
 * entraria, inclusive como `icon={IconePix}`.
 */
export default function IconePix({ size = 24, strokeWidth = 2, className = '', ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <rect x="4.25" y="4.25" width="15.5" height="15.5" rx="3.4" transform="rotate(45 12 12)" />
      <path d="M6.05 7H7.4q.6 0 1 .4l2.9 2.9q.7.7 1.4 0l2.9-2.9q.4-.4 1-.4h1.35" />
      <path d="M6.05 17H7.4q.6 0 1-.4l2.9-2.9q.7-.7 1.4 0l2.9 2.9q.4.4 1 .4h1.35" />
    </svg>
  );
}
