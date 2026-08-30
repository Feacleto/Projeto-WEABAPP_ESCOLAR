import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, MessageCircle, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { formatBRL } from '../../services/contractService';
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
 * O PAI NUNCA VÊ NADA DISSO
 * A inadimplência é conversa entre a plataforma e o motorista, e termina aí.
 * Um responsável que descobre que o motorista está devendo começa a duvidar
 * do serviço inteiro — e esse prejuízo sai da mensalidade dele, é maior que a
 * fatura e não volta.
 */

/** Fechar vale pela SESSÃO. Volta quando ele abrir o app de novo. */
const CHAVE = 'alobuzinou:avisoFaturaFechado';

export default function AvisoDaPlataforma({ fatura, criancas = 0 }) {
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
  if (!suspenso && fechado) return null;

  const valor = Number(fatura?.total) || 0;
  const venc = fatura?.vencimento
    ? new Date(fatura.vencimento?.toDate?.() || fatura.vencimento)
    : null;
  const dias = venc ? Math.floor((new Date() - venc) / 86400000) : 0;

  // O número que dá o susto verdadeiro: o que ELE tem a receber e não
  // consegue cobrar enquanto estiver parado.
  //
  // `base` é o campo que `fecharFatura` grava — a soma das mensalidades das
  // crianças ativas dele no mês. Aqui se lia `baseDoMes`, nome que nenhum
  // gravador produzia: o cartão de suspensão caía calado no galho sem número
  // ("Seu acesso está suspenso") justamente na hora em que o número é o
  // argumento inteiro.
  const aReceber = Number(fatura?.base) || 0;

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

  return (
    <div
      className={
        suspenso
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-primaryDark/95 px-5 py-8 backdrop-blur-sm'
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
            ? 'max-w-[26rem] border-white/15 bg-white/[0.07] text-white shadow-2xl backdrop-blur-xl'
            : 'border-warningBorder bg-warningSoft'
        }`}
      >
        {!suspenso && (
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar aviso"
            className="tap absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg text-warningText/70"
          >
            <X size={16} />
          </button>
        )}

        <p
          className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
            suspenso ? 'text-[#E8867C]' : 'text-warningText'
          }`}
        >
          <AlertTriangle size={12} />
          {suspenso ? 'acesso suspenso' : 'mensalidade em aberto'}
        </p>

        {suspenso ? (
          <>
            <h2 className="mt-2 text-[19px] font-extrabold leading-tight tracking-tight">
              {aReceber > 0 ? (
                <>
                  Você tem {formatBRL(aReceber)}
                  <br />
                  travados pra receber
                </>
              ) : (
                'Seu acesso está suspenso'
              )}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-white/70">
              Sem o app você não emite nem dá baixa em mensalidade nenhuma
              {criancas > 0 ? ` das ${criancas} famílias` : ''} — volta a cobrar
              no caderno e de porta em porta.
            </p>
            <div className="mt-3 rounded-xl border border-[#E8867C]/30 bg-[#A32017]/25 p-3">
              <p className="text-[13px] font-bold">
                {formatBRL(valor)} destrava tudo agora.
              </p>
              <p className="mt-0.5 text-[11.5px] text-white/60">
                {venc ? `Vencido em ${venc.toLocaleDateString('pt-BR')}. ` : ''}
                Nada do seu foi apagado, e seus pais não foram avisados.
              </p>
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-1.5 pr-6 text-[15.5px] font-extrabold leading-snug tracking-tight text-text">
              {formatBRL(valor)}
              {dias > 0 ? ` · venceu há ${dias} dia${dias > 1 ? 's' : ''}` : ''}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-warningText/85">
              Você continua trabalhando normal — por enquanto. Se o acesso for
              suspenso, <strong>você para de cobrar as mensalidades pelo app</strong>
              {aReceber > 0 ? ` e ${formatBRL(aReceber)} do mês voltam pro caderno` : ''}.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={() => navigate('/tio/taxa')}
          className={`tap mt-3 flex h-11 w-full items-center justify-center rounded-xl text-[14px] font-bold ${
            suspenso ? 'bg-white text-primaryDark' : 'bg-primary text-white'
          }`}
        >
          Pagar com PIX
        </button>

        <a
          href={zap}
          target="_blank"
          rel="noopener noreferrer"
          className={`tap mt-2 flex items-center justify-center gap-1.5 py-1.5 text-[12px] font-semibold ${
            suspenso ? 'text-white/55' : 'text-warningText/80'
          }`}
        >
          <MessageCircle size={13} />
          Pedir ajuda a um consultor
        </a>
      </div>
    </div>
  );
}
