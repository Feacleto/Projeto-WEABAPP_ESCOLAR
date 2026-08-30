import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key,
  ChevronRight,
  AlertTriangle,
  X,
  Search,
  Banknote,
  QrCode,
  CreditCard,
  Wallet,
  DollarSign,
  FileText,
  TrendingDown,
  History,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
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
import PixSheet from '../../components/payments/PixSheet';
import { shareReceipt } from '../../services/receiptImageService';
import {
  formatMonthLabel,
  formatCurrency,
  getCurrentMonthKey,
  emCentavos,
} from '../../utils/formatters';
import { PIX_KEY_TYPES } from '../../services/userService';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';

/**
 * Financeiro do Tio — dashboard mês-a-mês.
 *
 * Mudanças vs versão anterior:
 *   - Seletor de mês (12 meses pra trás navegáveis)
 *   - Pagamentos do mês corrente são gerados pelo SERVIDOR: a function
 *     `generateMonthlyPayments` roda uma vez por mês, e o botão "gerar
 *     cobranças" chama `runBillingNow` pra antecipar. O hook useAutoBilling
 *     ficou VAZIO quando isso mudou de lado — ele existia pra faturar no
 *     cliente quando o motorista abria o app, e não faz mais nada.
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
  useEffect(
    () => watchArrears(monthKey, user?.uid, setArrears),
    [monthKey, user?.uid]
  );
  const [filter, setFilter] = useState('all');

  /**
   * O MÊS VIGENTE É A TELA. O RESTO É HISTÓRICO.
   *
   * O seletor de mês ficava no topo, com setas pros dois lados, convidando a
   * passear por doze meses. Mas a operação do motorista acontece no mês
   * corrente: é nele que ele cobra, dá baixa e fecha as contas. Mês passado
   * ele consulta — pra ver quanto entrou e quem atrasou — e volta.
   *
   * Então a tela abre sempre no mês de hoje, sem seletor competindo com o
   * número que importa. Olhar pra trás virou uma decisão explícita, e
   * enquanto ele está lá a tela diz, em cima, que aquilo é histórico e como
   * voltar. Ninguém mais dá baixa achando que está no mês errado.
   */
  const isCurrentMonthView = monthKey === getCurrentMonthKey();
  const [historicoAberto, setHistoricoAberto] = useState(false);
  // A chave PIX é interrupção desta tela, não destino: abre por cima.
  const [pixOpen, setPixOpen] = useState(false);

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

  /**
   * OS DOIS NÚMEROS QUE ELE OPERA — e o terceiro que a gente tirou.
   *
   * Antes havia `open`: a soma de tudo que ainda não entrou, estampada no
   * herói como "Pra receber". É previsão, e previsão é uma pergunta que o
   * motorista não faz. Ele quer saber o que ENTROU (pra saber se fecha o mês)
   * e QUEM ESTÁ DEVENDO (pra saber a quem ligar hoje). O resto é enfeite
   * numérico que envelhece sozinho conforme o mês corre.
   *
   * `naoVencido` fica calculado mas não vai pra tela: é o que faz a lista
   * "Todos" continuar tendo linhas no começo do mês.
   */
  const totals = useMemo(() => {
    const soma = (lista) =>
      emCentavos(lista.reduce((acc, p) => acc + (Number(p.amount) || 0), 0));
    const pagos = enriched.filter((p) => p._display === 'paid');
    const atrasados = enriched.filter((p) => p._display === 'overdue');
    return {
      paid: soma(pagos),
      pagos,
      overdue: soma(atrasados),
      atrasados,
      claimedCount: enriched.filter((p) => p._display === 'claimed').length,
    };
  }, [enriched]);

  /**
   * QUEM DEVE, VENHA DE ONDE VIER.
   *
   * Existiam dois cartões vermelhos: o atraso DESTE mês, dentro do herói, e
   * "atrasado de meses anteriores", num banner separado logo abaixo. Dois
   * lugares pra mesma pergunta — e o tio tinha que somar de cabeça pra saber
   * quanto tem na rua.
   *
   * A dívida não se importa com o mês da tela. Um só bloco, com todo mundo
   * que está devendo e o total que isso dá.
   */
  const todosAtrasados = useMemo(() => {
    if (!isCurrentMonthView) return totals.atrasados;
    return [...totals.atrasados, ...arrears];
  }, [totals.atrasados, arrears, isCurrentMonthView]);

  const totalAtrasado = useMemo(
    () => emCentavos(todosAtrasados.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)),
    [todosAtrasados]
  );

  const hasPix = !!profile?.pixKey;

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
        {/* Só aparece quando ele SAIU do mês vigente. Barra de "você não está
          * em casa", com a porta de volta do lado. */}
        {!isCurrentMonthView && (
          <div className="flex items-center gap-3 rounded-2xl border border-warningBorder bg-warningSoft p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning text-white">
              <History size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-warningText/80">
                Histórico
              </p>
              <p className="truncate text-sm font-bold capitalize text-warningText">
                {formatMonthLabel(monthKey)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMonthKey(getCurrentMonthKey())}
              className="tap shrink-0 rounded-full bg-warning px-3 py-1.5 text-xs font-bold text-white"
            >
              Voltar pra hoje
            </button>
          </div>
        )}

        {/* Diz de que mês a tela fala antes de mostrar o número. Sem isto,
          * o valor grande no topo não tem período colado nele — e essa tela
          * agora abre sempre no mês corrente, então a pergunta "de quando é
          * isso?" nasce todo dia 1º. */}
        {isCurrentMonthView && (
          <PageHeader
            icon={Wallet}
            title="Este mês"
            subtitle="Quem já pagou, quem está devendo e quanto entrou até agora."
          />
        )}

        {/* O ÚNICO NÚMERO DO TOPO: o que entrou. */}
        <FinanceHero paid={totals.paid} monthKey={monthKey} />

        {/* Quem pagou. O valor sozinho não diz de quem ele já não precisa
          * cobrar — e é essa a leitura que ele faz depois do total. */}
        <QuemPagou pagos={totals.pagos} childById={childById} />

        {/* Quem deve. Mês vigente e meses anteriores no MESMO bloco: a
          * dívida não se importa com o mês da tela. */}
        <Atrasados
          items={todosAtrasados}
          total={totalAtrasado}
          childById={childById}
          onCharge={onCharge}
          onGoToMonth={setMonthKey}
          monthKey={monthKey}
        />

        {/* PIX banner — só se for mês corrente */}
        {isCurrentMonthView && (
          <button
            type="button"
            onClick={() => setPixOpen(true)}
            className={`tap w-full text-left rounded-2xl p-4 flex items-center gap-3 border ${
              hasPix
                ? 'bg-card border-border'
                : 'bg-gradient-to-br from-amber-50 to-orange-100 border-warningBorder'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                hasPix ? 'bg-primary/10' : 'bg-warning text-white'
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
          isCurrentMonth={isCurrentMonthView}
          onOpenPix={() => setPixOpen(true)}
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
            className="w-full h-12 rounded-xl border-2 border-border bg-card pl-11 pr-10 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-textMuted"
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
          {/* TRÊS CHIPS, NÃO CINCO.
            * "Aguardando" e "Pendentes" descreviam dinheiro que não entrou —
            * o mesmo assunto de "Atrasados", picado em três. Quem está
            * esperando baixa já aparece com o botão verde na lista de
            * "Todos"; não precisa de filtro próprio pra ser encontrado. */}
          {[
            { value: 'all', label: 'Todos' },
            { value: 'overdue', label: 'Atrasados' },
            { value: 'paid', label: 'Pagos' },
          ].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`shrink-0 h-9 px-4 rounded-full text-sm font-semibold tap border ${
                filter === f.value
                  ? 'bg-text text-white border-text'
                  : 'bg-card text-textMuted border-border'
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
          </div>
        ) : enriched.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum pagamento"
            description={
              isCurrentMonthView
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

        {/* ── o fim da tela: o que ele consulta, não o que ele opera ── */}

        {/* A PORTA DO HISTÓRICO, no rodapé e não no topo.
          *
          * O seletor de mês vivia acima do herói, com setas pros dois lados
          * competindo com o número que importa. Mas passear por meses não é
          * o trabalho dele — é consulta, e consulta mora no fim. Aqui
          * embaixo ele não atrapalha quem abriu a tela pra cobrar alguém. */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setHistoricoAberto((v) => !v)}
            aria-expanded={historicoAberto}
            className="tap flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <History size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold leading-tight text-text">
                Meses anteriores
              </p>
              <p className="mt-0.5 text-xs text-textMuted">
                Quanto entrou e quem atrasou
              </p>
            </div>
            <ChevronRight
              size={18}
              className={`shrink-0 text-textMuted transition-transform ${
                historicoAberto ? 'rotate-90' : ''
              }`}
            />
          </button>

          {historicoAberto && (
            <div className="mt-2">
              <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} />
            </div>
          )}
        </div>

        {/* Complemento, deliberadamente no fim e discreto.
          *
          * O foco desta tela é ENTRADA: quem pagou, quem não pagou, quem
          * atrasou — a pergunta que o tio responde todo dia. Despesa é a
          * conta que ele fecha uma vez por mês, então fica atrás de um
          * toque em vez de competir por espaço com a cobrança.
          *
          * Estava aninhado DENTRO do bloco de carregamento: aparecia no meio
          * do esqueleto e sumia quando a lista chegava. Na prática, não havia
          * caminho pras despesas a partir daqui. */}
        <button
          type="button"
          onClick={() => navigate('/tio/finance/expenses')}
          className="tap mt-2 flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <TrendingDown size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-tight text-text">Visão completa</p>
            <p className="mt-0.5 text-xs text-textMuted">
              Lance despesas e veja quanto sobrou no mês
            </p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-textMuted" />
        </button>
      </div>

      <PixSheet open={pixOpen} onClose={() => setPixOpen(false)} />

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
/**
 * O HERÓI: UM NÚMERO SÓ.
 *
 * Antes eram dois — "Recebido" grande e "Pra receber" logo abaixo, com
 * pastilhas de atrasado e de aguardando penduradas. Quatro números pra
 * responder uma pergunta que o motorista faz em um: quanto entrou.
 *
 * "Pra receber" era o pior deles. É previsão, e previsão no dia 3 do mês é
 * quase o faturamento inteiro — um número grande, verde, que não é dinheiro.
 * Ele fechava o mês com a sensação de ter recebido menos do que o painel
 * prometeu, todo mês, porque o painel prometia o bruto.
 *
 * Quem está devendo não sumiu: ganhou bloco próprio, embaixo, com nome e
 * botão de cobrar. Saiu de pastilha decorativa e virou trabalho.
 */
function FinanceHero({ paid, monthKey }) {
  return (
    <div className="overflow-hidden rounded-3xl shadow-focus">
      <div className="bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
          Recebido
        </p>
        <p className="mt-1 text-4xl font-bold leading-none tabular-nums">
          {formatCurrency(paid)}
        </p>
        <p className="mt-2 text-xs capitalize text-white/70">
          {formatMonthLabel(monthKey)}
        </p>
      </div>
    </div>
  );
}

/**
 * QUEM JÁ PAGOU — com rosto.
 *
 * O total sozinho responde "fechei o mês?". Não responde "de quem eu ainda
 * preciso cobrar?", que é a pergunta seguinte e a que gera ação. Ele
 * respondia isso varrendo a lista inteira procurando os verdes.
 *
 * Rosto e não texto porque ele conhece as crianças de vista, não de nome
 * completo — e porque uma fileira de rostos se lê num relance, enquanto uma
 * lista de nomes se lê linha por linha.
 *
 * Fica quieto quando ninguém pagou ainda: bloco vazio no começo do mês é
 * lembrete diário de que ninguém pagou, e isso não é informação, é humor.
 */
function QuemPagou({ pagos, childById }) {
  if (!pagos.length) return null;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-text">Quem já pagou</p>
        <p className="shrink-0 text-xs font-semibold tabular-nums text-textMuted">
          {pagos.length}
        </p>
      </div>

      {/* Rola de lado em vez de quebrar em várias linhas: com vinte crianças
        * pagas, uma grade empurraria o bloco de atrasados pra fora da tela —
        * e é o de atrasados que tem trabalho dentro. */}
      <div className="scrollbar-hide -mx-4 mt-3 flex gap-3 overflow-x-auto px-4">
        {pagos.map((p) => {
          const child = childById.get(p.childId);
          const primeiro = String(p.childName || '').trim().split(/\s+/)[0];
          return (
            <div
              key={p.id}
              className="flex w-14 shrink-0 flex-col items-center gap-1"
            >
              <div className="relative">
                <Avatar
                  photoURL={child?.photoURL}
                  gender={child?.gender}
                  seed={p.childId}
                  kind="child"
                  size="md"
                />
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-primary text-white"
                >
                  <Check size={10} strokeWidth={3.5} />
                </span>
              </div>
              <span className="w-full truncate text-center text-[10px] font-semibold text-textMuted">
                {primeiro}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * QUEM ESTÁ DEVENDO — de qualquer mês, num bloco só.
 *
 * A dívida vinha picada em dois lugares: uma pastilha dentro do herói pro
 * atraso do mês na tela, e um banner vermelho separado pro que ficou pra
 * trás. Duas superfícies pra mesma pergunta, e nenhuma delas dizia QUEM.
 * O tio lia "R$ 450 atrasado" e ainda tinha que descer a lista pra
 * descobrir de quem cobrar.
 *
 * Aqui o valor vem com nome, e o nome vem com o botão de cobrar do lado.
 * A cobrança de meses anteriores mostra o mês, porque cobrar setembro em
 * novembro exige dizer qual mês.
 *
 * O silêncio quando ninguém deve é proposital, e é a melhor tela possível:
 * bloco verde de "tudo em dia" ocuparia o mesmo espaço pra dizer que não há
 * trabalho.
 */
function Atrasados({
  items,
  total,
  childById,
  onCharge,
  onGoToMonth,
  monthKey,
}) {
  if (!items.length) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-dangerBorder bg-dangerSoft">
      <div className="flex items-center gap-3 p-4 pb-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger text-white">
          <AlertTriangle size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-dangerText/80">
            Atrasado
          </p>
          <p className="text-2xl font-bold leading-none tabular-nums text-dangerText">
            {formatCurrency(total)}
          </p>
        </div>
        <p className="shrink-0 text-xs font-semibold text-dangerText/60">
          {items.length} cobrança{items.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-1.5 px-3 pb-3">
        {items.map((p) => {
          const child = childById.get(p.childId);
          const deOutroMes = p.month !== monthKey;
          return (
            <div
              key={p.id}
              className="flex items-center gap-2.5 rounded-xl bg-card p-2.5"
            >
              <Avatar
                photoURL={child?.photoURL}
                gender={child?.gender}
                seed={p.childId}
                kind="child"
                size="sm"
              />
              <button
                type="button"
                onClick={() => deOutroMes && onGoToMonth(p.month)}
                disabled={!deOutroMes}
                className="min-w-0 flex-1 text-left disabled:cursor-default"
              >
                <p className="truncate text-sm font-bold leading-tight text-text">
                  {p.childName || 'Criança'}
                </p>
                <p className="text-[11px] tabular-nums text-textMuted">
                  {formatCurrency(p.amount)}
                  {deOutroMes && (
                    <span className="capitalize">
                      {' '}
                      · {formatMonthLabel(p.month)}
                    </span>
                  )}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onCharge(p)}
                className="tap shrink-0 rounded-full bg-danger px-3 py-1.5 text-xs font-bold text-white"
              >
                Cobrar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderAction(payment, { onConfirm, onUndo }) {
  if (payment._display === 'paid') {
    // Só mostra "Desfazer" enquanto a regra de reversão permitir:
    // qualquer método, dentro de 24h da baixa.
    const { allowed } = canUndoReceipt(payment);
    if (!allowed) return null;
    return (
      <Button size="sm" variant="ghost" fullWidth={false} onClick={onUndo}>
        Desfazer
      </Button>
    );
  }
  if (payment._display === 'claimed') {
    // MESMO VERBO DOS OUTROS ESTADOS.
    // Era "Confirmar" aqui e "Dar baixa" logo abaixo, pra exatamente a mesma
    // operação — o tio tinha que aprender duas palavras pro mesmo botão. E
    // como 'claimed' perdeu o rótulo (virou tarefa, ver paymentVocabulary),
    // este botão passou a ser a ÚNICA coisa que diz que há algo a fazer
    // nesta linha. Ele é verde por isso.
    return (
      <Button size="sm" variant="success" fullWidth={false} onClick={onConfirm}>
        Dar baixa
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
  const { alcaProps, estilo } = useArrastarPraFechar(onClose);
  const claimedMethod = payment.paymentMethod; // o que o pai declarou (se houver)

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)', ...estilo }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...alcaProps}
          className={`pt-3 pb-1 flex justify-center ${alcaProps.className}`}
        >
          <span className="block w-10 h-1.5 rounded-full bg-borderStrong" />
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
              className="tap w-9 h-9 rounded-full bg-neutro flex items-center justify-center text-textMuted shrink-0"
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
              iconBg="bg-primary"
              onClick={() => onPick('pix')}
              disabled={loading}
            />
            <MethodOption
              icon={Banknote}
              title="Dinheiro"
              subtitle="Recebido em mãos"
              gradient="from-amber-50 to-orange-100"
              iconBg="bg-warning"
              onClick={() => onPick('cash')}
              disabled={loading}
            />
            <MethodOption
              icon={CreditCard}
              title="Cartão"
              subtitle="Na maquininha"
              gradient="from-violet-50 to-purple-100"
              iconBg="bg-escola"
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

