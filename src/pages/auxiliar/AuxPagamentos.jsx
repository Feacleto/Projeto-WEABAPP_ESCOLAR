import { useState } from 'react';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Skeleton from '../../components/common/Skeleton';
import GuardaDosPagamentos from '../../components/auxiliar/GuardaDosPagamentos';
import { useMeusVinculos, useMeusPagamentosDeAuxiliar } from '../../hooks/useAuxiliares';
import { confirmarRecebimentoDaAuxiliar } from '../../services/auxiliarService';
import { formatCurrency } from '../../compartilhado/formatters';
import { diaCurto, mesEAnoDoPagamento, recibosEmOrdem } from '../../dominio/identidade/auxiliar.js';

/**
 * PAGAMENTOS — o que o motorista anotou que pagou a ELA (fase 4, 05/10/2026,
 * desenho aprovado pelo dono).
 *
 * Um cartão por mês e um "Recebi" em cada um. Ela vê SÓ o que foi pago a
 * ela: nenhum número do dinheiro do motorista, nenhuma palavra de caixa
 * (`testar:pagamento-da-auxiliar` reprova). Lê `pagamentosDaAuxiliar`, que as
 * rules abrem só a quem está no recibo — e continua lendo depois de o
 * motorista encerrar o acesso: o pagamento é dela.
 *
 * Protegida pela senha DELA (`GuardaDosPagamentos`).
 *
 * DOIS TIOS (vínculo por par): a lista é por auxiliar, então já traz os
 * recibos dos dois, e cada cartão diz de quem é. O nome vem da marca copiada
 * no VÍNCULO (`marcaDoMotorista`), não do doc do tio — esse fecha para ela
 * quando ele a desativa, e o recibo continua sendo dela.
 */
export default function AuxPagamentos() {
  return (
    <GuardaDosPagamentos>
      <ListaDePagamentos />
    </GuardaDosPagamentos>
  );
}

function ListaDePagamentos() {
  const pagamentos = useMeusPagamentosDeAuxiliar();
  const { vinculos } = useMeusVinculos();
  const marcaDe = (uid) => (vinculos || []).find((v) => v.motoristaUid === uid)?.marcaDoMotorista || 'O motorista';
  const umTioSo = (vinculos || []).length === 1;
  const [confirmando, setConfirmando] = useState(null);

  async function recebi(p) {
    setConfirmando(p.id);
    try {
      await confirmarRecebimentoDaAuxiliar(p.id);
      toast.success('Confirmado.');
    } catch (err) {
      toast.error(err?.message || 'Não deu para confirmar. Tente de novo.');
    } finally {
      setConfirmando(null);
    }
  }

  const lista = recibosEmOrdem(pagamentos);
  // Um protagonista por tela: só o "Recebi" do primeiro mês aberto é cheio.
  const primeiroAberto = lista.find((p) => !p.recebidoEm)?.id;

  return (
    <>
      <Header title="Pagamentos" />
      <div className="space-y-4 p-4">
        <p className="px-1 text-base text-textBody">
          {umTioSo
            ? `O que ${marcaDe(vinculos[0].motoristaUid)} anotou que te pagou. Só você e ele veem.`
            : 'O que cada motorista anotou que te pagou. Só você e ele veem.'}
        </p>

        {pagamentos === null && <Skeleton className="h-32 rounded-2xl" />}

        {pagamentos !== null && lista.length === 0 && (
          <section className="rounded-2xl bg-card p-5 shadow-rest">
            <p className="text-base text-textBody">Nenhum pagamento anotado ainda.</p>
          </section>
        )}

        {lista.map((p) => (
          <section key={p.id} className="space-y-3 rounded-2xl bg-card p-5 shadow-rest">
            <div>
              <p className="rotulo text-textMuted">{mesEAnoDoPagamento(p.mes)}</p>
              <p className="font-display text-2xl font-extrabold text-text">{formatCurrency(p.valor)}</p>
              <p className="mt-1 text-base text-textBody">
                {marcaDe(p.motoristaUid)} anotou que pagou em {diaCurto(p.anotadoEm) || 'hoje'}.
              </p>
            </div>
            {p.recebidoEm ? (
              <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primaryChip px-3 text-base font-semibold text-accentText">
                <Check size={18} aria-hidden="true" />
                Recebimento confirmado
              </span>
            ) : (
              <button
                type="button"
                onClick={() => recebi(p)}
                disabled={confirmando === p.id}
                className={`tap flex min-h-14 w-full items-center justify-center rounded-xl text-lg font-bold disabled:opacity-60 ${
                  p.id === primeiroAberto
                    ? 'bg-marca text-naMarca shadow-focus'
                    : 'border-2 border-primary bg-card text-primary'
                }`}
              >
                {confirmando === p.id ? 'Confirmando…' : 'Recebi'}
              </button>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
