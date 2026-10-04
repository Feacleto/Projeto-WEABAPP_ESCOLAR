import { useState, useMemo } from 'react';
import {
  QrCode,
  DollarSign,
  Banknote,
  X,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Skeleton from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PaymentRow from '../../components/payments/PaymentRow';
import PixBlock from '../../components/payments/PixBlock';
import ReceiptPicker from '../../components/payments/ReceiptPicker';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentsByParent } from '../../hooks/usePayments';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import {
  computeDisplayStatus,
  claimPayment,
  unclaimPayment,
} from '../../services/paymentsService';
import { uploadPaymentReceipt, fileHash } from '../../services/photoService';
import {
  logPaymentEvent,
  PAYMENT_EVENTS,
} from '../../services/paymentAuditService';
import {
  notifyPaymentClaimed,
} from '../../services/notificationsService';
import {
  formatCurrency,
  formatMonthLabel,
  emCentavos,
  diasDeCalendario,
} from '../../compartilhado/formatters';

export default function PaiFinance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { payments, loading } = usePaymentsByParent(user?.uid);
  // Fluxo do "Paguei": primeiro escolhe o método, depois confirma
  const [methodPicker, setMethodPicker] = useState(null); // payment escolhido
  const [claiming, setClaiming] = useState(null); // { payment, method }
  // Comprovante escolhido antes de confirmar o aviso de pagamento.
  const [receiptFile, setReceiptFile] = useState(null);
  const [unclaiming, setUnclaiming] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  /**
   * O que o pai realmente DEVE.
   *
   * Duas correções em relação à versão anterior:
   *
   * 1. `claimed` NÃO é dívida. Ele já pagou e está esperando o motorista
   *    confirmar — cobrar de novo por algo que ele resolveu é o tipo de
   *    erro que faz a pessoa desconfiar do app.
   *
   * 2. Não existe total acumulado de quanto ele já pagou. Esse número não
   *    serve pra nenhuma decisão dele, e soa como lembrete de quanto
   *    gastou. O valor de cada mês aparece na linha do mês, que é onde
   *    ele procura.
   */
  const debtTotal = useMemo(
    () =>
      emCentavos(
        payments.reduce((acc, p) => {
          const s = computeDisplayStatus(p);
          if (s === 'pending' || s === 'overdue') {
            return acc + (Number(p.amount) || 0);
          }
          return acc;
        }, 0)
      ),
    [payments]
  );

  // A mensalidade que o pai vai pagar agora: a mais antiga ainda em aberto.
  // Guia o bloco PIX pra ele nao ter que escolher nada.
  const nextToPay = useMemo(() => {
    const open = payments
      .filter((p) => computeDisplayStatus(p) !== 'paid' && p.status !== 'claimed')
      .map((p) => ({
        ...p,
        _due: p.dueDate?.toDate?.() || (p.dueDate ? new Date(p.dueDate) : null),
      }))
      .filter((p) => p._due)
      .sort((a, b) => a._due - b._due);
    return open[0] || null;
  }, [payments]);

  // Quantas mensalidades estão em aberto (a pagar ou atrasadas). Com mais de
  // uma, o topo continua mostrando SÓ a mais antiga — é ela que o PIX paga — e
  // diz quantas outras há e o total, que estão na lista logo abaixo.
  const abertas = useMemo(
    () =>
      payments.filter((p) => {
        const s = computeDisplayStatus(p);
        return s === 'pending' || s === 'overdue';
      }).length,
    [payments]
  );

  // A CHAVE PIX É A DO MOTORISTA DAQUELA COBRANÇA.
  //
  // Aqui não serve a criança ativa: esta tela lista as mensalidades de TODOS
  // os filhos, e um responsável pode ter filhos em peruas diferentes. Mostrar
  // uma chave só, escolhida por outro critério, é dinheiro na conta errada com
  // a tela dizendo que está tudo certo.
  //
  // `nextToPay` é a cobrança que o bloco PIX está guiando; o primeiro
  // pagamento serve de base enquanto não há nenhuma em aberto.
  const adminDaCobranca = nextToPay?.adminUid || payments[0]?.adminUid || null;
  const { admin } = useAdminProfile(adminDaCobranca);

  // ⚠️ E O GESTO DE "JÁ PAGUEI" É DO MOTORISTA DAQUELA MENSALIDADE (03/10/2026).
  // O aviso, o WhatsApp e a pergunta "tem PIX?" usavam o motorista da
  // PRÓXIMA cobrança: a mãe de filhos em duas peruas marcava o mês do
  // segundo filho e o aviso chegava ao motorista do primeiro.
  const pagamentoEmFoco = claiming?.payment || methodPicker || null;
  const { admin: adminDoGesto } = useAdminProfile(
    pagamentoEmFoco?.adminUid || adminDaCobranca
  );

  const enriched = useMemo(
    () => payments.map((p) => ({ ...p, _display: computeDisplayStatus(p) })),
    [payments]
  );

  // Detecta se pai tem mais de uma criança — se sim, mostra nome em cada row
  const childIds = useMemo(
    () => new Set(payments.map((p) => p.childId).filter(Boolean)),
    [payments]
  );
  const hasMultipleChildren = childIds.size > 1;


  // Prepara mensagem pronta pro WhatsApp do tio com detalhes do pagamento
  const buildWhatsAppLink = (payment) => {
    if (!adminDoGesto?.phone) return null;
    const phoneDigits = String(adminDoGesto.phone).replace(/\D/g, '');
    const phoneE164 = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
    const text = encodeURIComponent(
      `Olá! Acabei de pagar a mensalidade de ${payment.childName} (${formatMonthLabel(payment.month)}) no valor de ${formatCurrency(payment.amount)}. Segue o comprovante.`
    );
    return `https://wa.me/${phoneE164}?text=${text}`;
  };

  const onPickMethod = (method) => {
    if (!methodPicker) return;
    setClaiming({ payment: methodPicker, method });
    setMethodPicker(null);
    setReceiptFile(null);
  };

  const onConfirmClaim = async () => {
    if (!claiming) return;
    const { payment, method } = claiming;
    setActionLoading(true);
    try {
      // Sobe o comprovante ANTES de marcar como pago: se o upload falhar,
      // o pagamento nao fica avisado sem o anexo que o tio espera.
      let receiptURL = null;
      let receiptHash = null;
      if (receiptFile) {
        try {
          // O hash sai do arquivo ORIGINAL, antes de qualquer
          // redimensionamento — senão dois envios do mesmo print podiam
          // gerar hashes diferentes e a duplicata passaria batido.
          receiptHash = await fileHash(receiptFile);
          receiptURL = await uploadPaymentReceipt(payment.id, receiptFile);
        } catch (err) {
          console.error('Falha ao subir comprovante:', err);
          toast.error('Nao deu pra anexar o comprovante. Avisamos sem ele.');
        }
      }

      await claimPayment(payment.id, method, receiptURL, receiptHash);

      // Trilha append-only: este registro não pode ser apagado por
      // ninguém depois, nem pelo motorista. É o que dá ao pai uma prova
      // de que ele avisou, na data em que avisou.
      // ⚠️ SÃO DOIS FATOS, E O AVISO É O QUE IMPORTA. Aqui o comprovante
      // SUBSTITUÍA o aviso na trilha: quem anexava print ficava sem a linha
      // "Responsável informou o pagamento" — exatamente a prova que este
      // registro existe para dar, e some justo de quem se deu mais trabalho.
      logPaymentEvent(payment.id, {
        type: PAYMENT_EVENTS.CLAIMED,
        actorUid: user?.uid,
        actorRole: 'parent',
        note: method === 'cash' ? 'Pagamento em dinheiro' : 'Pagamento via PIX',
      });
      if (receiptURL) {
        logPaymentEvent(payment.id, {
          type: PAYMENT_EVENTS.RECEIPT_ATTACHED,
          actorUid: user?.uid,
          actorRole: 'parent',
        });
      }

      // Notifica o tio (fire-and-forget)
      if (payment.adminUid) {
        notifyPaymentClaimed({
          adminUid: payment.adminUid,
          paymentId: payment.id,
          childName: payment.childName,
          monthLabel: formatMonthLabel(payment.month),
          amount: payment.amount,
          method,
        });
      }

      if (receiptURL) {
        // Comprovante ja esta no app — nao faz sentido empurrar o pai pro
        // WhatsApp. Era exatamente essa conversa paralela que queriamos
        // tirar do caminho.
        toast.success(
          'Pronto: aguardando o motorista confirmar. O comprovante foi junto.',
          { duration: 5000 }
        );
      } else if (method === 'pix') {
        // Sem anexo, o WhatsApp segue como plano B.
        const wa = buildWhatsAppLink(payment);
        if (wa) {
          window.open(wa, '_blank', 'noopener,noreferrer');
          toast.success(
            'Pronto: aguardando o motorista confirmar. Mande o comprovante no WhatsApp.',
            { duration: 5000 }
          );
        } else {
          toast.success(
            'Pronto: aguardando o motorista confirmar. Mande o comprovante para ele.',
            { duration: 5000 }
          );
        }
      } else {
        toast.success(
          'Pronto: aguardando o motorista confirmar que recebeu o dinheiro.',
          { duration: 6000 }
        );
      }
      setClaiming(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao informar pagamento. Tente novamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const onConfirmUnclaim = async () => {
    if (!unclaiming) return;
    setActionLoading(true);
    try {
      await unclaimPayment(unclaiming.id);

      // ⚠️ ESTE É O EVENTO QUE O ARQUIVO DA TRILHA FOI ESCRITO PARA TER, e
      // era o único dos sete que descrevia uma DESTRUIÇÃO — `unclaimPayment`
      // zera `claimedAt`, `paymentMethod` e `receiptURL` no mesmo write.
      // Sem esta linha, desfazer não deixava rastro nenhum: o mês voltava a
      // "pendente" como se ninguém tivesse avisado nada, e a conversa
      // seguinte não tinha onde se apoiar.
      //
      // Desfazer é direito dele (ele pode ter clicado no mês errado). O que
      // não pode é o gesto sumir junto com o que ele apagou.
      logPaymentEvent(unclaiming.id, {
        type: PAYMENT_EVENTS.UNCLAIMED,
        actorUid: user?.uid,
        actorRole: 'parent',
      });

      toast.success('Aviso desfeito. A mensalidade voltou para A pagar.');
      setUnclaiming(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao desfazer.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {/* "Financeiro", o nome da ABA: a tela não pode se chamar outra coisa
        * que o botão que leva a ela. */}
      <Header
        title="Financeiro"
        action={
          <button
            onClick={() => navigate('/pai/finance/report')}
            aria-label="Ver histórico de pagamentos"
            className="tap inline-flex h-12 items-center gap-1.5 rounded-xl px-3 text-base font-semibold text-primary"
          >
            <FileText size={18} />
            Histórico
          </button>
        }
      />
      <div className="p-4 space-y-4">
        {/* O TOPO É A PERGUNTA DELA: QUANTO, DE QUAL MÊS, ATÉ QUANDO.
          *
          * Padrão Z: em cima à esquerda o número que importa; embaixo o que
          * se faz. O primeiro cartão era o bloco do PIX com o valor em letra
          * miúda e sem vencimento, e "Você tem a pagar" vinha em segundo.
          *
          * Pagamento por PIX — copia-e-cola com o valor já embutido. Antes era
          * só a chave em texto: o pai selecionava, copiava e digitava o valor
          * no app do banco, o que gerava o clássico "paguei 32 no lugar de
          * 320".
          *
          * "JÁ PAGUEI" MORA NO MESMO CARTÃO, logo abaixo do "Copiar": ela
          * copia, vai ao banco, volta — e o botão está onde o polegar ficou.
          * Dispara o mesmo fluxo do "Já paguei" da linha (método → confirmação).
          *
          * COM MAIS DE UMA EM ABERTO, o cartão continua sendo de UMA: a mais
          * antiga, porque o código PIX carrega um valor só e a dívida mais
          * velha é a que o motorista espera primeiro. Uma linha diz quantas
          * outras há e o total; elas estão na lista, cada uma com o próprio
          * "Já paguei". Somar tudo num PIX só seria um valor que não casa com
          * nenhuma mensalidade na hora de ele dar baixa. */}
        {nextToPay ? (
          <Card className="space-y-3">
            <TopoDaMensalidade
              payment={nextToPay}
              mostrarFilho={hasMultipleChildren}
              outras={abertas - 1}
              total={debtTotal}
            />
            {/* txid = id do pagamento, e não o mês.
              *
              * O BR Code aceita 25 caracteres alfanuméricos e o id do
              * Firestore tem 20. Com ele no PIX, cada cobrança fica
              * identificada de forma única no extrato do banco — o que torna
              * a CONCILIAÇÃO automática possível depois, sem trocar mais
              * nada. Com o mês, dois filhos da mesma família geravam o mesmo
              * identificador e o extrato não distinguia um do outro. */}
            <PixBlock
              admin={admin}
              amount={nextToPay.amount}
              txid={nextToPay.id}
            >
              <Button
                variant="secondary"
                size="lg"
                icon={CheckCircle2}
                onClick={() => setMethodPicker(nextToPay)}
                className="border-2 border-primary text-primary font-bold"
              >
                Já paguei
              </Button>
            </PixBlock>
          </Card>
        ) : (
          !loading && (
            <Card>
              <p className="text-base font-semibold text-text">
                Nada a pagar agora
              </p>
              <p className="text-sm text-textMuted mt-1">
                Quando abrir uma mensalidade, o código PIX aparece aqui.
              </p>
            </Card>
          )
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="Sem pagamentos ainda"
            description="O motorista ainda não gerou os pagamentos."
          />
        ) : (
          <div className="space-y-3">
            {enriched.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                displayStatus={p._display}
                showChild={hasMultipleChildren}
                action={renderAction(p, {
                  onClaim: () => setMethodPicker(p),
                  onUnclaim: () => setUnclaiming(p),
                })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Etapa 1: escolher método de pagamento */}
      {methodPicker && (
        <MethodPickerModal
          payment={methodPicker}
          hasPix={!!adminDoGesto?.pixKey}
          onPick={onPickMethod}
          onClose={() => setMethodPicker(null)}
        />
      )}

      {/* Etapa 2: confirmar "marquei como pago" */}
      <ConfirmDialog
        open={!!claiming}
        title={
          claiming?.method === 'cash'
            ? 'Você já pagou em dinheiro?'
            : 'Você já fez o PIX?'
        }
        description={
          claiming ? (
            <>
              Você está dizendo que pagou{' '}
              <strong className="text-text">
                {formatCurrency(claiming.payment.amount)}
              </strong>{' '}
              referente a {claiming.payment.childName} (
              {formatMonthLabel(claiming.payment.month)}).
              <br />
              <span className="text-sm block mt-1 mb-3">
                {claiming.method === 'cash'
                  ? 'Depois, o mês fica "Aguardando o motorista confirmar" até ele dizer que recebeu.'
                  : 'Depois, o mês fica "Aguardando o motorista confirmar" até ele ver o PIX.'}
                {/* A promessa do WhatsApp só quando ela vale: PIX, sem
                  * comprovante anexado e com telefone do motorista. */}
                {claiming.method === 'pix' && !receiptFile && adminDoGesto?.phone
                  ? ' Sem comprovante aqui, abrimos o WhatsApp do motorista para você mandar.'
                  : ''}
              </span>
              {/* Anexar aqui, e nao numa tela separada: e o momento em que
                * o pai acabou de pagar e tem o comprovante na mao. */}
              <ReceiptPicker file={receiptFile} onChange={setReceiptFile} />
            </>
          ) : null
        }
        confirmLabel="Sim, já paguei"
        loading={actionLoading}
        onConfirm={onConfirmClaim}
        onCancel={() => {
          setClaiming(null);
          setReceiptFile(null);
        }}
      />

      {/* Desfazer marcação */}
      <ConfirmDialog
        open={!!unclaiming}
        title="Desfazer o aviso de pagamento?"
        description="Use se você tocou em Já paguei por engano. A mensalidade volta para A pagar."
        confirmLabel="Sim, desfazer"
        variant="danger"
        loading={actionLoading}
        onConfirm={onConfirmUnclaim}
        onCancel={() => setUnclaiming(null)}
      />
    </>
  );
}

function renderAction(payment, { onClaim, onUnclaim }) {
  if (payment._display === 'paid') return null;

  if (payment._display === 'claimed') {
    // Desfazer pede confirmação (o diálogo "Desfazer o aviso de
    // pagamento?"): é um toque que tira do motorista o aviso dela.
    return (
      <button
        type="button"
        onClick={onUnclaim}
        className="tap inline-flex h-12 items-center rounded-xl px-3 text-base font-semibold text-textMuted underline"
      >
        Desfazer aviso
      </button>
    );
  }

  // pending / overdue — o mesmo nome do botão do topo.
  return (
    <Button size="sm" fullWidth={false} onClick={onClaim}>
      Já paguei
    </Button>
  );
}

function MethodPickerModal({ payment, hasPix, onPick, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 pt-20"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-mobile bg-card rounded-2xl shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-2 top-2 w-12 h-12 rounded-lg bg-neutro flex items-center justify-center text-textMuted tap"
        >
          <X size={20} />
        </button>

        <h3 className="text-lg font-bold text-text pr-14">Como você pagou?</h3>
        <p className="text-base text-textMuted mt-1 mb-4 pr-14">
          {payment.childName} · {formatMonthLabel(payment.month)} ·{' '}
          <strong>{formatCurrency(payment.amount)}</strong>
        </p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onPick('pix')}
            disabled={!hasPix}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border tap text-left ${
              hasPix
                ? 'bg-card border-border hover:bg-sunken'
                : 'bg-sunken border-neutro opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-primaryChip flex items-center justify-center shrink-0">
              <QrCode size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-text">PIX</p>
              {/* Era "Vamos abrir o WhatsApp…", e não valia para quem anexava
                * o comprovante no passo seguinte. Esta frase vale nos dois. */}
              <p className="text-sm text-textMuted">
                {hasPix
                  ? 'No próximo passo você pode anexar o comprovante.'
                  : 'O motorista ainda não cadastrou a Chave PIX.'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onPick('cash')}
            className="w-full flex items-center gap-3 p-4 rounded-xl border bg-card border-border hover:bg-sunken tap text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-warningChip flex items-center justify-center shrink-0">
              <Banknote size={20} className="text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-text">Dinheiro</p>
              <p className="text-sm text-textMuted">
                Você vai entregar o valor em mãos pro motorista.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * O TOPO DO CARTÃO: mês e valor em 24px, o vencimento logo embaixo.
 *
 * Atrasada, a linha do vencimento vira âmbar ("venceu há 4 dias") — âmbar é
 * aviso, algo para atender. A cor fica na frase, nunca no número: valor
 * colorido se lê como dívida mesmo quando é só a mensalidade (a mesma regra
 * do PaymentRow).
 */
function TopoDaMensalidade({ payment, mostrarFilho, outras, total }) {
  const atrasada = computeDisplayStatus(payment) === 'overdue';
  const dias = diasDeCalendario(new Date(), payment.dueDate);
  const vence =
    payment.dueDate?.toDate?.() || (payment.dueDate ? new Date(payment.dueDate) : null);

  let quando = '';
  if (dias != null) {
    if (dias < 0 || atrasada) {
      const atraso = Math.max(0, -dias);
      quando =
        atraso === 0 ? 'venceu hoje' : atraso === 1 ? 'venceu ontem' : `venceu há ${atraso} dias`;
    } else if (dias === 0) quando = 'vence hoje';
    else if (dias === 1) quando = 'vence amanhã';
    else if (vence) quando = `vence dia ${vence.getDate()}`;
  }

  return (
    <div>
      {mostrarFilho && payment.childName && (
        <p className="text-base text-textMuted">{payment.childName}</p>
      )}
      <p className="text-2xl font-bold leading-tight text-text">
        <span className="capitalize">{formatMonthLabel(payment.month)}</span>
        {' · '}
        <span className="whitespace-nowrap tabular-nums">
          {formatCurrency(payment.amount)}
        </span>
      </p>
      {quando && (
        <p
          className={`mt-1 text-lg font-semibold ${
            atrasada ? 'text-warningText' : 'text-textMuted'
          }`}
        >
          {quando}
        </p>
      )}
      {outras > 0 && (
        <p className="mt-2 text-base text-text">
          {outras === 1
            ? 'Mais 1 mensalidade em aberto'
            : `Mais ${outras} mensalidades em aberto`}{' '}
          na lista abaixo · total {formatCurrency(total)}
        </p>
      )}
    </div>
  );
}
