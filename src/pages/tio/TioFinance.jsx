import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key,
  ChevronRight,
  AlertTriangle,  X,
  Search,
  Banknote,
  QrCode,
  CreditCard,
  Wallet,
  DollarSign,
  FileText,
  TrendingDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PaymentRow from '../../components/payments/PaymentRow';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentsByMonth } from '../../hooks/usePayments';
import { useChildren } from '../../hooks/useChildren';
import { buildChargeMessage } from '../../utils/chargeMessage';
import {
  confirmReceipt,
  undoReceipt,
  canUndoReceipt,
  computeDisplayStatus,
  attachReceipt,
  watchArrears,
} from '../../services/paymentsService';
import { notifyPaymentConfirmed } from '../../services/notificationsService';
import { uploadPaymentReceipt, fileHash } from '../../services/photoService';
import {
  logPaymentEvent,
  PAYMENT_EVENTS,
} from '../../services/paymentAuditService';
import ReceiptPicker from '../../components/payments/ReceiptPicker';
import MonthSwitcher from '../../components/payments/MonthSwitcher';
import BillingBlockers from '../../components/payments/BillingBlockers';
import { shareReceipt } from '../../services/receiptImageService';
import {
  formatMonthLabel,
  formatCurrency,
  getCurrentMonthKey,
} from '../../utils/formatters';
import { PIX_KEY_TYPES } from '../../services/userService';

/**
 * Financeiro do Tio — dashboard mês-a-mês.
 *
 * Mudanças vs versão anterior:
 *   - Seletor de mês (12 meses pra trás navegáveis)
 *   - Pagamentos do mês corrente são GERADOS AUTOMATICAMENTE pelo useAutoBilling
 *     (não tem mais botão "+" manual)
 *   - Ao "dar baixa", sheet pergunta como o tio recebeu: PIX, Dinheiro ou Cartão
 *   - Hero card "Recebido" + "Pra receber" em destaque (gradiente)
 */
export default function TioFinance() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const { payments, loading } = usePaymentsByMonth(monthKey);

  // A dívida que ficou pra trás. Fica FORA do usePaymentsByMonth de propósito:
  // ela não pertence ao mês na tela, ela existe APESAR do mês na tela.
  const [arrears, setArrears] = useState([]);
  useEffect(() => watchArrears(monthKey, setArrears), [monthKey]);
  const [filter, setFilter] = useState('all');

  // Busca por nome. A pergunta que o tio mais faz ao financeiro não é
  // "quanto entrou este mês" — é "a família do Miguel está em dia?". Sem
  // isso ele varria a lista inteira com o dedo.
  const [search, setSearch] = useState('');

  // Telefone do responsável não vive em `payments`; vem da criança. É o que
  // permite cobrar sem sair do app.
  const { children } = useChildren();

  // Confirmar / desfazer recebimento
  const [methodSheetFor, setMethodSheetFor] = useState(null); // payment ou null
  const [unconfirming, setUnconfirming] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagamento que o tio escolheu pra anexar comprovante. O caminho real é
  // o pai pagar pelo banco e mandar o print no WhatsApp — sem isto aquele
  // comprovante nunca entra no app.
  const [attachingTo, setAttachingTo] = useState(null);

  // Pagamento em DINHEIRO acabou de ser confirmado. Dinheiro não deixa
  // rastro nenhum — nem extrato, nem comprovante do banco — e é onde a
  // discussão nasce um mês depois. O app oferece o recibo na hora, enquanto
  // o tio ainda está com o assunto na mão.
  const [receiptFor, setReceiptFor] = useState(null);
  const [sharingReceipt, setSharingReceipt] = useState(false);
  const [attachFile, setAttachFile] = useState(null);

  const enriched = useMemo(
    () => payments.map((p) => ({ ...p, _display: computeDisplayStatus(p) })),
    [payments]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enriched.filter((p) => {
      if (filter !== 'all' && p._display !== filter) return false;
      if (!term) return true;
      return String(p.childName || '').toLowerCase().includes(term);
    });
  }, [enriched, filter, search]);

  const childById = useMemo(
    () => new Map((children || []).map((c) => [c.id, c])),
    [children]
  );

  /**
   * Cobrança pelo WhatsApp, com a mensagem pronta.
   *
   * Informação sem ação é só ansiedade: ele via "3 atrasados" e tinha que
   * sair do app, abrir o WhatsApp, achar o contato e escrever o texto. Era
   * exatamente o atrito que o faz voltar pra planilha que ele já domina.
   */
  const onCharge = (payment) => {
    const child = childById.get(payment.childId);
    const phone = child?.parentPhone;
    if (!phone) {
      toast.error('Telefone do responsável não cadastrado na ficha.');
      return;
    }
    const digits = String(phone).replace(/\D/g, '');
    const e164 = digits.startsWith('55') ? digits : `55${digits}`;
    const text = buildChargeMessage({
      payment,
      displayStatus: payment._display,
      pixKey: profile?.pixKey,
      driverName: profile?.companyName || profile?.name,
    });
    window.open(
      `https://wa.me/${e164}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const totals = useMemo(() => {
    const sumByStatus = (statuses) =>
      enriched
        .filter((p) => statuses.includes(p._display))
        .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    return {
      paid: sumByStatus(['paid']),
      open: sumByStatus(['pending', 'overdue', 'claimed']),
      overdue: sumByStatus(['overdue']),
      claimedCount: enriched.filter((p) => p._display === 'claimed').length,
    };
  }, [enriched]);

  const hasPix = !!profile?.pixKey;
  const isCurrentMonth = monthKey === getCurrentMonthKey();

  const onShareReceipt = async () => {
    if (!receiptFor) return;
    setSharingReceipt(true);
    try {
      const result = await shareReceipt({ payment: receiptFor, admin: profile });
      if (result === 'downloaded') {
        toast.success(
          'Recibo salvo no celular. Agora anexe na conversa com o responsável.',
          { duration: 6000 }
        );
      }
      if (result !== 'cancelled') setReceiptFor(null);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra gerar o recibo.');
    } finally {
      setSharingReceipt(false);
    }
  };

  const onConfirmAttach = async () => {
    if (!attachingTo || !attachFile) return;
    setActionLoading(true);
    try {
      const hash = await fileHash(attachFile);
      const url = await uploadPaymentReceipt(attachingTo.id, attachFile);
      await attachReceipt(attachingTo.id, url, hash);

      // Quando é o TIO que anexa, a decisão já está tomada: ele viu o
      // comprovante e escolheu registrá-lo. Deixar o pagamento em
      // "aguardando confirmação" depois disso seria pedir que ele
      // confirmasse a si mesmo — e o pai continuaria vendo pendência num
      // mês que o tio já considera recebido.
      if (attachingTo._display !== 'paid') {
        await confirmReceipt(
          attachingTo.id,
          attachingTo.paymentMethod || 'pix'
        );
        notifyPaymentConfirmed({
          parentUid: attachingTo.parentUid,
          paymentId: attachingTo.id,
          monthLabel: formatMonthLabel(attachingTo.month),
          amount: attachingTo.amount,
          childName: attachingTo.childName,
        });
        toast.success('Comprovante anexado e pagamento confirmado.');
      } else {
        toast.success('Comprovante anexado.');
      }

      setAttachingTo(null);
      setAttachFile(null);
    } catch (err) {
      console.error(err);
      toast.error('Não deu pra anexar. Tente uma imagem menor.');
    } finally {
      setActionLoading(false);
    }
  };

  const onMethodSelected = async (method) => {
    if (!methodSheetFor) return;
    const payment = methodSheetFor;
    setActionLoading(true);
    try {
      await confirmReceipt(payment.id, method);
      notifyPaymentConfirmed({
        parentUid: payment.parentUid,
        paymentId: payment.id,
        monthLabel: formatMonthLabel(payment.month),
        amount: payment.amount,
        childName: payment.childName,
      });
      logPaymentEvent(payment.id, {
        type: PAYMENT_EVENTS.CONFIRMED,
        actorUid: user?.uid,
        actorRole: 'admin',
        note: `Recebido em ${method}`,
      });

      toast.success(`Recebimento de ${payment.childName} confirmado.`);

      // Só pra dinheiro: em PIX o banco já emitiu comprovante e o pai
      // costuma ter anexado. Oferecer recibo ali seria ruído.
      if (method === 'cash') {
        setReceiptFor({ ...payment, paymentMethod: method, paidAt: new Date() });
      }
      setMethodSheetFor(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao confirmar.');
    } finally {
      setActionLoading(false);
    }
  };

  const onUndoReceipt = async () => {
    if (!unconfirming) return;
    setActionLoading(true);
    try {
      // Passa o doc inteiro pra o service validar tempo + método.
      await undoReceipt(unconfirming.id, unconfirming);
      toast.success(`Confirmação desfeita.`);
      setUnconfirming(null);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Erro ao desfazer.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <Header
        title="Pagamentos"
        action={
          <button
            onClick={() => navigate('/tio/finance/report')}
            aria-label="Ver relatório"
            className="tap inline-flex items-center gap-1 text-primary text-xs font-semibold px-2 py-1"
          >
            <FileText size={16} />
            Relatório
          </button>
        }
      />

      <div className="p-5 space-y-5">
        {/* Seletor de mês */}
        <MonthSwitcher
          monthKey={monthKey}
          onChange={setMonthKey}
        />

        {/* Hero: recebido vs a receber */}
        <FinanceHero
          paid={totals.paid}
          open={totals.open}
          overdue={totals.overdue}
          claimedCount={totals.claimedCount}
        />

        {/* Vem LOGO depois do hero: o número do mês na tela não significa
          * nada se existe dinheiro velho parado que ele nem sabe que existe.
          * Tocar leva pro mês mais antigo em aberto — onde dá pra agir. */}
        <ArrearsBanner
          items={arrears}
          onGoToOldest={() => arrears[0]?.month && setMonthKey(arrears[0].month)}
        />

        {/* PIX banner — só se for mês corrente */}
        {isCurrentMonth && (
          <button
            type="button"
            onClick={() => navigate('/tio/pix')}
            className={`tap w-full text-left rounded-2xl p-4 flex items-center gap-3 border ${
              hasPix
                ? 'bg-card border-gray-200'
                : 'bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                hasPix ? 'bg-primary/10' : 'bg-amber-500 text-white'
              }`}
            >
              <Key size={20} className={hasPix ? 'text-primary' : ''} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-text leading-tight">
                {hasPix ? 'Chave PIX cadastrada' : 'Cadastre sua chave PIX'}
              </p>
              <p className="text-xs text-textMuted mt-0.5 truncate">
                {hasPix
                  ? `${PIX_KEY_TYPES[profile.pixKeyType]?.label || ''}: ${profile.pixKey}`
                  : 'Os pais precisam pra pagar pelo app'}
              </p>
            </div>
            <ChevronRight size={18} className="text-textMuted shrink-0" />
          </button>
        )}

        {/* O que está travando o dinheiro de entrar, em silêncio.
          * Vem ANTES da lista: não faz sentido cobrar quem já tem cobrança
          * enquanto três crianças não têm nenhuma. */}
        <BillingBlockers
          children={children}
          payments={payments}
          monthKey={monthKey}
          admin={profile}
          isCurrentMonth={isCurrentMonth}
        />

        {/* Busca por criança — responde "essa família está em dia?" */}
        <div className="relative">
          <Search
            size={17}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar criança"
            className="w-full h-12 rounded-xl border-2 border-gray-200 bg-card pl-11 pr-10 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
              className="tap absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg text-textMuted flex items-center justify-center"
            >
              <X size={17} />
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-1 -mb-1">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'claimed', label: 'Aguardando' },
            { value: 'overdue', label: 'Atrasados' },
            { value: 'pending', label: 'Pendentes' },
            { value: 'paid', label: 'Pagos' },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold tap border ${
                filter === f.value
                  ? 'bg-text text-white border-text'
                  : 'bg-card text-textMuted border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
    
        {/* Complemento, deliberadamente no fim e discreto.
          *
          * O foco desta tela é ENTRADA: quem pagou, quem não pagou, quem
          * atrasou — a pergunta que o tio responde todo dia. Despesa é a
          * conta que ele fecha uma vez por mês, então fica atrás de um
          * toque em vez de competir por espaço com a cobrança. */}
        <button
          type="button"
          onClick={() => navigate('/tio/finance/expenses')}
          className="tap w-full text-left bg-card rounded-2xl shadow-sm p-4 flex items-center gap-3 mt-2"
        >
          <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <TrendingDown size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-text leading-tight">
              Visão completa
            </p>
            <p className="text-xs text-textMuted mt-0.5">
              Lance despesas e veja quanto sobrou no mês
            </p>
          </div>
          <ChevronRight size={18} className="text-textMuted shrink-0" />
        </button>
      </div>
        ) : enriched.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum pagamento"
            description={
              isCurrentMonth
                ? 'Os pagamentos do mês são gerados quando você cadastra crianças.'
                : `Sem registros pra ${formatMonthLabel(monthKey)}.`
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="Nada por aqui"
            description="Sem pagamentos com esse filtro."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                displayStatus={payment._display}
                role="admin"
                onCharge={() => onCharge(payment)}
                onAttachReceipt={() => {
                  setAttachingTo(payment);
                  setAttachFile(null);
                }}
                action={renderAction(payment, {
                  onConfirm: () => setMethodSheetFor(payment),
                  onUndo: () => setUnconfirming(payment),
                })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sheet "Como você recebeu?" */}
      {methodSheetFor && (
        <MethodSheet
          payment={methodSheetFor}
          loading={actionLoading}
          onPick={onMethodSelected}
          onClose={() => !actionLoading && setMethodSheetFor(null)}
        />
      )}

      {/* Recibo de pagamento em dinheiro.
        * PIX tem comprovante do banco; dinheiro não tem nada. Este recibo
        * é o único papel que vai existir daquele pagamento. */}
      <ConfirmDialog
        open={!!receiptFor}
        title="Mandar o recibo pro responsável?"
        description={
          receiptFor
            ? `Pagamento em dinheiro de ${receiptFor.childName} não tem comprovante de banco. O app gera o recibo e você escolhe por onde mandar.`
            : ''
        }
        confirmLabel="Gerar e enviar"
        cancelLabel="Agora não"
        loading={sharingReceipt}
        onConfirm={onShareReceipt}
        onCancel={() => setReceiptFor(null)}
      />

      {/* Anexar comprovante que chegou por fora do app */}
      <ConfirmDialog
        open={!!attachingTo}
        title="Anexar comprovante"
        description={
          attachingTo ? (
            <>
              <span className="block text-xs mb-3">
                Comprovante de {attachingTo.childName} —{' '}
                {formatMonthLabel(attachingTo.month)}. Serve a foto do print
                que o responsável mandou.
                {attachingTo._display !== 'paid' && (
                  <span className="block mt-1 font-semibold text-text">
                    Ao anexar, o pagamento já fica confirmado e o responsável
                    é avisado.
                  </span>
                )}
              </span>
              <ReceiptPicker file={attachFile} onChange={setAttachFile} />
            </>
          ) : null
        }
        confirmLabel="Anexar"
        loading={actionLoading}
        onConfirm={onConfirmAttach}
        onCancel={() => {
          setAttachingTo(null);
          setAttachFile(null);
        }}
      />

      {/* Desfazer confirmação */}
      <ConfirmDialog
        open={!!unconfirming}
        title="Desfazer confirmação?"
        description={
          unconfirming
            ? `O pagamento de ${unconfirming.childName} volta para "Pendente". Use só se você confirmou por engano.`
            : null
        }
        confirmLabel="Sim, desfazer"
        variant="danger"
        loading={actionLoading}
        onConfirm={onUndoReceipt}
        onCancel={() => setUnconfirming(null)}
      />
    </>
  );
}

/* ─────────────── Componentes ─────────────── */

/**
 * Recebido e a receber do mês — e, dentro do a receber, QUANTO está atrasado.
 *
 * POR QUE O ATRASADO VIROU VALOR E NÃO CONTAGEM
 * O selo dizia "3 atrasados". Contagem sem valor não decide nada: R$ 900 pra
 * receber com 1 atrasado pode ser R$ 100 ou R$ 800 preso — e é exatamente
 * essa diferença que define se o motorista pega o telefone hoje. Agora o selo
 * diz o dinheiro. A contagem vive na faixa dos meses anteriores, onde a
 * pergunta é outra ("quantas famílias eu preciso cobrar?").
 *
 * "Aguardando você" continua contagem de propósito: ali não é dinheiro
 * perdido, é tarefa pendente na mão dele — e tarefa se conta.
 */
function FinanceHero({ paid, open, overdue, claimedCount }) {
  return (
    <div className="rounded-3xl overflow-hidden shadow-xl shadow-emerald-500/15">
      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white p-5 space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-white/80">
            Recebido
          </p>
          <p className="text-4xl font-bold tabular-nums leading-none mt-1">
            {formatCurrency(paid)}
          </p>
        </div>
        <div className="border-t border-white/20 pt-3">
          <p className="text-xs uppercase tracking-widest font-semibold text-white/80">
            Pra receber
          </p>
          <p className="text-2xl font-bold tabular-nums leading-none mt-1">
            {formatCurrency(open)}
          </p>
          {(overdue > 0 || claimedCount > 0) && (
            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              {overdue > 0 && (
                <span className="bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 font-semibold tabular-nums">
                  {formatCurrency(overdue)} atrasado
                </span>
              )}
              {claimedCount > 0 && (
                <span className="bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 font-semibold">
                  {claimedCount} aguardando você
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A FAIXA DA DÍVIDA VELHA — o que ficou pra trás e continua aberto.
 *
 * A tela é por competência: agosto mostra agosto. Sem esta faixa, a
 * mensalidade de julho que ninguém pagou ficava escondida em julho, e quem
 * olha só o mês corrente (todo mundo) nunca mais a via — ela desaparecia
 * exatamente por ter envelhecido.
 *
 * Mostra VALOR primeiro (é o que dói), a contagem de cobranças e desde quando
 * a coisa se arrasta. Tocar não abre explicação: leva pro mês mais antigo com
 * dívida, que é onde ele pode dar baixa ou cobrar. Faixa que informa e não
 * deixa agir é só um lembrete de mau humor.
 */
function ArrearsBanner({ items, onGoToOldest }) {
  if (!items.length) return null;

  const total = items.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const maisAntigo = items[0]?.month;
  const meses = new Set(items.map((p) => p.month)).size;

  return (
    <button
      type="button"
      onClick={onGoToOldest}
      className="tap w-full text-left rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-4 flex items-center gap-3"
    >
      <span className="w-11 h-11 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0">
        <AlertTriangle size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs uppercase tracking-widest font-semibold text-red-700/80">
          Atrasado de meses anteriores
        </span>
        <span className="block text-xl font-bold tabular-nums text-red-700 leading-tight mt-0.5">
          {formatCurrency(total)}
        </span>
        <span className="block text-xs text-red-900/70 mt-0.5">
          {items.length} cobrança{items.length > 1 ? 's' : ''}
          {' · '}
          {meses > 1
            ? `${meses} meses, desde ${formatMonthLabel(maisAntigo)}`
            : `de ${formatMonthLabel(maisAntigo)}`}
        </span>
      </span>
      <ChevronRight size={18} className="text-red-400 shrink-0" />
    </button>
  );
}

function renderAction(payment, { onConfirm, onUndo }) {
  if (payment._display === 'paid') {
    // Só mostra "Desfazer" enquanto a regra de reversão permitir.
    // Cartão nunca permite; PIX/dinheiro permitem dentro de 24h.
    const { allowed } = canUndoReceipt(payment);
    if (!allowed) return null;
    return (
      <Button size="sm" variant="ghost" fullWidth={false} onClick={onUndo}>
        Desfazer
      </Button>
    );
  }
  if (payment._display === 'claimed') {
    return (
      <Button size="sm" variant="success" fullWidth={false} onClick={onConfirm}>
        Confirmar
      </Button>
    );
  }
  return (
    <Button size="sm" fullWidth={false} onClick={onConfirm}>
      Dar baixa
    </Button>
  );
}

/* ─────────────── Sheet "Como recebeu?" ─────────────── */

function MethodSheet({ payment, loading, onPick, onClose }) {
  const claimedMethod = payment.paymentMethod; // o que o pai declarou (se houver)

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-3 pb-1 flex justify-center">
          <span className="block w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pt-2 pb-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-text leading-tight">
                Como você recebeu?
              </h2>
              <p className="text-xs text-textMuted mt-1">
                {payment.childName} · {formatCurrency(payment.amount)}
                {claimedMethod && (
                  <span className="ml-1">
                    · pai marcou:{' '}
                    {claimedMethod === 'cash' ? 'dinheiro' : 'PIX'}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="tap w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted shrink-0"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-2">
            <MethodOption
              icon={QrCode}
              title="PIX"
              subtitle="Recebido por PIX"
              gradient="from-emerald-50 to-green-100"
              iconBg="bg-emerald-600"
              onClick={() => onPick('pix')}
              disabled={loading}
            />
            <MethodOption
              icon={Banknote}
              title="Dinheiro"
              subtitle="Recebido em mãos"
              gradient="from-amber-50 to-orange-100"
              iconBg="bg-amber-600"
              onClick={() => onPick('cash')}
              disabled={loading}
            />
            <MethodOption
              icon={CreditCard}
              title="Cartão"
              subtitle="Recebido por cartão"
              gradient="from-violet-50 to-purple-100"
              iconBg="bg-violet-600"
              onClick={() => onPick('card')}
              disabled={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MethodOption({
  icon: Icon,
  title,
  subtitle,
  gradient,
  iconBg,
  onClick,
  disabled,
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`tap w-full text-left rounded-2xl p-4 flex items-center gap-3 bg-gradient-to-br ${gradient} ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      <div
        className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm ${iconBg}`}
      >
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-text leading-tight">{title}</p>
        <p className="text-xs text-textMuted mt-0.5">{subtitle}</p>
      </div>
      {!disabled && <ChevronRight size={18} className="text-textMuted" />}
    </button>
  );
}

/* ─────────────── helpers ─────────────── */

