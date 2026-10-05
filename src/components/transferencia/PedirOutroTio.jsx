import { useState } from 'react';
import toast from 'react-hot-toast';
import { useCobrancaLigada } from '../../hooks/useCobrancaLigada';
import { pedirParaPassarAOutroTio } from '../../services/transferenciasService';

/**
 * "PEDIR PARA ME PASSAR A OUTRO TIO" — na ficha do filho, do lado da família
 * (fase 2 da rede, 05/10/2026). Mudou de bairro, de escola, de horário: ela
 * pede ao tio DELA. O app nunca mostra uma lista de tios à família
 * (declaração 5 da marca); quem escolhe o parceiro, e se faz sentido, é ele.
 *
 * Fora do ar com a cobrança desligada, como a passagem toda.
 */
export default function PedirOutroTio({ child }) {
  const cobranca = useCobrancaLigada();
  const [feito, setFeito] = useState(false);
  if (!cobranca || !child?.id || child.active === false) return null;

  const pedir = async () => {
    if (!window.confirm('Avisar o seu tio que você quer passar para outro tio?')) return;
    const novo = await pedirParaPassarAOutroTio(child);
    setFeito(true);
    toast.success(novo ? 'Aviso enviado ao seu tio.' : 'Você já pediu este mês.');
  };

  return (
    <button
      type="button"
      onClick={pedir}
      disabled={feito}
      className="min-h-12 w-full rounded-xl border-2 border-border bg-card text-base font-bold text-text disabled:opacity-60"
    >
      {feito ? 'Pedido enviado ao seu tio' : 'Pedir para passar a outro tio'}
    </button>
  );
}
