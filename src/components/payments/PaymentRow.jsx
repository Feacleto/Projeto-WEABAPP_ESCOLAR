import {
  Banknote,
  QrCode,
  CreditCard,
  Paperclip,
  Send,
  TriangleAlert,
} from 'lucide-react';
import Card from '../common/Card';
import TrilhaDoPagamento from './TrilhaDoPagamento';
import { TOM } from './estadoDaMensalidade';
import {
  formatCurrency,
  formatMonthLabel,
  diasDeCalendario,
} from '../../compartilhado/formatters';
import {
  paymentLabel,
  paymentTone,
} from '../../dominio/cobranca/paymentVocabulary';
import { foiPagoAtrasado } from '../../services/paymentsService';
import { botoesDaMensalidade } from '../../dominio/cobranca/caixaDoMes.js';

// A COR fica aqui (em estadoDaMensalidade); o TEXTO vem de
// dominio/cobranca/paymentVocabulary, que sabe falar pro papel de quem está
// lendo. O estado 'claimed' era o pior caso: o tio lia "aguardando
// confirmação" sem saber que a bola estava com ele.


const MES_CURTO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function paraData(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate();
  if (valor instanceof Date) return valor;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "01/10" — o ano está na folhinha ou no seletor; repetir é ruído. */
function diaEMes(valor) {
  const d = paraData(valor);
  if (!d) return null;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
}

function horaDe(valor) {
  const d = paraData(valor);
  if (!d) return null;
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
}

const METODO = {
  cash: { Icon: Banknote, texto: 'em dinheiro' },
  card: { Icon: CreditCard, texto: 'no cartão' },
  pix: { Icon: QrCode, texto: 'por PIX' },
};

/**
 * A LINHA DE BAIXO: o que aconteceu, ou o que vai acontecer, em palavras.
 *
 * "Vence: 10/10/2026 · Pago: 03/10/2026" pedia uma conta de cabeça para cada
 * linha. "Venceu há 4 dias" é a conta feita — e é exatamente a informação que
 * decide se ele pega o telefone hoje.
 */
function detalheDaLinha(payment, displayStatus, role) {
  const metodo = METODO[payment.paymentMethod] || (payment.paymentMethod ? METODO.pix : null);

  if (displayStatus === 'paid') {
    const quando = diaEMes(payment.paidAt);
    return {
      Icon: metodo?.Icon || null,
      texto: [quando ? `Pago em ${quando}` : 'Pago', metodo?.texto].filter(Boolean).join(', '),
    };
  }
  if (displayStatus === 'claimed') {
    const quando = diaEMes(payment.claimedAt);
    const hora = horaDe(payment.claimedAt);
    return {
      Icon: metodo?.Icon || null,
      texto: [
        quando
          ? `${role === 'parent' ? 'Você avisou' : 'Avisou'} em ${quando}${hora ? `, ${hora}` : ''}`
          : 'Avisou que pagou',
        metodo?.texto,
      ].filter(Boolean).join(', '),
    };
  }
  const dias = diasDeCalendario(new Date(), payment.dueDate);
  if (dias == null) return { Icon: null, texto: '' };
  if (displayStatus === 'overdue') {
    const atraso = -dias;
    return {
      Icon: null,
      texto:
        atraso <= 0 ? 'Venceu hoje' : atraso === 1 ? 'Venceu ontem' : `Venceu há ${atraso} dias`,
    };
  }
  return {
    Icon: null,
    texto: dias <= 0 ? 'Vence hoje' : dias === 1 ? 'Vence amanhã' : `Vence em ${dias} dias`,
  };
}

/**
 * A FOLHINHA DE VENCIMENTO — o dia grande, o mês embaixo, colorido pelo estado.
 *
 * É o "rosto" da linha (docs/design-system.md, Lista): numa mensalidade o que
 * se reconhece de relance não é a criança, é o dia em que ela vence. E a
 * faixa colorida faz a lista inteira ser lida de cima a baixo sem ler palavra.
 */
function Folhinha({ dueDate, tom }) {
  const d = paraData(dueDate);
  const estilo = TOM[tom] || TOM.neutral;
  return (
    <span
      aria-hidden
      className={`w-12 shrink-0 overflow-hidden rounded-lg border bg-card text-center ${estilo.borda}`}
    >
      <span className="block font-display text-lg font-extrabold leading-snug text-text">
        {d ? String(d.getDate()).padStart(2, '0') : '—'}
      </span>
      <span className={`block font-mono text-xs font-semibold leading-relaxed tracking-wider ${estilo.folha}`}>
        {d ? MES_CURTO[d.getMonth()] : ''}
      </span>
    </span>
  );
}

/**
 * Uma mensalidade — usada por TioFinance e PaiFinance.
 *
 * Props:
 *   - payment:        doc do Firestore
 *   - displayStatus:  'paid' | 'claimed' | 'pending' | 'overdue' (calculado fora)
 *   - action:         botão (ex: "Dar baixa") — opcional
 *   - showChild:      mostra nome da criança (default true; Pai esconde)
 *   - variant:        'cartao' (padrão — cartão solto, o do pai) ou 'linha'
 *                     (dentro de uma lista única, o do motorista)
 *   - comDivisor:     na variante 'linha', o traço em cima — que começa
 *                     DEPOIS da folhinha, como em toda lista do app
 *   - mostrarMes:     escreve o mês por extenso. Padrão: só no cartão. Na
 *                     lista do mês o seletor já diz qual é; nos atrasados de
 *                     meses anteriores, quem chama liga
 *
 * ⚠️ AS DUAS VARIANTES SÃO O MESMO COMPONENTE de propósito: o pai e o
 * motorista precisam ler a MESMA história do mesmo pagamento (a trilha, o
 * comprovante, o estado). Duas linhas diferentes divergiriam na primeira
 * mudança — a mesma razão de o vocabulário ser um só.
 */
export default function PaymentRow({
  payment,
  displayStatus,
  action = null,
  showChild = true,
  role = 'parent',
  onAttachReceipt = null,
  onCharge = null,
  variant = 'cartao',
  comDivisor = false,
  mostrarMes,
  // ⚠️ O AVISO DE DUPLICATA VEM POR FORA, e não de dentro do pagamento.
  //
  // Ele era `payment.receiptDuplicateOf` — um campo do documento que a
  // RESPONSÁVEL lê. A tela o escondia dela por papel, e esconder na tela não
  // esconde o dado: o console do navegador mostra o JSON inteiro. Hoje ele
  // mora em `alertasDeComprovante`, que só o motorista e o dono leem, e
  // chega aqui como prop porque quem carrega é a tela DELE.
  alertaDeDuplicata = null,
}) {
  // `claimed` é âmbar para a família com ou sem comprovante: "Aguardando o
  // motorista confirmar". Verde só depois da baixa — ver o fim de
  // dominio/cobranca/paymentVocabulary.js.

  // Entrou depois do vencimento? Só o tio vê isso — ver paymentVocabulary.
  const pagoAtrasado = foiPagoAtrasado(payment);

  const tom = paymentTone(displayStatus, role, { pagoAtrasado });
  const vocabulario = paymentLabel(displayStatus, role, { pagoAtrasado });
  // As palavras dos quatro estados moram no vocabulário (paymentVocabulary),
  // inclusive "Conferir" e "Pendente" do lado do motorista.
  const label = vocabulario || '';
  const estilo = TOM[tom] || TOM.neutral;
  const ChipIcon = estilo.Icon;

  const detalhe = detalheDaLinha(payment, displayStatus, role);
  const DetalheIcon = detalhe.Icon;
  const escreverMes = mostrarMes ?? variant === 'cartao';

  const temHistoria =
    payment.claimedAt || payment.paidAt || payment.revertedAt || payment.receiptURL;
  const podeAnexar =
    onAttachReceipt && displayStatus !== 'pending' && displayStatus !== 'overdue';
  const podeCobrar =
    onCharge && (displayStatus === 'overdue' || displayStatus === 'pending');

  const conteudo = (
    <>
      <div className="flex items-start gap-3">
        <Folhinha dueDate={payment.dueDate} tom={tom} />

        <div className="min-w-0 flex-1">
          {showChild && payment.childName && (
            <p className="truncate font-semibold leading-snug text-text">
              {payment.childName}
            </p>
          )}
          {(escreverMes || !(showChild && payment.childName)) && (
            <p
              className={`capitalize ${
                showChild && payment.childName
                  ? 'text-sm text-textMuted'
                  : 'font-semibold leading-snug text-text'
              }`}
            >
              {formatMonthLabel(payment.month)}
            </p>
          )}
          {detalhe.texto && (
            <p className="mt-0.5 flex items-center gap-1 text-sm leading-snug text-textMuted">
              {DetalheIcon && <DetalheIcon size={14} className="shrink-0" />}
              <span className="min-w-0">{detalhe.texto}</span>
            </p>
          )}
        </div>

        {/* UMA coisa à direita: o valor, com o estado embaixo dele.
          * ⚠️ A cor fica na TAG, nunca no número — número vermelho se lê
          * como dívida mesmo quando é só o valor da mensalidade. */}
        <div className="shrink-0 text-right">
          <p className="whitespace-nowrap text-lg font-bold tabular-nums text-text">
            {formatCurrency(payment.amount)}
          </p>
          {label && (
            <span
              className={`mt-1 inline-flex max-w-[11rem] items-center gap-1 rounded-full px-2.5 py-1 text-left text-sm font-semibold leading-tight ${estilo.chip}`}
            >
              {ChipIcon && <ChipIcon size={14} />}
              {label}
            </span>
          )}
        </div>
      </div>

      {/* O que se FAZ com a linha, abaixo dela e alinhado depois da folhinha. */}
      {(
        (role === 'admin' && alertaDeDuplicata) ||
        payment.receiptURL ||
        podeAnexar ||
        podeCobrar ||
        action
      ) && (
        <div className="mt-2 space-y-2 pl-[60px]">
          {/* Comprovante IDÊNTICO ao de outro mês.
            *
            * Aviso, não bloqueio, e só pro tio — é ele quem decide. Boa
            * parte das vezes não é má-fé: a pessoa procura na galeria e
            * pega o print errado. Uma heurística que acusa sozinha erra e
            * estraga uma relação que precisa durar anos. */}
          {role === 'admin' && alertaDeDuplicata && (
            <p className="inline-flex items-start gap-1.5 rounded-lg border border-warningBorder bg-warningSoft px-2.5 py-2 text-sm font-semibold text-warningText">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                Comprovante igual ao de{' '}
                {alertaDeDuplicata.month
                  ? formatMonthLabel(alertaDeDuplicata.month)
                  : 'outro mês'}
                . Vale conferir antes de confirmar.
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Comprovante anexado pelo pai. Fica a um toque pro tio
              * conferir antes de confirmar — era isto que antes virava
              * print de tela no WhatsApp. */}
            {payment.receiptURL ? (
              <a
                href={payment.receiptURL}
                target="_blank"
                rel="noreferrer"
                className="tap inline-flex h-12 items-center gap-1.5 rounded-full px-2 text-base font-semibold text-primary underline"
              >
                <Paperclip size={18} />
                Ver comprovante
              </a>
            ) : (
              /* Sem comprovante e já avisado/pago: o tio anexa o print que
               * recebeu no WhatsApp. Sem isso o histórico do mês mostra
               * "pago" sem lastro nenhum. */
              podeAnexar && (
                <button
                  type="button"
                  onClick={onAttachReceipt}
                  className="tap inline-flex h-12 items-center gap-1.5 rounded-full px-2 text-base font-semibold text-textMuted underline"
                >
                  <Paperclip size={18} />
                  Anexar comprovante
                </button>
              )
            )}

            {/* Cobrar sem sair do app. Só pra quem está devendo — em 'pago' ou
              * "aguardando confirmação" cobrar seria constrangedor e errado.
              *
              * ⚠️ NA ATRASADA ELE É O VERDE CHEIO DA LINHA (04/10/2026, item
              * 14): o trabalho daquela linha é cobrar, e o "Dar baixa" ao lado
              * passou a contorno. Na pendente continua suave — ainda não
              * venceu. Quem decide é `botoesDaMensalidade` (caixaDoMes.js). */}
            {podeCobrar && (
              <button
                type="button"
                onClick={onCharge}
                className={`tap inline-flex h-12 items-center gap-1.5 rounded-full px-4 text-base ${
                  botoesDaMensalidade(displayStatus).cobrar === 'cheio'
                    ? 'bg-primary font-bold text-white'
                    : 'bg-primaryChip font-semibold text-accentText'
                }`}
              >
                <Send size={18} />
                {displayStatus === 'overdue' ? 'Cobrar no WhatsApp' : 'Lembrar no WhatsApp'}
              </button>
            )}

            {action && <div className="ml-auto">{action}</div>}
          </div>
        </div>
      )}

      {/* O HISTÓRICO, SÓ QUANDO EXISTE HISTÓRIA.
        *
        * Mensalidade que ninguém tocou tem uma linha só ("gerada"), e um
        * expansor em cada cartão de uma lista de doze meses vira ruído em
        * todos eles para servir em nenhum. A partir do primeiro gesto — o
        * pai avisou, o tio deu baixa, alguém anexou ou desfez — a linha
        * passa a valer, e é justamente aí que a discordância aparece.
        *
        * ⚠️ `revertedAt` ENTRA NA CONTA de propósito: desfazer volta o
        * pagamento pra 'pending', então sem ele o cartão que mais precisa
        * de histórico seria o único a não oferecer nenhum. */}
      {temHistoria && (
        <div className="mt-2 pl-[60px]">
          <TrilhaDoPagamento payment={payment} />
        </div>
      )}
    </>
  );

  if (variant === 'linha') {
    return (
      <div className="relative px-4 py-3">
        {comDivisor && (
          <span aria-hidden className="absolute left-[76px] right-0 top-0 h-px bg-neutro" />
        )}
        {conteudo}
      </div>
    );
  }

  return <Card className="p-4">{conteudo}</Card>;
}
