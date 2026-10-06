import { useMemo } from 'react';
import { Printer, FileText, CheckCircle2, Clock, AlertCircle, Hourglass } from 'lucide-react';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import { usePaymentsByParent } from '../../hooks/usePayments';
import { computeDisplayStatus } from '../../services/paymentsService';
import {
  paymentLabel,
  paymentChipClasses,
} from '../../dominio/cobranca/paymentVocabulary';
import {
  formatCurrency,
  formatMonthLabel,
  formatDate,
} from '../../compartilhado/formatters';

/**
 * Histórico financeiro do Pai pra leitura / impressão.
 * Lista todos os pagamentos do responsável dentro da retenção — 60 meses,
 * ver `dominio/cobranca/retencao.js`.
 *
 * ⚠️ É O EXTRATO DA FAMÍLIA, NÃO DO FILHO ATIVO (03/10/2026).
 * A consulta é por RESPONSÁVEL e sempre trouxe as mensalidades de todos os
 * filhos — mas o título era o nome do filho ativo, então a mãe de dois lia
 * as mensalidades do irmão debaixo do nome errado, e o "A pagar" somava as
 * duas sob um nome só. Filtrar pelo filho ativo foi descartado: o extrato é
 * o documento que ela imprime para conferir o que deve, e esconder a dívida
 * do outro filho num papel chamado "histórico" é pior que o título errado.
 * Então o título fica neutro e, com mais de um filho, cada linha diz de quem
 * é. O "Prestador" só aparece quando há UM motorista na lista — com filhos em
 * peruas diferentes, um nome só seria o prestador errado para metade das
 * linhas.
 */
export default function PaiFinanceReport() {
  const { user, profile } = useAuth();
  // A HISTÓRIA INTEIRA, só aqui: o extrato promete a retenção toda, e é aberto
  // sob demanda. Início e Financeiro leem a janela de 12 meses.
  const { payments, loading } = usePaymentsByParent(user?.uid, { historico: true });

  const enriched = useMemo(
    () => payments.map((p) => ({ ...p, _display: computeDisplayStatus(p) })),
    [payments]
  );

  /**
   * Só o que ele DEVE. Sem total acumulado de quanto já pagou: esse
   * número não muda nenhuma decisão dele, e o valor de cada mês já está
   * na linha do mês. `claimed` fica de fora — ele pagou e está esperando
   * confirmação, não deve nada.
   */
  const debtTotal = useMemo(
    () =>
      enriched.reduce((acc, p) => {
        if (p._display === 'pending' || p._display === 'overdue') {
          return acc + (Number(p.amount) || 0);
        }
        return acc;
      }, 0),
    [enriched]
  );

  const nomesDosFilhos = useMemo(
    () => [...new Set(payments.map((p) => p.childName).filter(Boolean))],
    [payments]
  );
  const variosFilhos = nomesDosFilhos.length > 1;
  const motoristas = useMemo(
    () => [...new Set(payments.map((p) => p.adminUid).filter(Boolean))],
    [payments]
  );
  const { admin } = useAdminProfile(motoristas.length === 1 ? motoristas[0] : null);

  const onPrint = () => window.print();

  if (loading) {
    return (
      <>
        <Header title="Histórico de pagamentos" showBack backLabel="Mensalidade" backTo="/pai/finance" />
        <div className="p-5 space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Histórico de pagamentos" showBack backLabel="Mensalidade" backTo="/pai/finance" />

      <div className="p-5 space-y-5">
        <div className="print:hidden">
          <Button variant="success" icon={Printer} onClick={onPrint}>
            Imprimir / Salvar PDF
          </Button>
        </div>

        <article className="bg-card rounded-3xl shadow-sm p-6 print:p-0 print:shadow-none print:rounded-none space-y-6">
          <header className="space-y-1 border-b border-border pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-text leading-tight">
                  Histórico de pagamentos
                </h1>
                <p className="text-base text-textMuted mt-1">
                  Responsável: {profile?.name || '—'}
                </p>
                {nomesDosFilhos.length > 0 && (
                  <p className="text-base text-textMuted">
                    {variosFilhos ? 'Crianças' : 'Criança'}:{' '}
                    {nomesDosFilhos.join(', ')}
                  </p>
                )}
              </div>
              <FileText size={28} className="text-textMuted shrink-0 mt-1" />
            </div>
            {admin?.companyName && (
              <p className="text-sm text-textMuted pt-2">
                Prestador: {admin.companyName}
              </p>
            )}
            <p className="text-sm text-textMuted">
              Emitido em {new Date().toLocaleDateString('pt-BR')}
            </p>
          </header>

          {/* Total no topo só quando há dívida. Em dia, o extrato é a
            * lista — sem número grande dizendo zero. */}
          {debtTotal > 0 ? (
            <section className="bg-warningSoft rounded-2xl p-4">
              <p className="rotulo text-warningText">
                A pagar
              </p>
              <p className="text-2xl font-bold text-warningText tabular-nums mt-1">
                {formatCurrency(debtTotal)}
              </p>
            </section>
          ) : (
            <section className="bg-primarySoft rounded-2xl p-4">
              <p className="text-base font-bold text-primary">
                Tudo em dia
              </p>
              <p className="text-sm text-primary mt-0.5">
                Nenhuma mensalidade em aberto.
              </p>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="text-base font-bold text-text">Mensalidades</h2>
            {enriched.length === 0 ? (
              <p className="text-sm text-textMuted text-center py-6">
                Sem pagamentos no histórico.
              </p>
            ) : (
              <div className="space-y-2">
                {enriched.map((p) => (
                  <PaymentLine key={p.id} payment={p} mostrarFilho={variosFilhos} />
                ))}
              </div>
            )}
          </section>

          <footer className="text-center text-xs text-textMuted pt-4 border-t border-border">
            Alô Buzinou · Documento gerado em{' '}
            {new Date().toLocaleString('pt-BR')}
          </footer>
        </article>
      </div>
    </>
  );
}

// A palavra e a cor saem do MESMO vocabulário do Financeiro
// (paymentVocabulary): aqui o `claimed` dizia "Aguardando" em azul enquanto
// o Financeiro dizia "Pago" em verde para o mesmo pagamento.
function PaymentLine({ payment, mostrarFilho }) {
  const Icon = ICONE_DO_ESTADO[payment._display] || Clock;
  const chip = paymentChipClasses(payment._display, 'parent');

  return (
    <div className="bg-bg rounded-2xl p-3 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${chip}`}
      >
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-text capitalize leading-tight">
          {formatMonthLabel(payment.month)}
        </p>
        {mostrarFilho && payment.childName && (
          <p className="text-base text-text">{payment.childName}</p>
        )}
        <p className="text-sm text-textMuted mt-0.5">
          Vencimento: {formatDate(payment.dueDate)}
          {payment.paidAt && ` · Pago em ${formatDate(payment.paidAt)}`}
          {payment.paymentMethod && (
            <span>
              {' '}
              · {methodLabel(payment.paymentMethod)}
            </span>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-base font-bold text-text tabular-nums">
          {formatCurrency(payment.amount)}
        </p>
        <span
          className={`mt-1 inline-block max-w-[9rem] rounded-full px-2 py-0.5 text-left text-sm font-semibold leading-tight ${chip}`}
        >
          {paymentLabel(payment._display, 'parent')}
        </span>
      </div>
    </div>
  );
}

const ICONE_DO_ESTADO = {
  paid: CheckCircle2,
  claimed: Hourglass,
  pending: Clock,
  overdue: AlertCircle,
};

function methodLabel(m) {
  if (m === 'cash') return 'Dinheiro';
  if (m === 'card') return 'Cartão';
  return 'PIX';
}
