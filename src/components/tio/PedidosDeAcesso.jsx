import { useState } from 'react';
import toast from 'react-hot-toast';
import { usePedidosDeAcesso } from '../../hooks/usePedidosDeAcesso';
import { responderPedidoDeAcesso } from '../../services/pedidosDeAcessoService';
import { formatPhone } from '../../compartilhado/formatters';

/**
 * PEDIDOS DE ACESSO — um responsável sem o link pediu para entrar
 * (02/10/2026).
 *
 * Ela informou o WhatsApp, e ele bate com o de uma criança DELE ainda sem
 * responsável. O número sozinho não libera nada: quem confirma é ele, que
 * conhece a família. Por isso o cartão mostra o que permite reconhecer a
 * pessoa — nome e e-mail da conta, além do número — e as duas respostas
 * ficam no TOPO do Início, onde ele vê sem procurar.
 *
 * "Não conheço" avisa a pessoa e não liga nada.
 */
export default function PedidosDeAcesso({ className = '' }) {
  const { pedidos } = usePedidosDeAcesso('motorista');
  const [respondendo, setRespondendo] = useState(null);
  const abertos = pedidos.filter((p) => p.status === 'aguardando');
  if (!abertos.length) return null;

  const responder = async (pedido, aprovar) => {
    setRespondendo(pedido.id);
    try {
      await responderPedidoDeAcesso(pedido.id, aprovar);
      const filho = String(pedido.childName || '').split(/\s+/)[0] || 'A criança';
      toast.success(aprovar ? `${filho} já aparece para ${pedido.nome || 'o responsável'}.` : 'Pedido recusado.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra responder agora.');
    } finally {
      setRespondendo(null);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {abertos.map((p) => {
        const filho = String(p.childName || '').split(/\s+/)[0] || 'uma criança';
        return (
          <div
            key={p.id}
            className="rounded-2xl border border-border border-l-4 border-l-warning bg-card p-4"
          >
            <p className="font-bold text-text">
              {p.nome || 'Um responsável'} pediu acesso a {filho}
            </p>
            <p className="mt-0.5 text-xs text-textMuted break-all">
              {[p.email, p.telefone && formatPhone(p.telefone)].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={respondendo === p.id}
                onClick={() => responder(p, true)}
                className="tap h-10 flex-1 rounded-xl bg-primary text-sm font-bold text-white disabled:opacity-60"
              >
                Aprovar
              </button>
              <button
                type="button"
                disabled={respondendo === p.id}
                onClick={() => responder(p, false)}
                className="tap h-10 flex-1 rounded-xl border border-border bg-sunken text-sm font-semibold text-textMuted disabled:opacity-60"
              >
                Não conheço
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
