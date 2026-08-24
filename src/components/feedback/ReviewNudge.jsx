import { useEffect, useState } from 'react';
import { ArrowRight, Star, X } from 'lucide-react';
import ReviewSheet from './ReviewSheet';
import { useAuth } from '../../hooks/useAuth';
import { getLastFeedbackAt } from '../../services/feedbackService';
import {
  getPlatformConfig,
  janelaAberta,
} from '../../services/platformConfigService';

/**
 * Convite pra avaliar, no painel de quem usa.
 *
 * QUEM VÊ O QUÊ
 * O MOTORISTA é convidado a virar vitrine: o depoimento dele aparece na home
 * e é o que convence outro motorista. O texto diz isso na cara, porque o
 * convite tem que ser honesto sobre onde a resposta vai parar.
 * O RESPONSÁVEL é convidado a ajudar a melhorar o app — e o cartão dele
 * também diz a verdade: "só a gente vê".
 *
 * QUANDO APARECE
 * Primeiro: SÓ COM A JANELA ABERTA. O dono liga o período de avaliação no
 * painel dele (platformConfig/app) e é isso que dá permissão ao cartão de
 * existir. Fora da janela ele não aparece pra ninguém, por melhor que seja o
 * momento — porque pedir avaliação o ano inteiro é como não pedir: vira
 * paisagem, e o motorista aprende a não ler o topo do painel.
 *
 * Depois, e só depois, as regras de sempre: pra quem nunca avaliou, ou quem
 * avaliou há mais de 120 dias (opinião envelhece; app muda). Some pro resto
 * da sessão quando fechado, e some por 60 dias quando dispensado — dá pra
 * ignorar sem ser perseguido, e o pedido volta quando o app já é outro.
 *
 * A ORDEM DAS DUAS PERGUNTAS IMPORTA
 * A janela é consultada ANTES do histórico de feedback. Fechada, nem lemos
 * o feedback: é uma leitura a menos por abertura de painel, em toda conta,
 * todo dia.
 *
 * ESPERA O SINAL ANTES DE APARECER
 * Nada é renderizado enquanto a checagem não volta: um cartão que aparece e
 * desaparece meio segundo depois no meio do painel é pior que nenhum cartão.
 */

const KEY = 'ab_review_nudge_v1';
const DIAS_ATE_PEDIR_DE_NOVO = 120;
const DIAS_DE_SILENCIO = 60;
const DIA = 24 * 60 * 60 * 1000;

function dispensadoRecentemente(uid) {
  try {
    const raw = localStorage.getItem(`${KEY}:${uid}`);
    if (!raw) return false;
    return Date.now() - Number(raw) < DIAS_DE_SILENCIO * DIA;
  } catch {
    return false;
  }
}

export default function ReviewNudge() {
  const { user, profile } = useAuth();
  const uid = user?.uid;
  const isTio = profile?.role === 'admin';

  const [mostrar, setMostrar] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!uid) return;
    if (dispensadoRecentemente(uid)) return;

    let alive = true;
    getPlatformConfig().then((config) => {
      if (!alive || !janelaAberta(config)) return;
      return getLastFeedbackAt(uid).then((ultima) => {
        if (!alive) return;
        const vencido =
          !ultima ||
          Date.now() - ultima.getTime() > DIAS_ATE_PEDIR_DE_NOVO * DIA;
        if (vencido) setMostrar(true);
      });
    });
    return () => {
      alive = false;
    };
  }, [uid]);

  const dispensar = () => {
    try {
      localStorage.setItem(`${KEY}:${uid}`, String(Date.now()));
    } catch {
      // Navegador sem storage: o cartão volta na próxima sessão. Sem drama.
    }
    setMostrar(false);
  };

  if (!mostrar) return null;

  return (
    <>
      <div
        className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-lg ${
          isTio
            ? 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-primary shadow-emerald-500/20'
            : 'bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 shadow-indigo-500/20'
        }`}
      >
        <button
          type="button"
          onClick={dispensar}
          aria-label="Dispensar"
          className="tap absolute right-2 top-2 rounded-lg p-1 text-white/60 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/20">
            <Star size={22} className="fill-white/90 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold leading-tight tracking-tight">
              {isTio
                ? 'Sua opinião vira a vitrine do app'
                : 'Como está sendo pra você?'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/80">
              {isTio
                ? 'Publique sua avaliação na home e ajude outro motorista a decidir. Leva um minuto.'
                : 'Uma nota e duas linhas ajudam a decidir o que melhorar. Só a gente vê.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAberto(true)}
          className="tap mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-[#0B1210]"
        >
          {isTio ? 'Avaliar e publicar' : 'Avaliar o app'}
          <ArrowRight size={16} />
        </button>
      </div>

      <ReviewSheet
        open={aberto}
        onClose={() => {
          setAberto(false);
          // Quem abriu a folha não precisa mais do cartão nesta sessão.
          setMostrar(false);
        }}
        uid={uid}
        role={profile?.role}
        profile={profile}
      />
    </>
  );
}
