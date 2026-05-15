import { useState } from 'react';
import { Phone, X, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  resolveCall,
  CALL_STATUS,
} from '../../services/pendingCallService';

/**
 * Pop-up flutuante (não bloqueante) mostrado pro Tio enquanto há
 * chamadas ativas. Aparece no topo dos layouts dele.
 *
 * Estado:
 *   ringing       — "Aguardando resposta..."
 *   acknowledged  — "Pai confirmou — está a caminho" (verde)
 *
 * Botão pra encerrar (resolve) — usado quando o pai aparece de verdade
 * OU quando o Tio quer cancelar.
 */
export default function OutgoingCallPanel({ calls = [] }) {
  if (!calls || calls.length === 0) return null;
  // Mostra só a chamada mais recente
  const call = calls[0];

  return (
    <div
      className="fixed top-2 left-2 right-2 max-w-mobile mx-auto z-[55] pointer-events-none print:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
    >
      <CallPanelCard call={call} />
    </div>
  );
}

function CallPanelCard({ call }) {
  const [submitting, setSubmitting] = useState(false);
  const isAcknowledged = call.status === CALL_STATUS.ACKNOWLEDGED;

  const onResolve = async () => {
    setSubmitting(true);
    try {
      await resolveCall(call.id, 'admin');
      toast.success('Chamada encerrada.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível encerrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const bg = isAcknowledged
    ? 'from-emerald-500 to-green-700'
    : 'from-amber-500 to-orange-600';

  return (
    <div
      className={`pointer-events-auto rounded-2xl bg-gradient-to-r ${bg} text-white shadow-xl p-3 flex items-center gap-3`}
    >
      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
        {isAcknowledged ? (
          <CheckCircle2 size={20} />
        ) : (
          <Phone size={20} className="animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/90">
          {isAcknowledged ? 'Pai confirmou' : 'Aguardando resposta'}
        </p>
        <p className="text-sm font-bold leading-tight truncate">
          {isAcknowledged
            ? `${call.childName || 'Criança'} — pai está a caminho`
            : `Avisando o pai do(a) ${call.childName || 'aluno'}…`}
        </p>
      </div>
      <button
        type="button"
        onClick={onResolve}
        disabled={submitting}
        className="tap w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0"
        aria-label="Encerrar chamada"
      >
        <X size={18} />
      </button>
    </div>
  );
}
