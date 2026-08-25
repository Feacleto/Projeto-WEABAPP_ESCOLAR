import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, FileText } from 'lucide-react';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentsByChild } from '../../hooks/usePayments';
import { getChild } from '../../services/childrenService';
import { computeDisplayStatus } from '../../services/paymentsService';
import {
  formatCurrency,
  formatDate,
  formatMonthLabel,
} from '../../utils/formatters';

/**
 * Extrato de mensalidades de UM aluno — pra imprimir, mandar ou anotar em cima.
 *
 * POR QUE ELE EXISTE SEPARADO DO RELATÓRIO GERAL
 * O relatório de /tio/finance/report responde "como vai meu mês". Este responde
 * uma pergunta diferente, que aparece numa conversa: "o que essa família me
 * pagou e o que ficou aberto". É o papel que o motorista leva pra sentar com o
 * responsável, ou que manda quando alguém contesta um mês — e pra isso ele
 * precisa nascer com nome do aluno, nome do responsável e período no cabeçalho.
 * O histórico que já existia na ficha do aluno é tela: rola, tem botão, não
 * imprime.
 *
 * PDF SEM BIBLIOTECA DE PDF
 * `window.print()` e o CSS de impressão que o projeto já tem (@media print no
 * index.css). No celular, o diálogo do sistema oferece "Salvar como PDF" — que
 * dá pra mandar no WhatsApp e imprimir. Uma biblioteca de PDF resolveria o
 * mesmo problema pesando algumas centenas de KB no bundle de um app que roda
 * em celular barato com internet de rua.
 *
 * A ÁREA DE ANOTAÇÃO É PARTE DO DOCUMENTO
 * O caso de uso é imprimir e escrever em cima (combinado de parcelamento, data
 * que a família prometeu pagar, assinatura de quem recebeu). Papel sem espaço
 * pra isso obriga a escrever torto na margem — então as linhas e o campo de
 * assinatura existem no documento, e só aparecem na impressão.
 *
 * O QUE ESTE EXTRATO NÃO PODE PROMETER
 * A retenção de pagamentos é de 12 meses. Um extrato que dissesse "histórico
 * completo" mentiria no décimo terceiro mês, então o cabeçalho diz o período
 * que ele realmente cobre — o primeiro e o último mês que existem no banco.
 */
export default function TioChildStatement() {
  const { id } = useParams();
  const { profile } = useAuth();
  const { payments, loading } = usePaymentsByChild(id);

  const [child, setChild] = useState(null);
  const [loadingChild, setLoadingChild] = useState(true);

  useEffect(() => {
    let alive = true;
    getChild(id)
      .then((c) => alive && setChild(c))
      .catch((err) => console.error('getChild (extrato):', err))
      .finally(() => alive && setLoadingChild(false));
    return () => {
      alive = false;
    };
  }, [id]);

  // Mais recente primeiro: é a ordem em que a conversa começa ("esse mês aqui
  // você não pagou"), não a ordem de um livro-caixa.
  const linhas = useMemo(
    () =>
      (payments || [])
        .map((p) => ({ ...p, _display: computeDisplayStatus(p) }))
        .sort((a, b) => (b.month || '').localeCompare(a.month || '')),
    [payments]
  );

  const totais = useMemo(() => {
    let pago = 0;
    let aberto = 0;
    for (const p of linhas) {
      const valor = Number(p.amount) || 0;
      if (p._display === 'paid') pago += valor;
      else aberto += valor;
    }
    return { pago, aberto };
  }, [linhas]);

  const periodo = useMemo(() => {
    if (!linhas.length) return null;
    return { de: linhas[linhas.length - 1].month, ate: linhas[0].month };
  }, [linhas]);

  if (loading || loadingChild) {
    return (
      <>
        <Header title="Extrato do aluno" showBack backLabel="Crianças" backTo="/tio/children" />
        <div className="p-5 space-y-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Extrato do aluno" showBack backLabel="Crianças" backTo="/tio/children" />

      <div className="p-5 space-y-5">
        <div className="print:hidden">
          <Button
            variant="success"
            icon={Printer}
            onClick={() => window.print()}
          >
            Imprimir / Salvar PDF
          </Button>
          <p className="mt-2 text-center text-[11px] text-textMuted">
            no celular, escolha &ldquo;Salvar como PDF&rdquo; pra mandar no
            WhatsApp
          </p>
        </div>

        <article className="bg-card rounded-3xl shadow-sm p-6 print:p-0 print:shadow-none print:rounded-none space-y-6">
          <header className="space-y-1 border-b border-gray-200 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-textMuted">
                  Extrato de mensalidades
                </p>
                <h1 className="text-2xl font-bold text-text leading-tight mt-1">
                  {profile?.companyName || profile?.name || 'Transporte escolar'}
                </h1>
                {profile?.companyDocument && (
                  <p className="text-xs text-textMuted mt-1">
                    {profile.companyDocument}
                  </p>
                )}
              </div>
              <FileText size={28} className="text-textMuted shrink-0 mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-3 text-xs">
              <p className="text-textMuted">
                Aluno:{' '}
                <span className="font-bold text-text">{child?.name || '—'}</span>
              </p>
              <p className="text-textMuted">
                Responsável:{' '}
                <span className="font-bold text-text">
                  {child?.parentName || '—'}
                </span>
              </p>
              <p className="text-textMuted">
                Período:{' '}
                <span className="font-semibold text-text">
                  {periodo
                    ? `${formatMonthLabel(periodo.de)} a ${formatMonthLabel(periodo.ate)}`
                    : '—'}
                </span>
              </p>
              <p className="text-textMuted">
                Emitido em{' '}
                <span className="font-semibold text-text">
                  {new Date().toLocaleDateString('pt-BR')}
                </span>
              </p>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-900">
                Pago
              </p>
              <p className="text-2xl font-bold text-emerald-900 tabular-nums mt-1">
                {formatCurrency(totais.pago)}
              </p>
            </div>
            <div className="bg-amber-50 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-900">
                Em aberto
              </p>
              <p className="text-2xl font-bold text-amber-900 tabular-nums mt-1">
                {formatCurrency(totais.aberto)}
              </p>
            </div>
          </section>

          {linhas.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhuma mensalidade registrada"
              description="Quando a cobrança deste aluno for gerada, ela aparece aqui."
            />
          ) : (
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-text">Mês a mês</h2>
              {/* Rola no celular e cabe inteira no papel. */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-textMuted">
                      <th className="py-2 pr-2 font-semibold">Mês</th>
                      <th className="py-2 pr-2 font-semibold">Vencimento</th>
                      <th className="py-2 pr-2 text-right font-semibold">
                        Valor
                      </th>
                      <th className="py-2 pr-2 font-semibold">Situação</th>
                      <th className="py-2 font-semibold">Pago em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100">
                        <td className="py-2 pr-2 font-semibold text-text">
                          {formatMonthLabel(p.month)}
                        </td>
                        <td className="py-2 pr-2 text-textMuted">
                          {formatDate(p.dueDate)}
                        </td>
                        <td className="py-2 pr-2 text-right font-semibold tabular-nums text-text">
                          {formatCurrency(Number(p.amount) || 0)}
                        </td>
                        <td className="py-2 pr-2">
                          <span className={SITUACAO[p._display]?.classe}>
                            {SITUACAO[p._display]?.rotulo || p._display}
                          </span>
                        </td>
                        <td className="py-2 text-textMuted">
                          {p._display === 'paid' ? (
                            <>
                              {formatDate(p.paidAt)}
                              {p.paymentMethod && (
                                <span className="block text-[10px]">
                                  {METODO[p.paymentMethod] || p.paymentMethod}
                                </span>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Só no papel: é aqui que ele escreve o combinado e assina. */}
          <section className="hidden pt-2 print:block">
            <h2 className="text-sm font-bold text-text">Observações</h2>
            <div className="mt-2 space-y-6">
              {[0, 1, 2, 3].map((n) => (
                <div key={n} className="border-b border-gray-300" />
              ))}
            </div>
            <div className="mt-10 flex gap-8 text-[11px] text-textMuted">
              <div className="flex-1 border-t border-gray-400 pt-1">
                Assinatura do responsável
              </div>
              <div className="flex-1 border-t border-gray-400 pt-1">
                Assinatura do motorista
              </div>
            </div>
          </section>
        </article>
      </div>
    </>
  );
}

const SITUACAO = {
  paid: { rotulo: 'Pago', classe: 'font-semibold text-emerald-700' },
  claimed: {
    rotulo: 'Aguardando confirmação',
    classe: 'font-semibold text-blue-700',
  },
  overdue: { rotulo: 'Atrasado', classe: 'font-semibold text-red-700' },
  pending: { rotulo: 'Em aberto', classe: 'font-semibold text-amber-700' },
};

const METODO = {
  pix: 'PIX',
  cash: 'dinheiro',
  card: 'cartão',
};
