import { Landmark } from 'lucide-react';

/**
 * "LEIA COM O APP DO BANCO" — embaixo de todo QR de PIX (04/10/2026, pedido
 * do dono).
 *
 * O QR do PIX é um BR Code: a câmera comum do celular lê os caracteres e não
 * sabe o que fazer com eles (mostra um texto estranho, ou nada). Quem paga
 * aponta a câmera, nada acontece, e conclui que o PIX do motorista está
 * quebrado. O caminho certo é o app do banco, na opção de pagar com PIX.
 *
 * Um texto só para os três lugares que mostram o QR (Meu PIX, o PIX da
 * família e a fatura da plataforma): escrito três vezes, um dia um diria
 * outra coisa.
 */
export default function AvisoDoQrPix({ className = '' }) {
  return (
    <p className={`flex items-start gap-2 text-left text-base leading-snug text-textBody ${className}`}>
      <Landmark size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
      <span>
        Leia com o <b className="text-text">app do banco</b>, em pagar com PIX. A câmera do
        celular não lê.
      </span>
    </p>
  );
}
