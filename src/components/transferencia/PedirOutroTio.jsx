import { useState } from 'react';
import { useCobrancaLigada } from '../../hooks/useCobrancaLigada';
import ConfirmDialog from '../common/ConfirmDialog';
import { pedirParaPassarAOutroTio } from '../../services/transferenciasService';

/**
 * "PEDIR PARA ME PASSAR A OUTRO TIO" — na ficha do filho, do lado da família
 * (fase 2 da rede, 05/10/2026). Mudou de bairro, de escola, de horário: ela
 * pede ao tio DELA. O app nunca mostra uma lista de tios à família
 * (declaração 5 da marca); quem escolhe o parceiro, e se faz sentido, é ele.
 *
 * Fora do ar com a cobrança desligada, como a passagem toda.
 *
 * AUDITORIA DE USO (05/10/2026): a pergunta é o ConfirmDialog da casa, e
 * depois do pedido o botão dá lugar a uma frase — botão apagado o público de
 * 40+ lê como quebrado.
 */
function hojeEmDdMm() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PedirOutroTio({ child }) {
  const cobranca = useCobrancaLigada();
  const [perguntando, setPerguntando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // null = ainda não pediu; 'novo' = pediu agora; 'ja' = já tinha pedido este mês.
  const [resultado, setResultado] = useState(null);
  if (!cobranca || !child?.id || child.active === false) return null;

  const pedir = async () => {
    setEnviando(true);
    const novo = await pedirParaPassarAOutroTio(child);
    setEnviando(false);
    setPerguntando(false);
    setResultado(novo ? 'novo' : 'ja');
  };

  if (resultado) {
    return (
      <p className="rounded-2xl bg-card p-4 text-base text-text">
        {resultado === 'novo'
          ? `Você pediu ao seu tio em ${hojeEmDdMm()}. Ele escolhe um tio parceiro e te avisa.`
          : 'Você já pediu ao seu tio este mês. Ele escolhe um tio parceiro e te avisa.'}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPerguntando(true)}
        className="min-h-12 w-full rounded-xl border-2 border-border bg-card text-base font-bold text-text"
      >
        Pedir para passar a outro tio
      </button>
      <ConfirmDialog
        open={perguntando}
        title="Pedir para passar a outro tio?"
        description="O seu tio recebe o aviso e escolhe um tio parceiro. Nada muda até você aceitar."
        confirmLabel="Pedir"
        loading={enviando}
        onConfirm={pedir}
        onCancel={() => setPerguntando(false)}
      />
    </>
  );
}
