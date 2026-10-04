import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { responderPedidoDeAcesso } from '../../services/pedidosDeAcessoService';
import { formatPhone } from '../../compartilhado/formatters';

/**
 * PEDIDOS DE ACESSO — um responsável sem o link pediu para entrar
 * (02/10/2026).
 *
 * Ela informou o WhatsApp, e ele bate com o de uma criança DELE ainda sem
 * responsável. O número sozinho não libera nada: quem confirma é ele, que
 * conhece a família. Por isso o cartão mostra o que permite reconhecer a
 * pessoa — nome e e-mail da conta, além do número.
 *
 * Desde 03/10/2026 ele mora DENTRO do "Para resolver" do Início, junto das
 * outras pendências, e recebe a lista pronta por prop: quem conta quantas
 * coisas há para resolver é o Início, e assinar os pedidos duas vezes seria
 * leitura duplicada do mesmo dado.
 *
 * "Não conheço" avisa a pessoa e não liga nada.
 *
 * Props: `pedidos` (os em aberto) e `criancas` (a turma, para o nome).
 */
export default function PedidosDeAcesso({ pedidos = [], criancas = [] }) {
  // O nome vem da TURMA DELE, não do pedido — o pedido não o carrega mais,
  // porque quem pediu também lê aquele documento.
  const nomeDe = (p) =>
    String(criancas.find((c) => c.id === p.childId)?.name || p.childName || '').split(/\s+/)[0];
  const [respondendo, setRespondendo] = useState(null);
  if (!pedidos.length) return null;

  const responder = async (pedido, aprovar) => {
    setRespondendo(pedido.id);
    try {
      await responderPedidoDeAcesso(pedido.id, aprovar);
      const filho = nomeDe(pedido) || 'A criança';
      toast.success(aprovar ? `${filho} já aparece para ${pedido.nome || 'o responsável'}.` : 'Pedido recusado.');
    } catch (err) {
      toast.error(err.message || 'Não deu pra responder agora.');
    } finally {
      setRespondendo(null);
    }
  };

  return (
    <>
      {pedidos.map((p) => {
        const filho = nomeDe(p) || 'uma criança';
        return (
          <div key={p.id} className="rounded-2xl bg-card p-4 shadow-rest">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
                <KeyRound size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-text">Pedido de acesso</p>
                <p className="mt-0.5 text-base leading-snug text-textBody">
                  {p.nome || 'Um responsável'} quer acompanhar {filho}
                </p>
                {/* Só o WhatsApp (03/10/2026): o pedido não leva mais o
                  * e-mail de quem pediu — o motorista conhece a família pelo
                  * nome e pelo número. */}
                {p.telefone && (
                  <p className="mt-0.5 text-sm text-textMuted">
                    {formatPhone(p.telefone)}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={respondendo === p.id}
                onClick={() => responder(p, false)}
                className="tap h-12 flex-1 rounded-xl border-2 border-border bg-card text-base font-bold text-text disabled:opacity-60"
              >
                Não conheço
              </button>
              <button
                type="button"
                disabled={respondendo === p.id}
                onClick={() => responder(p, true)}
                className="tap h-12 flex-1 rounded-xl bg-primary text-base font-bold text-white disabled:opacity-60"
              >
                Aprovar
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
