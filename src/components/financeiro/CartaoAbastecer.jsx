import { useNavigate } from 'react-router-dom';
import { ChevronRight, Fuel } from 'lucide-react';

/**
 * A PORTA DO ABASTECER NA TELA TRANCADA (03/10/2026, maquete aprovada).
 *
 *   <CartaoAbastecer />
 *
 * É BRANCO como os outros desde 04/10/2026 (item 15): o verde cheio da tela
 * trancada é a porta "Acessar dados financeiros" — uma tela, um protagonista.
 * O destaque dele é a LARGURA toda, logo abaixo da porta da senha: abastecer
 * é a coisa que ele mais faz ali, em pé, no posto, com a bomba ligada. Funciona sem senha
 * porque a conta do litro não é segredo do negócio, e quem abastece muitas
 * vezes é a auxiliar.
 */
export default function CartaoAbastecer() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate('/tio/abastecer')}
      className="tap flex min-h-[88px] w-full items-center gap-3.5 rounded-3xl bg-card px-5 py-[18px] text-left text-text shadow-rest"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
        <Fuel size={24} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-bold leading-tight">Abastecer</span>
        <span className="mt-0.5 block text-[15px] leading-snug text-textBody">
          Quanto dá e lançar o abastecimento
        </span>
      </span>
      <ChevronRight size={22} className="shrink-0 text-textBody" aria-hidden="true" />
    </button>
  );
}
