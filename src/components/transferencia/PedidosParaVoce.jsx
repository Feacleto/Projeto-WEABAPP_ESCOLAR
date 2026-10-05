import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import ConfirmDialog from '../common/ConfirmDialog';
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
  const { user, profile } = useAuth();
  // Com plano e sem o contrato aceito, o que falta é só o contrato: ir aos
  // planos o faria escolher de novo o que já escolheu.
  const soFaltaContrato = !!profile?.plano;
  const navigate = useNavigate();
  const location = useLocation();
  const [pedidos, setPedidos] = useState([]);
  const [ocupado, setOcupado] = useState(null);
  // O id do pedido que pediu a assinatura (ou null).
  const [assinar, setAssinar] = useState(null);
  // O pedido que ele está recusando (abre a confirmação).
  const [recusando, setRecusando] = useState(null);
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
          <p className="text-base text-text">
            {soFaltaContrato
              ? 'Para receber uma família, aceite o contrato da assinatura antes.'
              : 'Para receber uma família, assine um plano antes. Depois volte aqui para aceitar.'}
          </p>
          <button
            type="button"
            onClick={() => navigate(soFaltaContrato ? '/tio/contrato-plataforma' : '/tio/planos', { state: { voltarAoPedido: assinar } })}
            className="mt-3 min-h-12 w-full rounded-xl bg-primary text-base font-bold text-white"
          >
            {soFaltaContrato ? 'Ver o contrato' : 'Ver os planos'}
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
          {/* AUDITORIA DE USO (05/10/2026): um embaixo do outro, o aceite em
            * cima; recusar pede confirmação, porque não tem volta. Com a caixa
            * de assinar aberta, o verde cheio é o dela, e este vira contorno. */}
          <div className="mt-3 space-y-2">
            <button
              type="button"
              disabled={ocupado === t.id}
              onClick={() => responder(t, true)}
              className={`min-h-12 w-full rounded-xl text-base font-bold disabled:opacity-60 ${
                assinar ? 'border-2 border-primary text-primary' : 'bg-primary text-white'
              }`}
            >
              Aceito receber
            </button>
            <button
              type="button"
              disabled={ocupado === t.id}
              onClick={() => setRecusando(t)}
              className="min-h-12 w-full rounded-xl border-2 border-border text-base font-bold text-text disabled:opacity-60"
            >
              Não posso
            </button>
          </div>
        </div>
      ))}
      <ConfirmDialog
        open={!!recusando}
        title={`Recusar ${recusando?.previa?.primeiroNome || 'a criança'}?`}
        description={`${recusando?.marcaDe || 'O tio parceiro'} recebe o aviso, e a criança continua com ele.`}
        confirmLabel="Recusar"
        variant="danger"
        loading={!!recusando && ocupado === recusando.id}
        onConfirm={async () => {
          await responder(recusando, false);
          setRecusando(null);
        }}
        onCancel={() => setRecusando(null)}
      />
    </section>
  );
}
