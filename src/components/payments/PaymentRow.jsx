import {
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Hourglass,
  Banknote,
  QrCode,
  CreditCard,
  Paperclip,
  Send,
  TriangleAlert,
} from 'lucide-react';
import Card from '../common/Card';
import {
  formatCurrency,
  formatDate,
  formatMonthLabel,
} from '../../utils/formatters';
import {
  paymentLabel,
  paymentChipClasses,
  parentClaimedLabel,
  parentClaimedTone,
  TONE_CLASSES,
} from '../../utils/paymentVocabulary';
import { foiPagoAtrasado } from '../../services/paymentsService';

// A COR fica aqui; o TEXTO vem de utils/paymentVocabulary, que sabe falar
// pro papel de quem está lendo. O estado 'claimed' era o pior caso: o tio
// lia "aguardando confirmação" sem saber que a bola estava com ele.
const STATUS_CONFIG = {
  paid: { color: 'text-accentText bg-accent/10', Icon: CheckCircle2 },
  // 'paid' que entrou depois do vencimento. Não é estado novo — é o mesmo
  // 'paid' com outra cara. Ver foiPagoAtrasado em services/paymentsService.
  paidLate: { color: '', Icon: CheckCircle2 },
  claimed: { color: 'text-warningText bg-warning/10', Icon: Hourglass },
  pending: { color: 'text-textMuted bg-neutro', Icon: Clock },
  overdue: { color: 'text-dangerText bg-danger/10', Icon: AlertCircle },
};

/**
 * Card de uma linha de pagamento — usado por TioFinance e PaiFinance.
 *
 * Props:
 *   - payment:        doc do Firestore
 *   - displayStatus:  'paid' | 'pending' | 'overdue' (calculado fora)
 *   - action:         botão à direita (ex: "Dar baixa") — opcional
 *   - showChild:      mostra nome da criança (default true; Pai esconde)
 */
export default function PaymentRow({
  payment,
  displayStatus,
  action = null,
  showChild = true,
  role = 'parent',
  onAttachReceipt = null,
  onCharge = null,
}) {
  const config = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.pending;
  const { Icon } = config;

  // Mês pago E comprovado, na tela do PAI, não é pendência dele — é
  // pendência do motorista. Mostrar âmbar ali, no meio de meses verdes,
  // faz parecer que o pagamento não valeu. Ele lê "Pago"; o tio continua
  // lendo "aguardando SUA confirmação".
  const parentResolved =
    role === 'parent' && displayStatus === 'claimed' && !!payment.receiptURL;

  // Entrou depois do vencimento? Só o tio vê isso — ver paymentVocabulary.
  const pagoAtrasado = foiPagoAtrasado(payment);

  const label = parentResolved
    ? parentClaimedLabel(true)
    : paymentLabel(displayStatus, role, { pagoAtrasado });
  const color = parentResolved
    ? TONE_CLASSES[parentClaimedTone(true)]
    : pagoAtrasado && role === 'admin'
      ? paymentChipClasses(displayStatus, role, { pagoAtrasado })
      : config.color;

  // SEM PALAVRA, SEM CHIP.
  //
  // Do lado do tio, 'claimed' e 'pending' não têm rótulo: um é tarefa (vira
  // o botão "Dar baixa") e o outro é silêncio (ainda não venceu). Sem esta
  // guarda o chip renderizaria como uma pílula vazia com um ícone solto
  // dentro — pior que a palavra que a gente acabou de tirar.
  const mostrarChip = !!label;

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {showChild && payment.childName && (
            <p className="font-semibold text-text truncate">
              {payment.childName}
            </p>
          )}
          <p className="text-xs text-textMuted capitalize">
            {formatMonthLabel(payment.month)}
          </p>
        </div>
        {mostrarChip && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium shrink-0 ${color}`}
          >
            <Icon size={12} />
            {label}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-text">
            {formatCurrency(payment.amount)}
          </p>
          <p className="text-[11px] text-textMuted flex items-center gap-1">
            <Calendar size={10} />
            Vence: {formatDate(payment.dueDate)}
            {payment.paidAt && ` · Pago: ${formatDate(payment.paidAt)}`}
          </p>
          {/* Comprovante IDÊNTICO ao de outro mês.
            *
            * Aviso, não bloqueio, e só pro tio — é ele quem decide. Boa
            * parte das vezes não é má-fé: a pessoa procura na galeria e
            * pega o print errado. Uma heurística que acusa sozinha erra e
            * estraga uma relação que precisa durar anos. */}
          {role === 'admin' && payment.receiptDuplicateOf && (
            <p className="text-[11px] font-semibold text-warningText bg-warningSoft border border-warningBorder rounded-lg px-2 py-1.5 inline-flex items-start gap-1.5 mt-1">
              <TriangleAlert size={12} className="shrink-0 mt-0.5" />
              <span>
                Comprovante igual ao de{' '}
                {payment.receiptDuplicateOf.month
                  ? formatMonthLabel(payment.receiptDuplicateOf.month)
                  : 'outro mês'}
                . Vale conferir antes de confirmar.
              </span>
            </p>
          )}

          {/* Comprovante anexado pelo pai. Fica a um toque pro tio
            * conferir antes de confirmar — era isto que antes virava
            * print de tela no WhatsApp. */}
          {payment.receiptURL ? (
            <a
              href={payment.receiptURL}
              target="_blank"
              rel="noreferrer"
              className="tap inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline mt-1"
            >
              <Paperclip size={13} />
              Ver comprovante
            </a>
          ) : (
            /* Sem comprovante e já avisado/pago: o tio anexa o print que
             * recebeu no WhatsApp. Sem isso o histórico do mês mostra
             * "pago" sem lastro nenhum. */
            onAttachReceipt &&
            displayStatus !== 'pending' &&
            displayStatus !== 'overdue' && (
              <button
                type="button"
                onClick={onAttachReceipt}
                className="tap inline-flex items-center gap-1.5 text-xs font-semibold text-textMuted underline mt-1"
              >
                <Paperclip size={13} />
                Anexar comprovante
              </button>
            )
          )}
          {payment.paymentMethod && displayStatus !== 'pending' && displayStatus !== 'overdue' && (
            <p className="text-[11px] text-textMuted flex items-center gap-1 mt-0.5">
              {payment.paymentMethod === 'cash' ? (
                <>
                  <Banknote size={10} /> Dinheiro
                </>
              ) : payment.paymentMethod === 'card' ? (
                <>
                  <CreditCard size={10} /> Cartão
                </>
              ) : (
                <>
                  <QrCode size={10} /> PIX
                </>
              )}
            </p>
          )}
        </div>
        {action}
      </div>

      {/* Cobrar sem sair do app. Só pra quem está devendo — em 'pago' ou
        * "aguardando confirmação" cobrar seria constrangedor e errado. */}
      {onCharge &&
        (displayStatus === 'overdue' || displayStatus === 'pending') && (
          <button
            type="button"
            onClick={onCharge}
            className="tap w-full h-10 rounded-xl bg-card border border-border text-text text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            <Send size={13} />
            {displayStatus === 'overdue' ? 'Cobrar no WhatsApp' : 'Lembrar no WhatsApp'}
          </button>
        )}
    </Card>
  );
}
