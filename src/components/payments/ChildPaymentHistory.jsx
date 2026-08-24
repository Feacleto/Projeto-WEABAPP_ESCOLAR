import { useMemo, useState } from 'react';
import { ChevronDown, Paperclip, Wallet } from 'lucide-react';
import Card from '../common/Card';
import Skeleton from '../common/Skeleton';
import { usePaymentsByChild } from '../../hooks/usePayments';
import { computeDisplayStatus } from '../../services/paymentsService';
import { formatCurrency, formatMonthLabel } from '../../utils/formatters';
import {
  paymentLabel,
  paymentChipClasses,
  parentClaimedLabel,
  parentClaimedTone,
  TONE_CLASSES,
} from '../../utils/paymentVocabulary';

const INITIAL_ROWS = 4;

/**
 * Histórico de mensalidades de UMA criança, na ficha dela.
 *
 * POR QUE AQUI E NÃO SÓ NO FINANCEIRO
 * A pergunta que o tio mais faz ao financeiro não é "quanto entrou este mês"
 * — é "a família do Miguel está em dia?". Pra responder isso ele tinha que
 * ir ao Financeiro e navegar mês a mês, montando a resposta de cabeça. O
 * histórico pertence à ficha da criança, que é onde a pergunta nasce.
 *
 * Mostra os quatro meses mais recentes e expande o resto: quem tem dois anos
 * de histórico não precisa vê-lo todo pra saber se está em dia.
 *
 * Props:
 *   - childId
 *   - role: 'admin' | 'parent' — muda só o vocabulário do status
 */
export default function ChildPaymentHistory({ childId, role = 'admin' }) {
  const { payments, loading } = usePaymentsByChild(childId);
  const [showAll, setShowAll] = useState(false);

  const { rows, totalPaid, openCount } = useMemo(() => {
    const list = (payments || [])
      .map((p) => ({ ...p, _display: computeDisplayStatus(p) }))
      // Mais recente primeiro: o mês corrente é o que ele quer ver.
      .sort((a, b) => String(b.month).localeCompare(String(a.month)));

    return {
      rows: list,
      totalPaid: list
        .filter((p) => p._display === 'paid')
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0),
      openCount: list.filter((p) => p._display !== 'paid').length,
    };
  }, [payments]);

  if (loading) return <Skeleton className="h-32 rounded-2xl" />;

  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-sm font-semibold text-text">Mensalidades</p>
        <p className="text-xs text-textMuted mt-1">
          Nenhuma cobrança gerada ainda para esta criança.
        </p>
      </Card>
    );
  }

  const visible = showAll ? rows : rows.slice(0, INITIAL_ROWS);

  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Wallet size={19} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">Mensalidades</p>
          {/* A resposta em uma linha, antes da lista: é o que ele quer saber. */}
          <p className="text-xs text-textMuted mt-0.5">
            {openCount === 0
              ? 'Tudo em dia'
              : openCount === 1
              ? '1 mês em aberto'
              : `${openCount} meses em aberto`}
            {/* O acumulado é informação do TIO — pra ele é o quanto aquela
              * família já rendeu. Pro pai é só um lembrete de quanto gastou,
              * que não muda decisão nenhuma dele. */}
            {role === 'admin' &&
              totalPaid > 0 &&
              ` · ${formatCurrency(totalPaid)} já recebidos`}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {visible.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0"
          >
            <span className="text-xs text-text capitalize flex-1 min-w-0 truncate">
              {formatMonthLabel(p.month)}
            </span>
            {p.receiptURL && (
              <a
                href={p.receiptURL}
                target="_blank"
                rel="noreferrer"
                aria-label="Ver comprovante"
                className="tap text-primary shrink-0"
              >
                <Paperclip size={13} />
              </a>
            )}
            <span className="text-xs font-semibold text-text shrink-0 tabular-nums">
              {formatCurrency(p.amount)}
            </span>
            <StatusChip payment={p} role={role} />
          </div>
        ))}
      </div>

      {rows.length > INITIAL_ROWS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="tap w-full flex items-center justify-center gap-1 text-xs font-semibold text-primary py-1"
        >
          {showAll ? 'Ver menos' : `Ver todos os ${rows.length} meses`}
          <ChevronDown
            size={14}
            className={`transition-transform ${showAll ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </Card>
  );
}

/**
 * O chip de status. Separado porque a regra do `claimed` do pai depende do
 * comprovante: com anexo ele leu "Pago" em verde, porque do lado dele está
 * resolvido — a baixa que falta é do motorista.
 */
function StatusChip({ payment, role }) {
  const resolved =
    role === 'parent' &&
    payment._display === 'claimed' &&
    !!payment.receiptURL;

  const label = resolved
    ? parentClaimedLabel(true)
    : paymentLabel(payment._display, role);
  const classes = resolved
    ? TONE_CLASSES[parentClaimedTone(true)]
    : paymentChipClasses(payment._display);

  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${classes}`}
    >
      {label}
    </span>
  );
}
