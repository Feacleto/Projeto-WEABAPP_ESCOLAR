import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, MessageCircle, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { diasDeCalendario, formatBRL } from '../../compartilhado/formatters';
import { devWhatsAppLink } from '../../config/developer';

/**
 * O AVISO DA PLATAFORMA PRO MOTORISTA — atraso e suspensão.
 *
 * DOIS ESTADOS, E A DIFERENÇA É O BOTÃO DE FECHAR.
 *
 *   atraso    cartão que FECHA. Ele trabalha normal, e o aviso volta na
 *             próxima sessão. Fechar quer dizer "eu vi, me deixa trabalhar
 *             hoje" — um aviso que não pode ser fechado no primeiro dia de
 *             atraso transforma esquecimento em humilhação diária, e ele
 *             volta amanhã com a mesma dívida e menos boa vontade.
 *
 *   suspenso  cartão FIXO, app bloqueado atrás. E chegar aqui é sempre
 *             decisão de uma pessoa: não existe temporizador que corta.
 *
 * O QUE ESTE COMPONENTE NÃO É
 * Não é segurança. O bloqueio de verdade está nas rules — `suspenso == true`
 * fecha a escrita da operação. Removendo este componente pelo console do
 * navegador, não há dado atrás dele.
 *
 * NO CAIXA ELE VIRA UMA LINHA (`compacto`, 04/10/2026, item 19). O caixa já
 * tem o verde dele (receber a mensalidade), e o cartão trazia um segundo
 * "Pagar com PIX" verde no topo da mesma tela — dois protagonistas, e o mais
 * alto era a dívida com a plataforma. Lá ele é uma linha âmbar que leva a
 * `/tio/taxa`: o aviso continua, o botão verde não. (Os dois dinheiros não se
 * misturam também na forma: a taxa nunca disputa com a mensalidade.)
 *
 * O SUSPENSO É CLARO desde 04/10/2026: era uma cortina `bg-primaryDark/95` com
 * vidro escuro, e dentro do app não existe tela escura (docs/design-system.md).
 * Hoje é o padrão de diálogo do app — véu `bg-night/45` e cartão branco.
 *
 * O PAI NUNCA VÊ NADA DISSO
 * A inadimplência é conversa entre a plataforma e o motorista, e termina aí.
 * Um responsável que descobre que o motorista está devendo começa a duvidar
 * do serviço inteiro — e esse prejuízo sai da mensalidade dele, é maior que a
 * fatura e não volta.
 */

/** Fechar vale pela SESSÃO. Volta quando ele abrir o app de novo. */
const CHAVE = 'alobuzinou:avisoFaturaFechado';

export default function AvisoDaPlataforma({ fatura, criancas = 0, compacto = false }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [fechado, setFechado] = useState(() => {
    try {
      return sessionStorage.getItem(CHAVE) === '1';
    } catch {
      return false;
    }
  });

  const suspenso = profile?.suspenso === true;

  // A suspensão IGNORA o "fechado" em vez de reabri-lo por efeito.
  //
  // A versão anterior usava um useEffect pra zerar o estado quando `suspenso`
  // virava true — o que causa um render a mais e, pior, deixa um quadro em que
  // a tela já sabe da suspensão e ainda mostra o cartão fechável. Derivar não
  // tem esse intervalo: o que ele dispensou era um lembrete, e lembrete
  // dispensado não vale como dispensa de um impedimento.
  if (!suspenso && (!fatura || fatura.status === 'quitada')) return null;
  // Na linha do caixa o "fechado" não vale: ela não ocupa nada, e é a porta
  // para a fatura na tela do dinheiro.
  if (!suspenso && fechado && !compacto) return null;

  const valor = Number(fatura?.total) || 0;
  const venc = fatura?.vencimento
    ? new Date(fatura.vencimento?.toDate?.() || fatura.vencimento)
    : null;
  // ⚠️ DIAS DE CALENDÁRIO. Com períodos de 24h, uma fatura vencida dia 10 ao
  // meio-dia e aberta dia 13 às 9h dava 2 — o cartão dizia "venceu há 2
  // dias" —, e no dia seguinte ao vencimento, de manhã, dava 0: a frase de
  // atraso não aparecia numa fatura já vencida.
  const dias = venc ? diasDeCalendario(venc) ?? 0 : 0;

  // ⚠️ `fatura.base` NÃO EXISTE MAIS, e este é o MESMO bug pela terceira vez.
  //
  // Ele já foi `baseDoMes` — "nome que nenhum gravador produzia" — e virou
  // `base`. Em 06/09/2026 o preço passou a ser de tabela, `fecharFatura`
  // encolheu à metade e `base` saiu junto: o cartão voltou a mostrar R$ 0,00
  // exatamente onde o número é o argumento inteiro.
  //
  // A soma das mensalidades deixou de ser calculada de propósito — ela exigia
  // varrer `children` da plataforma inteira. O que a fatura guarda agora é
  // quantas crianças ele tem, e é isso que o cartão passa a dizer: menos
  // impressionante que um valor em reais, e verdadeiro.
  // (o número de crianças já chega por prop, de quem tem a contagem viva)

  const fechar = () => {
    setFechado(true);
    try {
      sessionStorage.setItem(CHAVE, '1');
    } catch {
      // Modo privado: o aviso volta na próxima navegação. Aceitável — o
      // custo de não conseguir lembrar é ele ver de novo, não perder acesso.
    }
  };

  const zap = devWhatsAppLink(
    suspenso
      ? 'Olá! Meu acesso ao Alô Buzinou está suspenso e quero regularizar.'
      : 'Olá! Quero falar sobre a mensalidade do Alô Buzinou.'
  );

  if (compacto && !suspenso) {
    return (
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate('/tio/taxa')}
          className="tap flex min-h-14 w-full items-center gap-3 rounded-2xl border border-warningBorder bg-warningSoft px-4 py-3 text-left"
        >
          <AlertTriangle size={20} className="shrink-0 text-warningText" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-base text-warningText">
            <strong>Meu plano:</strong> {formatBRL(valor)} em aberto
            {dias > 0 ? ` · venceu há ${dias} dia${dias > 1 ? 's' : ''}` : ''}
          </span>
          <ChevronRight size={20} className="shrink-0 text-warningText" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={
        suspenso
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-night/45 px-5 py-8'
          : // O respiro lateral é DAQUI, e não de quem monta.
            //
            // Ele vive no `TioLayout`, acima do <Outlet /> — ou seja, fora da
            // caixa com margem que cada tela constrói pra si. Deixar o padding
            // pro chamador significaria repetir a mesma classe em todo ponto
            // de montagem futuro, e bastaria um esquecimento pra o cartão
            // aparecer colado nas bordas justamente na tela onde ninguém
            // testou.
            'mb-4 px-5 pt-4'
      }
      role={suspenso ? 'alertdialog' : undefined}
      aria-modal={suspenso ? 'true' : undefined}
    >
      <div
        className={`relative w-full rounded-2xl border p-4 ${
          suspenso
            ? 'max-w-[26rem] border-border bg-card text-text shadow-float'
            : 'border-warningBorder bg-warningSoft'
        }`}
      >
        {!suspenso && (
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar aviso"
            className="tap absolute right-1 top-1 flex h-12 w-12 items-center justify-center rounded-lg text-warningText/80"
          >
            <X size={20} />
          </button>
        )}

        <p
          className={`rotulo flex items-center gap-1.5 ${
            suspenso ? 'text-dangerText' : 'text-warningText'
          }`}
        >
          <AlertTriangle size={14} />
          {suspenso ? 'acesso suspenso' : 'mensalidade em aberto'}
        </p>

        {suspenso ? (
          <>
            <h2 className="mt-2 text-[19px] font-extrabold leading-tight tracking-tight">
              {criancas > 0 ? (
                <>
                  {criancas} {criancas === 1 ? 'família' : 'famílias'}
                  <br />
                  sem cobrança pelo app
                </>
              ) : (
                'Seu acesso está suspenso'
              )}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-textBody">
              Sem o app você não emite nem dá baixa em mensalidade nenhuma —
              volta a cobrar no caderno e de porta em porta.
            </p>
            <div className="mt-3 rounded-xl border border-dangerBorder bg-dangerSoft p-3">
              <p className="text-sm font-bold text-dangerText">
                {formatBRL(valor)} destrava tudo agora.
              </p>
              <p className="mt-0.5 text-sm text-textBody">
                {venc ? `Vencido em ${venc.toLocaleDateString('pt-BR')}. ` : ''}
                Nada do seu foi apagado, e seus pais não foram avisados.
              </p>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-1.5 pr-10 text-lg font-extrabold leading-snug tracking-tight text-text">
              {formatBRL(valor)}
              {dias > 0 ? ` · venceu há ${dias} dia${dias > 1 ? 's' : ''}` : ''}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-warningText">
              Você continua trabalhando normal — por enquanto. Se o acesso for
              suspenso, <strong>você para de cobrar as mensalidades pelo app</strong>
              {criancas > 0 ? ` das suas ${criancas} famílias` : ''}.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={() => navigate('/tio/taxa')}
          className={`tap mt-3 flex h-12 w-full items-center justify-center rounded-xl text-base font-bold ${
            suspenso ? 'bg-primary text-white shadow-focus' : 'bg-primary text-white'
          }`}
        >
          Pagar com PIX
        </button>

        <a
          href={zap}
          target="_blank"
          rel="noopener noreferrer"
          className={`tap mt-1 flex min-h-12 items-center justify-center gap-1.5 text-sm font-semibold ${
            suspenso ? 'text-textBody' : 'text-warningText'
          }`}
        >
          <MessageCircle size={16} />
          Pedir ajuda a um consultor
        </a>
      </div>
    </div>
  );
}
