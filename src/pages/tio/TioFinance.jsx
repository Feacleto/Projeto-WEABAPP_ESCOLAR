import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key,
  ChevronRight,
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PaymentRow from '../../components/payments/PaymentRow';
import AguardandoVoce from '../../components/payments/AguardandoVoce';
import ResumoDoMes, { ComoEstaOMes } from '../../components/payments/ResumoDoMes';
import InteressePorCartao from '../../components/tio/InteressePorCartao';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentsByMonth } from '../../hooks/usePayments';
import { watchAlertasDeComprovante } from '../../services/alertaDeComprovanteService';
import { useChildren } from '../../hooks/useChildren';
import { buildChargeMessage } from '../../dominio/cobranca/chargeMessage';
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
import { usePerguntaDaChavePix } from '../../components/payments/PerguntaDaChavePix';
import { shareReceipt } from '../../services/receiptImageService';
import {
  formatMonthLabel,
  formatCurrency,
  getCurrentMonthKey,
  emCentavos,
} from '../../compartilhado/formatters';
import { PIX_KEY_TYPES } from '../../services/userService';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';

/**
 * Financeiro do Tio — dashboard mês-a-mês.
 *
 * A ORDEM DA TELA é a ordem das perguntas dele (design system, 03/10/2026):
 *   1. de que mês estou falando          → o seletor, no topo
 *   2. quanto entrou                     → o cartão verde
 *   3. e o resto, onde está              → a barra dos quatro estados
 *   4. o que é comigo agora              → "Aguardando você"
 *   5. de quem é cada mensalidade        → a lista, atrasadas primeiro
 *
 * Mudanças vs versões anteriores:
 *   - Seletor de mês (até a retenção de 60 meses — ver MonthSwitcher)
 *   - Pagamentos do mês corrente são gerados pelo SERVIDOR: a function
 *     `generateMonthlyPayments` roda uma vez por mês, e o botão "gerar
 *     cobranças" chama `runBillingNow` pra antecipar. O hook useAutoBilling
 *     ficou VAZIO quando isso mudou de lado — ele existia pra faturar no
 *     cliente quando o motorista abria o app, e não faz mais nada.
 *     (não tem mais botão "+" manual)
 *   - Ao "dar baixa", sheet pergunta como o tio recebeu: PIX, Dinheiro ou Cartão
 *   - O herói tem UM número grande, o Recebido — o esperado é só o
 *     denominador, pequeno, embaixo (ver ResumoDoMes)
 */
export default function TioFinance() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { perguntarPix, folhaDoPix } = usePerguntaDaChavePix();

  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const { payments, loading } = usePaymentsByMonth(monthKey);

  // O AVISO DE COMPROVANTE DUPLICADO, carregado à parte.
  //
  // ⚠️ Ele já foi um campo do próprio pagamento, e a RESPONSÁVEL lê aquele
  // documento — a tela escondia por papel, e esconder na tela não esconde o
  // dado. Hoje mora em `alertasDeComprovante`, que só o motorista e o dono
  // leem, e por isso chega por uma assinatura separada, nesta tela e não no
  // cartão compartilhado.
  const [alertas, setAlertas] = useState({});
  useEffect(() => {
    if (!user?.uid) return undefined;
    return watchAlertasDeComprovante(user.uid, setAlertas);
  }, [user?.uid]);

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
   * A operação do motorista acontece no mês corrente: é nele que ele cobra,
   * dá baixa e fecha as contas. Mês passado ele consulta — pra ver quanto
   * entrou e quem atrasou — e volta. Por isso a tela abre sempre no mês de
   * hoje.
   *
   * O seletor VOLTOU para o topo (design system aprovado, 03/10/2026), e o
   * motivo de ele ter descido continua de pé: ninguém pode dar baixa achando
   * que está no mês errado. Quem guarda isso agora é o nome do mês no próprio
   * seletor, repetido no cartão verde ("Recebido em setembro"), e a faixa de
   * histórico com a porta de volta logo embaixo quando ele sai do mês vigente.
   */
  const isCurrentMonthView = monthKey === getCurrentMonthKey();
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

  /**
   * A LISTA COMEÇA POR QUEM DÁ TRABALHO: atrasada, avisou que pagou,
   * pendente, paga — e, dentro de cada uma, pelo vencimento. Na ordem do
   * banco, a família que deve desde o dia 1 podia estar na décima linha, e o
   * motorista descia a lista inteira procurando vermelho.
   *
   * "Faltam" junta os três estados que não são dinheiro na mão. O filtro de
   * "Atrasados" saiu: a lista já os põe no topo, e a pergunta que ele faz ao
   * tocar num filtro é "quem ainda não pagou?", não "quem venceu?".
   */
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const ordem = { overdue: 0, claimed: 1, pending: 2, paid: 3 };
    const vence = (p) => {
      const d = p.dueDate?.toDate ? p.dueDate.toDate() : new Date(p.dueDate || 0);
      return Number.isNaN(d.getTime()) ? 0 : d.getTime();
    };
    return enriched
      .filter((p) => {
        if (filter === 'paid' && p._display !== 'paid') return false;
        if (filter === 'open' && p._display === 'paid') return false;
        if (!term) return true;
        return String(p.childName || '').toLowerCase().includes(term);
      })
      .sort(
        (a, b) =>
          (ordem[a._display] ?? 9) - (ordem[b._display] ?? 9) ||
          vence(a) - vence(b) ||
          String(a.childName || '').localeCompare(String(b.childName || ''), 'pt-BR')
      );
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
    if (!child?.parentPhone) {
      toast.error('Telefone do responsável não cadastrado na ficha.');
      return;
    }
    // SEM CHAVE, A COBRANÇA SAI SEM PRA ONDE PAGAR — então a pergunta vem
    // aqui, no momento em que a falta custa. Ver `PerguntaDaChavePix`.
    perguntarPix({
      motivo: 'cobrar',
      texto: `A mensagem de cobrança de ${payment.childName} vai sem chave PIX — a família não vai ter pra onde mandar o dinheiro.`,
      depois: (chave) => enviarCobranca(payment, chave?.pixKey || profile?.pixKey),
    });
  };

  const enviarCobranca = (payment, pixKey) => {
    const child = childById.get(payment.childId);
    const phone = child?.parentPhone;
    const digits = String(phone).replace(/\D/g, '');
    const e164 = digits.startsWith('55') ? digits : `55${digits}`;
    const text = buildChargeMessage({
      payment,
      displayStatus: payment._display,
      pixKey,
      driverName: profile?.companyName || profile?.name,
    });
    window.open(
      `https://wa.me/${e164}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  /**
   * O MÊS EM QUATRO ESTADOS — quantidade e valor de cada um.
   *
   * O número grande continua sendo o que ENTROU. O total esperado volta só
   * como denominador ("de R$ X esperados"), e os outros três estados vão para
   * a barra com o valor de cada um: "falta R$ 1.140" sozinho não diz se é
   * conferência, calendário ou cobrança, e são três trabalhos diferentes.
   *
   * Soma em centavos (`emCentavos`) porque 0,1 + 0,2 não é 0,3, e o
   * "Mês fechado" depende de a soma das pagas bater com a esperada.
   */
  const totals = useMemo(() => {
    const contagem = { paid: 0, claimed: 0, pending: 0, overdue: 0 };
    const soma = { paid: 0, claimed: 0, pending: 0, overdue: 0 };
    for (const p of enriched) {
      const k = p._display in contagem ? p._display : 'pending';
      contagem[k] += 1;
      soma[k] += Number(p.amount) || 0;
    }
    for (const k of Object.keys(soma)) soma[k] = emCentavos(soma[k]);
    const esperado = emCentavos(enriched.reduce((acc, p) => acc + (Number(p.amount) || 0), 0));
    return {
      contagem,
      soma,
      paid: soma.paid,
      esperado,
      avisaram: enriched.filter((p) => p._display === 'claimed'),
    };
  }, [enriched]);

  /**
   * O QUE FICOU DE MESES ANTERIORES.
   *
   * O atraso DESTE mês está na lista, no topo, com nome, valor e o atalho do
   * WhatsApp — a lista começa por ele. O que a lista do mês não alcança é a
   * dívida que ficou pra trás, e ela não se importa com o mês da tela: por
   * isso tem bloco próprio, com o total do que está na rua.
   */
  const totalAnteriores = useMemo(
    () => emCentavos(arrears.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)),
    [arrears]
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
      // ⚠️ JÁ HAVIA UM COMPROVANTE? Então isto é SUBSTITUIÇÃO, e a diferença
      // não é semântica: `attachReceipt` sobrescreve `receiptURL`, e o que
      // estava lá costuma ser o print que a FAMÍLIA enviou. Trocar a prova de
      // outra pessoa sem deixar rastro é o cenário que a trilha append-only
      // existe para impedir — e este caminho não gravava evento nenhum, nem
      // de anexo nem de troca.
      const substituindo = Boolean(attachingTo.receiptURL);
      const url = await uploadPaymentReceipt(attachingTo.id, attachFile);
      await attachReceipt(attachingTo.id, url, hash);

      logPaymentEvent(attachingTo.id, {
        type: substituindo
          ? PAYMENT_EVENTS.RECEIPT_REPLACED
          : PAYMENT_EVENTS.RECEIPT_ATTACHED,
        actorUid: user?.uid,
        actorRole: 'admin',
      });

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

      // Desfazer a baixa é o gesto mais sensível dos dois lados: o mês volta
      // a cobrar de quem já tinha sido dado como pago. `undoReceipt` já
      // preserva `claimedAt` — o que faltava era registrar QUEM desfez e
      // QUANDO, que é a metade da história que a família não vê acontecer.
      logPaymentEvent(unconfirming.id, {
        type: PAYMENT_EVENTS.REVERTED,
        actorUid: user?.uid,
        actorRole: 'admin',
      });

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
        title="Financeiro"
        action={
          <button
            onClick={() => navigate('/tio/finance/report')}
            aria-label="Ver relatório"
            className="tap inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary"
          >
            <FileText size={18} />
            Relatório
          </button>
        }
      />

      <div className="space-y-4 p-4">
        {/* 1. De que mês a tela fala — antes de qualquer número. */}
        <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} />

        {/* Só aparece quando ele SAIU do mês vigente: a faixa de "você não
          * está em casa", com a porta de volta do lado. Com 60 meses para
          * trás, voltar seta por seta seria castigo. */}
        {!isCurrentMonthView && (
          <div className="flex items-center gap-3 rounded-2xl border border-warningBorder bg-warningSoft p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warningChip text-warningText">
              <History size={18} />
            </span>
            <p className="min-w-0 flex-1 text-sm font-semibold text-warningText">
              Você está vendo um mês que já passou.
            </p>
            <button
              type="button"
              onClick={() => setMonthKey(getCurrentMonthKey())}
              className="tap h-10 shrink-0 rounded-full border border-warningBorder bg-card px-3.5 text-sm font-bold text-warningText"
            >
              Voltar pra hoje
            </button>
          </div>
        )}

        {/* 2. O ÚNICO NÚMERO GRANDE: o que entrou. */}
        <ResumoDoMes
          monthKey={monthKey}
          recebido={totals.paid}
          esperado={totals.esperado}
          quantidade={enriched.length}
          pagas={totals.contagem.paid}
        />

        {/* 3. E o resto, onde está. */}
        <ComoEstaOMes
          monthKey={monthKey}
          contagem={totals.contagem}
          soma={totals.soma}
        />

        {/* 4. O que espera uma decisão dele. */}
        <AguardandoVoce
          pagamentos={totals.avisaram}
          alertas={alertas}
          onDarBaixa={(p) => setMethodSheetFor(p)}
          onAnexar={(p) => {
            setAttachingTo(p);
            setAttachFile(null);
          }}
        />

        {/* A dívida que ficou pra trás, com nome e valor. Só no mês vigente:
          * olhando setembro, "o que ficou de antes de setembro" é outra
          * pergunta, e o mês na tela já mostra os atrasados dele. */}
        {isCurrentMonthView && arrears.length > 0 && (
          <section className="overflow-hidden rounded-2xl bg-card shadow-rest">
            <div className="flex items-baseline justify-between gap-3 px-4 pb-1 pt-4">
              <p className="rotulo">Ficou de meses anteriores</p>
              <p className="whitespace-nowrap font-bold tabular-nums text-text">
                {formatCurrency(totalAnteriores)}
              </p>
            </div>
            {arrears.map((p, i) => (
              <PaymentRow
                key={p.id}
                variant="linha"
                comDivisor={i > 0}
                mostrarMes
                payment={p}
                displayStatus={computeDisplayStatus(p)}
                role="admin"
                alertaDeDuplicata={alertas[p.id] || null}
                onCharge={() => onCharge({ ...p, _display: computeDisplayStatus(p) })}
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    fullWidth={false}
                    onClick={() => setMonthKey(p.month)}
                  >
                    Abrir o mês
                  </Button>
                }
              />
            ))}
          </section>
        )}

        {/* Sem chave PIX, a cobrança sai sem pra onde pagar — é aviso, e
          * aviso fica em cima. Com chave, a linha desce para o fim da tela,
          * junto do que ele consulta. */}
        {isCurrentMonthView && !hasPix && (
          <PixLinha hasPix={false} profile={profile} onOpen={() => setPixOpen(true)} />
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

        {/* 5. A lista. Filtro em pílula: três opções de largura igual, e a
          * pílula verde desliza para a escolhida. */}
        {enriched.length > 0 && (
          <div
            role="tablist"
            aria-label="Filtrar mensalidades"
            className="relative grid grid-cols-3 rounded-full border border-border bg-card p-1"
          >
            <span
              aria-hidden
              className="absolute bottom-1 left-1 top-1 w-[calc((100%-8px)/3)] rounded-full bg-primary transition-transform duration-entrada ease-freio"
              style={{
                transform: `translateX(${FILTROS.findIndex((f) => f.value === filter) * 100}%)`,
              }}
            />
            {FILTROS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={`relative z-[1] h-10 rounded-full text-sm font-semibold transition-colors duration-estado ${
                  filter === f.value ? 'text-white' : 'text-textMuted'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Busca por criança — responde "essa família está em dia?". A
          * pergunta que o tio mais faz ao financeiro não é "quanto entrou",
          * é "a família do Miguel pagou?". */}
        {enriched.length > 0 && (
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-textMuted"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Procurar criança"
              className="h-12 w-full rounded-xl border-2 border-border bg-card pl-11 pr-10 text-base text-text placeholder:text-textMuted focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="tap absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-textMuted"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

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
            description={
              filter === 'open' && !search
                ? 'Ninguém faltando neste mês.'
                : 'Sem pagamentos com esse filtro.'
            }
          />
        ) : (
          /* A ÂNCORA É A LISTA, não o botão de confirmar: o botão só existe
             na linha de quem avisou que pagou, e o tutorial não pode
             depender de haver uma. E ela é iluminada, nunca tocada — o
             toque daria baixa em dinheiro. */
          <div
            data-tour="lista-pagamentos"
            className="overflow-hidden rounded-2xl bg-card shadow-rest"
          >
            {filtered.map((payment, i) => (
              <PaymentRow
                key={payment.id}
                variant="linha"
                comDivisor={i > 0}
                payment={payment}
                displayStatus={payment._display}
                role="admin"
                alertaDeDuplicata={alertas[payment.id] || null}
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
            {/* O total do que está na lista, no fim dela — o número que
              * fecha a conta de quem acabou de descer linha por linha. */}
            <div className="flex items-center justify-between gap-3 bg-surface px-4 py-3 text-sm font-semibold text-textMuted">
              <span>
                {filtered.length} mensalidade{filtered.length > 1 ? 's' : ''}
              </span>
              <span className="font-bold tabular-nums text-text">
                {formatCurrency(
                  emCentavos(filtered.reduce((acc, p) => acc + (Number(p.amount) || 0), 0))
                )}
              </span>
            </div>
          </div>
        )}

        {/* ── o fim da tela: o que ele consulta, não o que ele opera ── */}

        {isCurrentMonthView && hasPix && (
          <PixLinha hasPix profile={profile} onOpen={() => setPixOpen(true)} />
        )}

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
          className="tap flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-rest"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutro text-text">
            <TrendingDown size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold leading-tight text-text">Visão completa</p>
            <p className="mt-0.5 text-sm text-textMuted">
              Lance despesas e veja quanto sobrou no mês
            </p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-textMuted" />
        </button>

        {/* A PESQUISA DO CARTÃO, no fim e sem prometer nada.
          *
          * Ela mora AQUI porque é aqui que a pergunta já está na cabeça de quem
          * está lendo — ele acabou de olhar quem pagou e quem não pagou. E ela
          * NÃO é modal: interromper a operação de alguém para fazer pesquisa é
          * cobrar atenção por um benefício que ainda não existe.
          *
          * O texto não tem data e não diz "em breve". Prometer prazo para um
          * autônomo e não cumprir custa a confiança que é a visão da empresa —
          * `docs/negocio.md` é explícito. */}
        <div className="pt-2">
          <InteressePorCartao />
        </div>
      </div>

      <PixSheet open={pixOpen} onClose={() => setPixOpen(false)} />
      {folhaDoPix}

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

/** Os três filtros da lista. "Faltam" = tudo que não é dinheiro na mão. */
const FILTROS = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Faltam' },
  { value: 'paid', label: 'Pagas' },
];

/**
 * A chave PIX numa linha. Sem chave ela é AVISO (âmbar, no alto da tela);
 * com chave é consulta (branca, no fim). A chave é interrupção desta tela,
 * não destino: o toque abre a folha por cima.
 */
function PixLinha({ hasPix, profile, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`tap flex w-full items-center gap-3 rounded-2xl p-4 text-left ${
        hasPix ? 'bg-card shadow-rest' : 'border border-warningBorder bg-warningSoft'
      }`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          hasPix ? 'bg-primaryChip text-primary' : 'bg-warningChip text-warningText'
        }`}
      >
        <Key size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold leading-tight text-text">
          {hasPix ? 'Chave PIX cadastrada' : 'Cadastre sua chave PIX'}
        </p>
        <p className="mt-0.5 truncate text-sm text-textMuted">
          {hasPix
            ? `${PIX_KEY_TYPES[profile.pixKeyType]?.label || ''}: ${profile.pixKey}`
            : 'Os pais precisam pra pagar pelo app'}
        </p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-textMuted" />
    </button>
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
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-night/45"
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
              onClick={() => onPick('pix')}
              disabled={loading}
            />
            <MethodOption
              icon={Banknote}
              title="Dinheiro"
              subtitle="Recebido em mãos"
              onClick={() => onPick('cash')}
              disabled={loading}
            />
            <MethodOption
              icon={CreditCard}
              title="Cartão"
              subtitle="Na maquininha"
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
  onClick,
  disabled,
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      // A OPÇÃO DO DESIGN SYSTEM: branca, borda de 2px, ícone na caixinha
      // verde. Cada forma de pagamento tinha uma cor (Dinheiro âmbar, Cartão
      // violeta), e as duas cores têm dono: âmbar é aviso, violeta é escola.
      className={`tap w-full text-left rounded-xl p-4 flex items-center gap-3 bg-card border-2 border-border ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      <div
        className="w-11 h-11 rounded-xl bg-primaryChip text-primary flex items-center justify-center shrink-0"
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

