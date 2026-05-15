/**
 * Logo oficial do WhatsApp em SVG inline (não depende de lib externa).
 * Usado em links/botões que abrem conversa no WhatsApp.
 *
 * Cor oficial #25D366 quando colored=true (default). Pra contextos em que
 * o ícone vai sobre fundo colorido (ex: dentro de um botão verde com texto
 * branco), passe colored={false} e o ícone usa currentColor.
 */
export default function WhatsAppIcon({ size = 18, colored = true }) {
  const bg = colored ? '#25D366' : 'currentColor';
  const fg = colored ? '#FFFFFF' : 'currentColor';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill={bg}
        d="M16.003 0C7.165 0 .003 7.163.003 16c0 2.823.74 5.587 2.146 8.013L0 32l8.205-2.151A15.93 15.93 0 0 0 16.003 32C24.84 32 32 24.836 32 16S24.84 0 16.003 0z"
      />
      <path
        fill={fg}
        d="M23.41 22.59c-.32.89-1.86 1.7-2.59 1.79-.66.08-1.48.11-2.38-.15-.55-.16-1.26-.4-2.16-.79-3.8-1.64-6.28-5.46-6.47-5.71-.19-.26-1.55-2.05-1.55-3.91s.97-2.78 1.31-3.16c.34-.38.74-.47.99-.47.25 0 .49.002.71.014.23.012.54-.087.85.65.32.78 1.08 2.69 1.18 2.89.1.2.16.43.03.69-.13.26-.19.42-.37.65-.18.23-.38.5-.55.68-.18.18-.38.38-.16.74.22.36.97 1.6 2.08 2.59 1.42 1.27 2.62 1.66 2.99 1.85.37.18.59.15.81-.09.22-.24.94-1.08 1.18-1.45.24-.37.49-.31.82-.19.33.13 2.1.99 2.46 1.17.36.18.6.27.69.42.09.15.09.87-.23 1.76z"
      />
    </svg>
  );
}
