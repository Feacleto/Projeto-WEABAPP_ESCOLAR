import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { responderTransferencia, watchPedidosParaMim } from '../../services/transferenciasService';
import { estaAberta, prazoDoPedido } from '../../dominio/identidade/transferencia.js';
import { AVISO_DA_VOLTA, guardarVolta, limparVolta } from './voltaAoAceite';

/**
 * OS PEDIDOS QUE CHEGARAM AO PARCEIRO (fase 2 da rede, 05/10/2026), no topo
 * da aba "Tios parceiros" da Comunidade — é para lá que o aviso
 * `transferencia_pedida` leva.
 *
 * Ele vê SÓ o primeiro nome e a escola: endereço, telefone e o resto só
 * chegam quando a FAMÍLIA aceitar. Quem ainda não tem plano recebe o
 * caminho para assinar (`precisaAssinar`) e volta para aceitar — decisão do
 * dono: conta grátis não recebe turma.
 *
 * F2.4: o pedido vai junto para os planos (`voltaAoAceite.js`), e quem
 * assinou volta AQUI com ele aberto e "Pronto. Agora você pode aceitar a
 * família." em cima. O aceite segue sendo o toque dele em "Aceito receber".
 */
export default function PedidosParaVoce() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pedidos, setPedidos] = useState([]);
  const [ocupado, setOcupado] = useState(null);
  // O id do pedido que pediu a assinatura (ou null).
  const [assinar, setAssinar] = useState(null);
  const voltouPara = location.state?.pedidoAberto || null;

  useEffect(() => watchPedidosParaMim(user?.uid, setPedidos), [user?.uid]);
  // Voltou: a reserva do sessionStorage já serviu.
  useEffect(() => {
    if (voltouPara) limparVolta();
  }, [voltouPara]);

  const abertos = pedidos.filter((t) => estaAberta(t));
  if (!abertos.length) return null;

  const responder = async (t, aceito) => {
    setOcupado(t.id);
    try {
      await responderTransferencia(t.id, aceito);
      toast.success(aceito ? 'Aceito. Agora a família decide.' : 'Pedido recusado.');
    } catch (err) {
      if (err.precisaAssinar) {
        guardarVolta(t.id);
        setAssinar(t.id);
      }
      toast.error(err.message);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <section className="space-y-2">
      <p className="flex items-center gap-2 text-base font-bold text-text">
        <ArrowRightLeft size={20} className="text-primary" aria-hidden="true" />
        Famílias para você
      </p>
      {assinar && (
        <div className="rounded-2xl bg-primarySoft p-4">
          <p className="text-base text-text">Para receber uma família, assine um plano antes. Depois volte aqui para aceitar.</p>
          <button
            type="button"
            onClick={() => navigate('/tio/planos', { state: { voltarAoPedido: assinar } })}
            className="mt-3 min-h-12 w-full rounded-xl bg-primary text-base font-bold text-white"
          >
            Ver os planos
          </button>
        </div>
      )}
      {abertos.map((t) => (
        <div key={t.id} className={`rounded-2xl bg-card p-4 ${voltouPara === t.id ? 'border-2 border-primary' : ''}`}>
          {voltouPara === t.id && <p className="mb-2 text-base font-bold text-primary">{AVISO_DA_VOLTA}</p>}
          <p className="text-base font-bold text-text">
            {t.marcaDe || 'Um tio parceiro'} quer passar {t.previa?.primeiroNome || 'uma criança'} para você
          </p>
          <p className="mt-1 text-base text-textMuted">
            {t.previa?.escola ? `${t.previa.escola}. ` : ''}
            {prazoDoPedido(t) ? `Responda até ${prazoDoPedido(t)}.` : ''}
          </p>
          <p className="mt-1 text-base text-textMuted">
            O endereço e o contato da família chegam quando ela aceitar.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={ocupado === t.id}
              onClick={() => responder(t, false)}
              className="min-h-12 rounded-xl border-2 border-border text-base font-bold text-text disabled:opacity-60"
            >
              Não posso
            </button>
            <button
              type="button"
              disabled={ocupado === t.id}
              onClick={() => responder(t, true)}
              className="min-h-12 rounded-xl bg-primary text-base font-bold text-white disabled:opacity-60"
            >
              Aceito receber
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
