import { useEffect, useState, useMemo, useRef } from 'react';
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
  History,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Minus,
  TriangleAlert,
  Receipt,
  Users,
  Download,
  MessageCircle,
  School,
  Baby,
  Bus,
  ClipboardList,
} from 'lucide-react';
import IconePix from '../../components/common/IconePix';
import toast from 'react-hot-toast';
import Header from '../../components/layout/Header';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PaymentRow from '../../components/payments/PaymentRow';
import AguardandoVoce from '../../components/payments/AguardandoVoce';
import { ComoEstaOMes } from '../../components/payments/ResumoDoMes';
import { nomeDoMes } from '../../components/payments/estadoDaMensalidade';
import BotoesDoTopoDoFinanceiro from '../../components/financeiro/BotoesDoTopoDoFinanceiro';
import FolhaDeDespesa from '../../components/financeiro/FolhaDeDespesa';
import InteressePorCartao from '../../components/tio/InteressePorCartao';
import BlocoSuaPerua from '../../components/financeiro/BlocoSuaPerua';
import PlanosFinanceiros from '../../components/financeiro/PlanosFinanceiros';
import ControleDeRota from '../../components/route/ControleDeRota';
import { useViagemDoDia } from '../../hooks/useViagemDoDia';
import { saidaDaViagem } from '../../dominio/rota/focoDaViagem.js';
import { useAuth } from '../../hooks/useAuth';
import { usePaymentsByMonth } from '../../hooks/usePayments';
import { watchAlertasDeComprovante } from '../../services/alertaDeComprovanteService';
import { useTurmaInteira } from '../../hooks/useTurmaInteira';
import { useDespesasDoMes } from '../../hooks/useDespesas';
import { useValoresVisiveis, VALOR_ESCONDIDO } from '../../hooks/useValoresVisiveis';
import { useCobrancaLigada } from '../../hooks/useCobrancaLigada';
import { useFaturaPlataforma } from '../../hooks/useFaturaPlataforma';
import { EXPENSE_CATEGORIES, sumExpenses } from '../../services/expensesService';
import { montarExtrato } from '../../dominio/cobranca/extratoDoMes.js';
import { resumoDaTurma, frasesDoMovimento } from '../../dominio/identidade/movimentoDaTurma.js';
import { diasDeAtraso } from '../../dominio/associacao/contaAtiva.js';
import { faturaGratisDoMes } from '../../dominio/associacao/faturaGratis.js';
import { buildChargeMessage } from '../../dominio/cobranca/chargeMessage';
import {
  abaInicialDoCaixa,
  botoesDaMensalidade,
  rotuloDeCobrarAtrasados,
} from '../../dominio/cobranca/caixaDoMes.js';
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
  diasDeCalendario,
} from '../../compartilhado/formatters';
import { PIX_KEY_TYPES } from '../../services/userService';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';

/**
 * Financeiro do Tio — O CAIXA, mês a mês (03/10/2026, protótipo aprovado
 * pelo dono: o Financeiro protegido por senha, lido como o app de um banco).
 *
 * A ORDEM DA TELA é a ordem das perguntas dele (revista em 03/10/2026, na
 * auditoria de leitura em Z: o NÚMERO do momento vem antes dos botões):
 *   1. de que mês estou falando          → o seletor, no topo
 *   2. quanto sobrou                     → o SALDO de {mês}: o que entrou
 *                                          menos o que saiu
 *   3. quem está me devendo              → o cartão âmbar dos atrasados (só
 *                                          quando há), e a linha do que falta
 *                                          receber no mês
 *   4. o que eu faço daqui               → três atalhos: mensalidades,
 *                                          lançar despesa, chave PIX
 *   5. o que é comigo agora              → "Aguardando você", os atrasados
 *                                          de meses anteriores
 *   6. o dia a dia do dinheiro           → Extrato (entrou e saiu, por dia)
 *                                          ou Mensalidades (a lista de sempre)
 *   7. e o resto do negócio              → Sua perua e as três portas:
 *                                          despesas, turma e contratos, e o
 *                                          plano da plataforma
 *
 * ⚠️ RECEBER O DINHEIRO VEM PRIMEIRO (04/10/2026, item 13). Com mensalidade
 * em aberto o caixa abre na aba MENSALIDADES (`abaInicialDoCaixa`), o cartão
 * âmbar ganhou "Cobrar os N atrasados" (leva à lista filtrada; a cobrança
 * continua uma família por vez, pelo WhatsApp de cada linha — nunca em
 * massa), e Sua perua e as portas desceram para depois da lista.
 *
 * UM NOME SÓ: a tela é "Financeiro" (rodapé e cabeçalho). "Meu caixa" e
 * "Caixa de outubro" eram o terceiro e o quarto nome da mesma coisa.
 *
 * ⚠️ O SALDO É SÓ DO CAIXA DAS FAMÍLIAS: mensalidade paga menos despesa
 * lançada. A taxa da plataforma (`faturasParceiro`) não entra nele nem no
 * extrato — os dois dinheiros não se somam, e o plano tem porta própria.
 *
 * O cartão verde do Recebido (`ResumoDoMes`) saiu: o saldo responde a mesma
 * pergunta com a saída do lado. A barra dos quatro estados (`ComoEstaOMes`)
 * continua, no alto da aba Mensalidades, que é onde ela diz o que cobrar.
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
   * seletor, repetido no cartão do saldo ("Saldo de setembro"), e a faixa de
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
  //
  // A turma INTEIRA (com quem saiu) alimenta a porta "Turma e contratos"; as
  // ativas são as mesmas de `useChildren`, sem uma segunda escuta.
  const { criancas: turmaInteira } = useTurmaInteira();
  const children = useMemo(
    () => turmaInteira.filter((c) => c.active === true),
    [turmaInteira]
  );

  // O CAIXA: o que saiu no mês, e o olho que esconde os valores.
  const despesasDoMes = useDespesasDoMes(monthKey);
  const { visiveis, alternar: alternarValores } = useValoresVisiveis();
  const reais = (v) => (visiveis ? formatCurrency(v) : VALOR_ESCONDIDO);
  const [despesaAberta, setDespesaAberta] = useState(false);

  // Extrato ou Mensalidades. A aba de abertura é DERIVADA do mês (ver
  // `abaInicialDoCaixa`) até ele tocar numa: a partir daí vale a escolha dele.
  // Derivar, e não gravar num efeito, é o que deixa a lista que chega depois
  // do primeiro desenho ainda decidir a aba.
  const [abaEscolhida, setAba] = useState(null);
  const abasRef = useRef(null);
  // ⚠️ A CENTRAL DO MOTORISTA TEM QUATRO ABAS, E ABRE SEMPRE EM TURMA
  // (04/10/2026, simulação "Rota e Central" aprovada pelo dono). Elas são
  // ESTADO, nunca rota: a tranca do Financeiro é por CAMINHO, e uma aba fora
  // de `/tio/finance` pediria a senha de novo a cada troca (aviso da QA).
  // "Extrato | Mensalidades" continua, DENTRO da aba Mensalidades.
  const [secao, setSecao] = useState('turma');
  const irParaAba = (qual, filtro) => {
    setSecao('mensalidades');
    setAba(qual);
    if (filtro) setFilter(filtro);
    abasRef.current?.scrollIntoView({ block: 'start' });
  };

  // O PLANO DA PLATAFORMA só aparece com a cobrança ligada — desligada, não
  // há plano a mostrar, e a porta seria uma promessa de cobrança que não
  // existe. A fatura só é escutada nesse caso.
  const cobranca = useCobrancaLigada();
  const { fatura: faturaEmAberto } = useFaturaPlataforma(cobranca === true ? user?.uid : null);

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
   * "Faltam" junta os três estados que não são dinheiro na mão. A PÍLULA de
   * "Atrasados" continua fora: a lista já os põe no topo, e a pergunta que ele
   * faz ao tocar num filtro é "quem ainda não pagou?", não "quem venceu?".
   *
   * ⚠️ MAS O FILTRO 'overdue' EXISTE, sem pílula: é o destino do cartão âmbar
   * "N atrasadas" do alto da tela. Cartão que diz "2 atrasadas" e abre uma
   * lista de nove (as pendentes juntas) obriga a contar de novo o que ele
   * acabou de ler. Ligado, a lista mostra uma faixa "Só as atrasadas" com
   * "Ver todas" — a saída fica escrita, não escondida numa quarta pílula.
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
        if (filter === 'overdue' && p._display !== 'overdue') return false;
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

  /**
   * O SALDO DO CAIXA: o que entrou (mensalidade PAGA do mês) menos o que saiu
   * (despesa lançada no mês). Em centavos, pelo mesmo motivo do `totals`.
   * Enquanto as despesas carregam, saiu é `null` e o saldo não aparece — um
   * saldo sem a saída seria o recebido fingindo ser lucro.
   */
  const saiu = despesasDoMes === null ? null : sumExpenses(despesasDoMes);
  const saldo = saiu === null ? null : emCentavos(totals.paid - saiu);
  const faltaReceber = emCentavos(totals.esperado - totals.paid);
  const quantasFaltam =
    totals.contagem.claimed + totals.contagem.pending + totals.contagem.overdue;
  const aba = abaEscolhida ?? abaInicialDoCaixa({ quantasFaltam });

  // A MAIS ANTIGA das atrasadas do mês na tela, em dias: é o número que diz
  // se a conversa é um lembrete ou uma cobrança séria.
  const diasDaMaisAntiga = useMemo(() => {
    let maior = null;
    for (const p of enriched) {
      if (p._display !== 'overdue') continue;
      const dias = diasDeCalendario(p.dueDate, new Date());
      if (dias !== null && (maior === null || dias > maior)) maior = dias;
    }
    return maior;
  }, [enriched]);

  const extrato = useMemo(
    () =>
      montarExtrato({
        pagamentos: enriched,
        despesas: despesasDoMes || [],
        rotulos: ROTULOS_DO_EXTRATO,
        hoje: new Date(),
      }),
    [enriched, despesasDoMes]
  );

  const turma = useMemo(
    () => resumoDaTurma({ criancas: turmaInteira, mes: monthKey }),
    [turmaInteira, monthKey]
  );
  const frasesDaTurma = frasesDoMovimento(turma);

  const plano = descreverPlano(profile, faturaEmAberto);
  const indiceDoFiltro = FILTROS.findIndex((f) => f.value === filter);
  const mes = nomeDoMes(monthKey);

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

  // O "Iniciar a rota" do pé da Central — a mesma conta de "Minha rota".
  const viagem = useViagemDoDia();
  const iniciarEAbrir = () => {
    viagem.publicarOrdem();
    navigate('/tio/route/now');
  };

  return (
    <>
      {/* O cadeado e os ajustes da senha moram no canto do cabeçalho. O
        * "Relatório" saiu daqui: virou "Ver relatório de 12 meses", no fim do
        * extrato, que é onde a pergunta "quero isso no papel" aparece. */}
      <Header title="Central" action={<BotoesDoTopoDoFinanceiro />} />

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
            <p className="min-w-0 flex-1 text-base font-semibold text-warningText">
              Mês passado
            </p>
            <button
              type="button"
              onClick={() => setMonthKey(getCurrentMonthKey())}
              className="tap h-12 shrink-0 rounded-full border border-warningBorder bg-card px-4 text-base font-bold text-warningText"
            >
              Ir para hoje
            </button>
          </div>
        )}

        {/* 2. O SALDO, logo depois do mês: é o número que ele veio ver. Um
          * número grande só, e ele é o que sobrou. O "Esconder" é do aparelho
          * (ver useValoresVisiveis): quem abre o Financeiro com gente do lado.
          * Ele vai ESCRITO — o olho sozinho não dizia se mostrava ou escondia. */}
        {/* ⚠️ NA COR VIVA DA MARCA desde 04/10/2026 (aprovado pelo dono), com
          * a letra que lê nela. O saldo NEGATIVO volta ao cartão branco: o
          * vermelho dele é significado, e vermelho sobre a cor de um logo
          * laranja não se lê. */}
        <section
          className={`flex flex-col gap-1.5 rounded-3xl p-5 shadow-rest ${
            saldo !== null && saldo < 0 ? 'bg-card' : 'bg-gradient-to-br from-marca to-marcaEscuro text-naMarca'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className={`text-base font-semibold ${saldo !== null && saldo < 0 ? 'text-textBody' : 'text-naMarca opacity-90'}`}>
              Saldo de {mes}
            </h2>
            <button
              type="button"
              onClick={alternarValores}
              aria-pressed={!visiveis}
              className={`tap -mr-2 flex h-12 shrink-0 items-center gap-2 rounded-xl px-3 text-base font-bold ${
                saldo !== null && saldo < 0 ? 'text-primary' : 'text-naMarca'
              }`}
            >
              {visiveis ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
              {visiveis ? 'Esconder' : 'Mostrar'}
            </button>
          </div>
          {saldo === null ? (
            <Skeleton className="h-10 w-44" />
          ) : (
            <span
              className={`font-display text-4xl font-extrabold leading-none tabular-nums ${
                saldo < 0 ? 'text-dangerText' : 'text-naMarca'
              }`}
            >
              {reais(saldo)}
            </span>
          )}
          <span
            className={`mt-1 text-base tabular-nums ${
              saldo !== null && saldo < 0 ? 'text-textBody' : 'text-naMarca opacity-90'
            }`}
          >
            Entrou {reais(totals.paid)} · Saiu {saiu === null ? '…' : reais(saiu)}
          </span>
          {/* ⚠️ O BUZI MORA AQUI, LOGO ABAIXO DO SALDO (04/10/2026, simulação
            * aprovada): ele fala de dinheiro, então só existe com a senha — e
            * some na rota, onde quem segura o celular pode ser a auxiliar. */}
          <button
            type="button"
            onClick={() => navigate('/tio/finance/buzi')}
            className="tap mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-card text-base font-bold text-primary"
          >
            <MessageCircle size={20} aria-hidden="true" />
            Perguntar ao Buzi
          </button>
        </section>

        {/* AS QUATRO ABAS DA CENTRAL. "Mensalidades" vai inteiro: 40+ não
          * decifra abreviação (auditoria "uso"); abaixo de 380 px, duas linhas. */}
        <div role="tablist" aria-label="Central" className="grid grid-cols-2 gap-1 rounded-2xl bg-neutro p-1 min-[380px]:grid-cols-4">
          {[
            ['turma', 'Turma'],
            ['perua', 'Perua'],
            ['mensalidades', 'Mensalidades'],
            ['contas', 'Contas'],
          ].map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={secao === id}
              onClick={() => setSecao(id)}
              className={`tap min-h-12 rounded-xl px-1 text-sm font-bold ${
                secao === id ? 'bg-card text-text shadow-rest' : 'text-textBody'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {secao === 'mensalidades' && (
        <>

        {/* 3. Quem está devendo — âmbar, porque pede atenção dele. Só existe
          * quando há atrasada: cartão de "0 atrasadas" ensinaria a pular o
          * cartão. Abre a lista JÁ filtrada nas atrasadas. */}
        {totals.contagem.overdue > 0 && (
          <div className="rounded-2xl border border-warningBorder bg-warningSoft p-4">
          <button
            type="button"
            onClick={() => irParaAba('mensalidades', 'overdue')}
            className="tap flex w-full items-center gap-3 text-left"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warningChip text-warningText">
              <TriangleAlert size={22} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold tabular-nums text-warningText">
                {totals.contagem.overdue}{' '}
                {totals.contagem.overdue === 1 ? 'atrasada' : 'atrasadas'} ·{' '}
                {reais(totals.soma.overdue)}
              </span>
              {diasDaMaisAntiga !== null && (
                <span className="block text-base text-warningText">
                  {totals.contagem.overdue === 1 ? 'Venceu' : 'A mais antiga venceu'}{' '}
                  {diasDaMaisAntiga <= 0
                    ? 'hoje'
                    : diasDaMaisAntiga === 1
                      ? 'ontem'
                      : `há ${diasDaMaisAntiga} dias`}
                </span>
              )}
            </span>
            <ChevronRight size={22} className="shrink-0 text-warningText" aria-hidden />
          </button>
          {/* "COBRAR OS N ATRASADOS" (item 13) LEVA À LISTA, não cobra.
            * Cobrança em massa não existe: cada família recebe a mensagem
            * dela, pelo "Cobrar no WhatsApp" da própria linha. O botão é
            * branco com borda âmbar — o verde cheio é o da linha. */}
          <button
            type="button"
            onClick={() => irParaAba('mensalidades', 'overdue')}
            className="tap mt-3 flex h-12 w-full items-center justify-center rounded-xl border-2 border-warningBorder bg-card text-base font-bold text-warningText"
          >
            {rotuloDeCobrarAtrasados(totals.contagem.overdue)}
          </button>
          </div>
        )}

        {/* O que falta entrar no mês, numa linha — conferência, calendário e
          * cobrança juntos; a aba Mensalidades separa os três. */}
        {quantasFaltam > 0 && (
          <button
            type="button"
            onClick={() => irParaAba('mensalidades', 'open')}
            className="tap flex min-h-14 w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-rest"
          >
            <span className="flex-1 text-base text-text">
              Falta receber em {mes}: <strong className="tabular-nums">{quantasFaltam}</strong>
            </span>
            <span className="text-base font-bold tabular-nums text-text">{reais(faltaReceber)}</span>
            <ChevronRight size={20} className="shrink-0 text-textBody" aria-hidden />
          </button>
        )}

        {/* 4. Os três atalhos. "Receber" e "Cobrar" levavam à MESMA lista
          * (quem falta pagar) com dois nomes — viraram "Mensalidades": dar
          * baixa e cobrar no WhatsApp moram nas linhas dela, e a cobrança
          * continua sendo por família, nunca em massa. */}
        <div className="grid grid-cols-3 gap-2.5">
          <Atalho icon={Wallet} rotulo="Mensalidades" onClick={() => irParaAba('mensalidades', 'open')} />
          <Atalho icon={Minus} rotulo="Lançar despesa" onClick={() => setDespesaAberta(true)} />
          {/* O ÍCONE DO PIX (04/10/2026, pedido do dono): o losango com as duas
            * ondas, o mesmo do "Mostrar meu PIX" da tela trancada. */}
          <Atalho icon={IconePix} rotulo="Chave PIX" onClick={() => setPixOpen(true)} />
        </div>

        {/* 5. O que espera uma decisão dele. */}
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

        {/* 6. Extrato | Mensalidades. A pílula verde desliza para a escolhida,
          * o mesmo desenho do filtro da lista. */}
        <div
          ref={abasRef}
          role="tablist"
          aria-label="Extrato ou mensalidades"
          className="relative grid scroll-mt-20 grid-cols-2 rounded-full border border-border bg-card p-1"
        >
          <span
            aria-hidden
            className="absolute bottom-1 left-1 top-1 w-[calc((100%-8px)/2)] rounded-full bg-primary transition-transform duration-entrada ease-freio"
            style={{ transform: `translateX(${aba === 'extrato' ? 0 : 100}%)` }}
          />
          {[
            { valor: 'extrato', rotulo: 'Extrato' },
            { valor: 'mensalidades', rotulo: 'Mensalidades' },
          ].map((a) => (
            <button
              key={a.valor}
              type="button"
              role="tab"
              aria-selected={aba === a.valor}
              onClick={() => setAba(a.valor)}
              className={`relative z-[1] h-12 rounded-full text-base font-bold transition-colors duration-estado ${
                aba === a.valor ? 'text-white' : 'text-textMuted'
              }`}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        {aba === 'extrato' && (
          <>
            {loading || despesasDoMes === null ? (
              <Skeleton className="h-40 rounded-2xl" />
            ) : extrato.grupos.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nada no extrato"
                description={`O que entrar e sair em ${mes} aparece aqui, dia por dia.`}
              />
            ) : (
              <section className="overflow-hidden rounded-2xl bg-card shadow-rest">
                {extrato.grupos.map((g) => (
                  <div key={g.dia}>
                    <p className="bg-surface px-4 pb-1.5 pt-3 text-sm font-bold text-textMuted">
                      {g.rotulo}
                    </p>
                    {g.movimentos.map((m) => (
                      <LinhaDoExtrato key={m.id} movimento={m} reais={reais} />
                    ))}
                  </div>
                ))}
              </section>
            )}
            {/* O botão ABRE a tela do relatório, que tem "Imprimir / Salvar
              * PDF" — ele não baixa nada sozinho, e "Baixar" prometia isso. */}
            <Button
              variant="secondary"
              icon={Download}
              onClick={() => navigate('/tio/finance/report')}
            >
              Ver relatório de 12 meses (imprimir ou PDF)
            </Button>
          </>
        )}

        {aba === 'mensalidades' && (
          <>
            {/* E o resto, onde está: os quatro estados com quantidade e valor
              * — conferência, calendário e cobrança são trabalhos diferentes. */}
            <ComoEstaOMes
              monthKey={monthKey}
              contagem={totals.contagem}
              soma={totals.soma}
            />

            {/* A lista. Filtro em pílula: três opções de largura igual, e a
              * pílula verde desliza para a escolhida. */}
            {enriched.length > 0 && (
              <div
                role="tablist"
                aria-label="Filtrar mensalidades"
                className="relative grid grid-cols-3 rounded-full border border-border bg-card p-1"
              >
                {/* No filtro das atrasadas (sem pílula) a pílula verde some:
                  * nenhuma das três está escolhida, e a faixa abaixo diz qual é. */}
                {indiceDoFiltro >= 0 && (
                  <span
                    aria-hidden
                    className="absolute bottom-1 left-1 top-1 w-[calc((100%-8px)/3)] rounded-full bg-primary transition-transform duration-entrada ease-freio"
                    style={{ transform: `translateX(${indiceDoFiltro * 100}%)` }}
                  />
                )}
                {FILTROS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    role="tab"
                    aria-selected={filter === f.value}
                    onClick={() => setFilter(f.value)}
                    className={`relative z-[1] h-12 rounded-full text-base font-semibold transition-colors duration-estado ${
                      filter === f.value ? 'text-white' : 'text-textMuted'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {filter === 'overdue' && (
              <div className="flex items-center gap-3 rounded-2xl border border-warningBorder bg-warningSoft py-1 pl-4 pr-1">
                <p className="min-w-0 flex-1 text-base font-semibold text-warningText">
                  Só as atrasadas
                </p>
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className="tap h-12 shrink-0 rounded-xl px-3 text-base font-bold text-warningText underline"
                >
                  Ver todas
                </button>
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
                  placeholder="Digite aqui"
                  className="h-12 w-full rounded-xl border-2 border-border bg-card pl-11 pr-14 text-base text-text placeholder:text-textMuted focus:border-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Limpar busca"
                    className="tap absolute right-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-lg text-textMuted"
                  >
                    <X size={20} />
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
                    : filter === 'overdue' && !search
                      ? 'Nenhuma atrasada neste mês.'
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
          </>
        )}

        </>
        )}

        {/* TURMA — provisório até os assuntos da Carteira (sessão prod):
          * as portas de hoje para crianças, contratos e escolas. */}
        {secao === 'turma' && (
          <section className="overflow-hidden rounded-3xl bg-card shadow-rest">
            <Porta
              icon={Baby}
              titulo="Crianças"
              detalhe={`${turma.ativas} ${turma.ativas === 1 ? 'criança' : 'crianças'}`}
              onClick={() => navigate('/tio/children')}
            />
            <Porta
              divisor
              icon={Users}
              titulo="Turma e contratos"
              detalhe={[frasesDaTurma.entraram, frasesDaTurma.sairam].filter(Boolean).join(' · ') || 'Quem entrou e quem saiu'}
              onClick={() => navigate('/tio/finance/turma')}
            />
            <Porta
              divisor
              icon={School}
              titulo="Escolas"
              detalhe="Telefone e horários"
              onClick={() => navigate('/tio/children/escolas')}
            />
          </section>
        )}

        {/* PERUA — "Sua perua" de hoje (abastecer, reserva, preciso
          * aumentar), até os assuntos da sessão prod chegarem. */}
        {secao === 'perua' && <BlocoSuaPerua criancas={turmaInteira} visiveis={visiveis} />}

        {/* CONTAS — para onde o dinheiro foi, o que ele deve à plataforma e a
          * chave PIX. Meu plano só existe com a cobrança ligada. */}
        {secao === 'contas' && (
          <>
            {/* ⚠️ A FATURA DE R$ 0,00 (05/10/2026, decisão do dono). Enquanto
              * a cobrança está desligada, ele vê o que pagaria, RISCADO, e
              * "Você paga R$ 0,00". É demonstrativo: nada é gravado. */}
            {cobranca === false && (() => {
              const f = faturaGratisDoMes({
                criancas: turma.ativas,
                plano: profile?.plano || undefined,
              });
              if (!f) return null;
              return (
                <section className="rounded-3xl bg-card p-5 shadow-rest">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-lg font-bold text-text">Fatura de {f.mes}</h3>
                    <span className="rounded-full bg-primaryChip px-3 py-1 text-sm font-bold text-primary">
                      {f.motivo}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-3 text-base text-textBody">
                    <span>
                      Seu plano: {f.criancas} {f.criancas === 1 ? 'criança' : 'crianças'}
                    </span>
                    <s className="tabular-nums">{reais(f.valorDeHoje)}</s>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-2">
                    <span className="text-base font-bold text-text">Você paga</span>
                    <span className="font-display text-2xl font-extrabold tabular-nums text-accentText">
                      {reais(f.vocePaga)}
                    </span>
                  </div>
                  {isCurrentMonthView && <p className="mt-2 text-sm text-textMuted">
                    Este mês: {totals.contagem.paid}{' '}
                    {totals.contagem.paid === 1 ? 'mensalidade recebida' : 'mensalidades recebidas'} pelo app.
                  </p>}
                </section>
              );
            })()}
            {/* OS PLANOS FINANCEIROS (05/10/2026): metas que ele anota, com
              * a conta de quanto separar por mês. O app não guarda dinheiro. */}
            <PlanosFinanceiros reais={reais} />
            <section className="overflow-hidden rounded-3xl bg-card shadow-rest">
              <Porta
                icon={Receipt}
                titulo="Despesas do mês"
                detalhe={`Saiu ${saiu === null ? '…' : reais(saiu)}`}
                onClick={() => navigate('/tio/finance/expenses')}
              />
              <Porta
                divisor
                icon={ClipboardList}
                titulo="Boletim do negócio"
                detalhe="O mês num papel"
                onClick={() => navigate('/tio/finance/boletim')}
              />
              {cobranca === true && (
                <Porta
                  divisor
                  icon={FileText}
                  titulo="Meu plano no Alô Buzinou"
                  detalhe={`${plano.nome} · ${plano.estado}`}
                  onClick={() => navigate('/tio/taxa')}
                />
              )}
            </section>
            <PixLinha hasPix={hasPix} profile={profile} onOpen={() => setPixOpen(true)} />
            {/* A PESQUISA DO CARTÃO, no fim e sem prometer nada (ver
              * InteressePorCartao): sem data e sem "em breve". */}
            <div className="pt-2">
              <InteressePorCartao />
            </div>
          </>
        )}
      </div>

      {/* O PÉ DA CENTRAL: "Iniciar a rota" é o único botão cheio da tela. Com
        * a rota rodando, a aba Central já leva à rota; aqui vira "Abrir". */}
      {viagem.blocos.length > 0 && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-bg px-4 py-3">
          {viagem.rotaAtiva ? (
            <button
              type="button"
              onClick={() => navigate('/tio/route/now')}
              className="tap flex h-16 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-lg font-extrabold text-white shadow-focus"
            >
              <Bus size={24} aria-hidden="true" />
              Abrir a rota
            </button>
          ) : (
            <ControleDeRota
              parte="botao"
              secundario={!viagem.temViagem}
              onIniciar={iniciarEAbrir}
              direcao={viagem.bloco?.direcao}
              alvos={viagem.alvosDaRota}
              saida={saidaDaViagem(viagem.bloco)}
              pendentes={viagem.pendentesDaViagem}
            />
          )}
        </div>
      )}

      <FolhaDeDespesa open={despesaAberta} onClose={() => setDespesaAberta(false)} comValores />

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
              <span className="block text-sm mb-3">
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
 * O nome de cada despesa no extrato. A auxiliar aparece como "Salário da
 * auxiliar" — é como ele fala; "Monitor / auxiliar" é o rótulo do formulário.
 */
const ROTULOS_DO_EXTRATO = {
  ...Object.fromEntries(Object.entries(EXPENSE_CATEGORIES).map(([k, c]) => [k, c.label])),
  monitor: 'Salário da auxiliar',
};

/**
 * O plano da plataforma numa linha: "Mensal · Em dia". Só a FORMA — o valor
 * da fatura mora em `/tio/taxa`, com a conta que o gerou.
 */
function descreverPlano(profile, fatura) {
  const nome =
    profile?.plano === 'anual' ? 'Anual' : profile?.plano === 'mensal' ? 'Mensal' : 'Período de teste';
  if (profile?.suspenso === true) return { nome, estado: 'Suspenso' };
  if (!fatura) return { nome, estado: 'Em dia' };
  const atraso = diasDeAtraso(fatura, new Date());
  return { nome, estado: atraso !== null && atraso > 0 ? 'Fatura atrasada' : 'Fatura em aberto' };
}

/**
 * Atalho do Financeiro: o cartão INTEIRO é o alvo (ícone e nome dentro), com
 * pelo menos 88px de altura. Era só o quadradinho do ícone, com o nome em
 * 14px solto embaixo — o dedo mirava o ícone e o olho, a palavra.
 */
function Atalho({ icon: Icon, rotulo, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl bg-card px-1.5 py-3 text-center shadow-rest"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primaryChip text-primary">
        <Icon size={22} aria-hidden />
      </span>
      <span className="text-base font-semibold leading-tight text-text">{rotulo}</span>
    </button>
  );
}

/** Uma porta do caixa: ícone, título, uma linha de detalhe e a seta. */
function Porta({ icon: Icon, titulo, detalhe, onClick, divisor = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap flex min-h-16 w-full items-center gap-3.5 px-4 py-4 text-left ${
        divisor ? 'border-t border-neutro' : ''
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primaryChip text-primary">
        <Icon size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-text">{titulo}</span>
        <span className="block truncate text-sm tabular-nums text-textMuted">{detalhe}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-textBody" />
    </button>
  );
}

/**
 * Uma linha do extrato: entrada com seta para cima, verde; saída com seta
 * para baixo, vermelha. A cor acompanha a seta e o sinal — nunca é o único
 * jeito de saber se o dinheiro entrou ou saiu.
 */
function LinhaDoExtrato({ movimento, reais }) {
  const entrada = movimento.tipo === 'entrada';
  return (
    <div className="flex min-h-16 items-center gap-3 border-t border-neutro px-4 py-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          entrada ? 'bg-primaryChip text-accentText' : 'bg-dangerSoft text-dangerText'
        }`}
      >
        {entrada ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-text">{movimento.titulo}</p>
        <p className="truncate text-sm text-textMuted">{movimento.detalhe}</p>
      </div>
      <span
        className={`shrink-0 whitespace-nowrap text-base font-bold tabular-nums ${
          entrada ? 'text-accentText' : 'text-dangerText'
        }`}
      >
        {entrada ? '+ ' : '− '}
        {reais(movimento.valor)}
      </span>
    </div>
  );
}

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
  // Cheio ou contorno: quem decide é `botoesDaMensalidade` (item 14). Só a
  // linha de quem AVISOU que pagou tem "Dar baixa" cheio — quinze verdes na
  // mesma lista não deixam nenhum chamar.
  const darBaixa = botoesDaMensalidade(payment._display).darBaixa;
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
    <Button
      size="sm"
      variant={darBaixa === 'cheio' ? 'primary' : 'secondary'}
      fullWidth={false}
      onClick={onConfirm}
    >
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
              <p className="text-base text-textMuted mt-1">
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
              className="tap w-12 h-12 rounded-full bg-neutro flex items-center justify-center text-textMuted shrink-0"
              aria-label="Fechar"
            >
              <X size={20} />
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
        <p className="text-lg font-bold text-text leading-tight">{title}</p>
        <p className="text-base text-textMuted mt-0.5">{subtitle}</p>
      </div>
      {!disabled && <ChevronRight size={18} className="text-textMuted" />}
    </button>
  );
}

/* ─────────────── helpers ─────────────── */

