import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getInteractiveTour } from './interactiveSteps';
import { useAuth } from '../../hooks/useAuth';
import { useCobrancaLigada } from '../../hooks/useCobrancaLigada';
import { markTutorialDone } from '../../services/userService';

/**
 * Tour guiado sobre o app de verdade.
 *
 * COMO FUNCIONA
 * O tour navega até a tela do passo, procura o elemento marcado com
 * data-tour="<anchor>" (ou `prefer`, se ele existir), rola até ele e põe um
 * anel verde pulsando em volta. O balão encosta no elemento (abaixo ou acima,
 * o que couber).
 *
 * ── ⚠️ A TELA NÃO ESCURECE (02/10/2026)
 * Era uma sombra de 62% em volta do recorte: a pessoa via um buraco de luz
 * num app apagado. O dono pediu a tela inteira à vista — o tour mostra ONDE
 * as coisas ficam, e isso só se aprende vendo o resto em volta. Quem marca o
 * alvo agora é só o anel que pulsa.
 *
 * ── E O APP POR BAIXO NÃO RECEBE TOQUE
 * Sem o escurecido, nada avisa que aquilo é um tutorial e não o app — e um
 * toque em "Cadastrar a primeira criança" levaria a pessoa embora no meio do passo 1.
 * Uma camada transparente segura os toques. A exceção é o passo `interact`
 * (só o tour do responsável usa), que espera o toque no próprio elemento.
 *
 * ── O BALÃO: UMA ESTRADINHA E A PERUA
 * O progresso é uma estrada tracejada com uma parada por passo, e a perua
 * anda uma parada a cada "Próximo". É a única animação, e é o que faz o tour
 * ser lembrado. Dois botões: Pular e Próximo.
 *
 * O balão é ESCURO (`night`) e é a única peça escura dentro do app que o
 * design system permite: ele é o diálogo mais leve ("ensina, a tela não
 * escurece"), e precisa se destacar sobre uma tela inteira à vista sem véu
 * nenhum por trás. Por isso a tinta é a do sistema para escuro — `onNight`,
 * `onNightMuted` — e o "Próximo" é o limão com rótulo `onAccent`, o único
 * lugar em que o limão vira botão: sobre verde ou sobre escuro. Canto 14
 * (`xl`), o do balão na referência; a folha é que tem 28.
 *
 * A perua anda em `duration-festa` (450 ms, o teto): é a conquista do passo,
 * e é a única animação do balão além do anel.
 *
 * POR QUE O ELEMENTO PODE SUMIR
 * Metade dos destaques é condicional na tela real. A ausência do anchor é um
 * caminho normal, não um erro: o balão cai pro rodapé sem anel.
 *
 * CONCLUIR x PULAR
 * Os dois marcam tutorialDone: pular é uma decisão, e o tour voltando a cada
 * login ensinaria a pular. Quem quiser rever abre "Como usar o app".
 *
 * Props:
 *   - open:  bool
 *   - mode:  'first' (primeiro acesso) | 'review' (reveu pelo perfil)
 *   - onClose: () => void
 */

const PAD = 6; // folga entre o elemento e o anel
const CARD_GAP = 14; // distância do balão até o elemento destacado
const CARD_SPACE = 170; // altura estimada do balão, pra decidir acima/abaixo

/** O elemento do passo: `prefer` primeiro, depois `anchor`. */
function alvoDo(step) {
  for (const a of [step?.prefer, step?.anchor]) {
    if (!a) continue;
    const el = document.querySelector('[data-tour="' + a + '"]');
    if (el) return el;
  }
  return null;
}

export default function InteractiveTour({ open, mode = 'review', onClose }) {
  const { user, profile, updateProfile } = useAuth();
  const cobranca = useCobrancaLigada();
  const navigate = useNavigate();
  const location = useLocation();

  const steps = getInteractiveTour(profile?.role);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const scrolledFor = useRef(-1);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  // Sempre que abrir, recomeça do zero
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepIndex(0);
      scrolledFor.current = -1;
    }
  }, [open]);

  // Leva pra tela do passo
  useEffect(() => {
    if (!open || !step) return;
    if (step.path && location.pathname !== step.path) navigate(step.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  // ---------------------------------------------------------------------------
  // Acompanha o elemento destacado
  //
  // Um intervalo curto em vez de listener de scroll/resize: o elemento aparece
  // depois da navegação, muda de tamanho quando os dados chegam do Firestore e
  // se move enquanto o scroll suave acontece. Medir sempre é mais barato do que
  // acertar todos esses momentos.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open || !step) return undefined;
    if (!step.anchor && !step.prefer) {
      // rAF em vez de chamada direta: o passo sem âncora só precisa apagar o
      // destaque, e apagar já no corpo do efeito dispara render em cascata.
      const raf = requestAnimationFrame(() => setRect(null));
      return () => cancelAnimationFrame(raf);
    }

    let misses = 0;
    const measure = () => {
      const el = alvoDo(step);
      if (!el) {
        // Só desiste depois de ~1,2 s: evita piscar o balão no rodapé
        // enquanto a tela nova ainda está montando.
        if (++misses > 8) setRect(null);
        return;
      }
      misses = 0;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;

      if (scrolledFor.current !== stepIndex) {
        scrolledFor.current = stepIndex;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      setRect((prev) =>
        prev &&
        Math.abs(prev.top - r.top) < 1 &&
        Math.abs(prev.left - r.left) < 1 &&
        Math.abs(prev.width - r.width) < 1 &&
        Math.abs(prev.height - r.height) < 1
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height }
      );
    };

    const raf = requestAnimationFrame(measure);
    const id = setInterval(measure, 120);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex, step?.anchor, step?.prefer]);

  const uid = user?.uid;
  const finish = useCallback(
    async (completed) => {
      if (completed && uid) {
        try {
          await markTutorialDone(uid);
          updateProfile({ tutorialDone: true });
        } catch (err) {
          console.error('Falha ao marcar tutorial concluído:', err);
        }
      }
      onClose?.();
    },
    [uid, updateProfile, onClose]
  );

  // A última parada pode levar a um lugar (`ctaPath`): o tour do motorista
  // termina abrindo o cadastro da primeira criança, em vez de só fechar.
  const ctaPath = isLast ? step?.ctaPath : null;
  const goNext = useCallback(() => {
    if (isLast) {
      finish(true);
      if (ctaPath) navigate(ctaPath);
    } else setStepIndex((i) => i + 1);
  }, [isLast, finish, ctaPath, navigate]);

  // Passo interativo: tocar no elemento de verdade avança o tour
  useEffect(() => {
    if (!open || !step?.interact || !step.anchor || !rect) return undefined;
    const el = alvoDo(step);
    if (!el) return undefined;
    // Captura: a navegação do NavLink acontece no mesmo clique, e queremos
    // avançar mesmo que o React desmonte a tela em seguida.
    const onHit = () => goNext();
    el.addEventListener('click', onHit, { capture: true, once: true });
    return () => el.removeEventListener('click', onHit, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex, rect?.top, rect?.left, goNext]);

  if (!open || !step) return null;

  const onSkip = () => {
    if (mode === 'first') {
      toast('Pra rever, abra "Como usar o app".', { duration: 4000 });
    }
    finish(true);
  };

  const cardPos = getCardPosition(rect);
  // A perua anda de parada em parada: a primeira na borda esquerda, a última
  // na direita. Com um passo só, ela fica parada no meio.
  const paradaEm = (i) =>
    steps.length > 1 ? 4 + (i * 92) / (steps.length - 1) : 50;

  return (
    <div
      className="fixed inset-0 z-[60] pointer-events-none"
      role="dialog"
      aria-modal="false"
      aria-label={`Tutorial, passo ${stepIndex + 1} de ${steps.length}`}
    >
      {/* Segura os toques no app enquanto o balão está aberto — transparente,
        * a tela continua inteira à vista. No passo `interact` ela some: ali o
        * toque no próprio elemento é o gesto que o passo ensina. */}
      {!step.interact && <div className="absolute inset-0 pointer-events-auto" />}

      {/* O ANEL. Fixo + uma cópia que cresce e some; em
        * `prefers-reduced-motion` fica só o fixo, que continua marcando. */}
      {rect && (
        <div
          aria-hidden
          className="absolute rounded-2xl transition-all duration-entrada ease-freio motion-reduce:transition-none"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        >
          <span className="absolute -inset-1 rounded-[inherit] border-[3px] border-accent" />
          <span className="absolute -inset-1 rounded-[inherit] border-[3px] border-accent animate-tour-pulso motion-reduce:hidden" />
        </div>
      )}

      {/* Balão */}
      <div
        className="absolute inset-x-0 px-3 flex justify-center transition-all duration-entrada ease-freio motion-reduce:transition-none"
        style={cardPos}
      >
        <div className="pointer-events-auto w-full max-w-sm rounded-xl bg-night text-onNight p-4 shadow-float">
          {/* A ESTRADINHA. Uma parada por passo; as já passadas acendem. */}
          <div className="relative h-4 mb-2.5" aria-hidden>
            <span className="absolute inset-x-1 top-[7px] border-t-2 border-dashed border-white/30" />
            {steps.map((_, i) => (
              <span
                key={i}
                className={`absolute top-1 h-2 w-2 -translate-x-1/2 rounded-full ${
                  i <= stepIndex ? 'bg-accent' : 'bg-white/30'
                }`}
                style={{ left: `${paradaEm(i)}%` }}
              />
            ))}
            <svg
              viewBox="0 0 22 14"
              className="absolute -top-0.5 h-3.5 w-[22px] -translate-x-1/2 transition-[left] duration-festa ease-freio motion-reduce:transition-none"
              style={{ left: `${paradaEm(stepIndex)}%` }}
            >
              <rect x="1" y="1" width="18" height="9" rx="3" className="fill-perua" />
              <rect x="12" y="3" width="5" height="3" rx="1" className="fill-night" />
              <circle cx="6" cy="11" r="2.2" className="fill-onNight" />
              <circle cx="15" cy="11" r="2.2" className="fill-onNight" />
            </svg>
          </div>

          <p className="font-display text-lg font-bold leading-tight">{step.title}</p>
          <p className="mt-1 text-base text-onNightMuted leading-snug">
            {!cobranca && step.bodySemCobranca ? step.bodySemCobranca : step.body}
          </p>

          <div className="mt-3 flex items-center">
            <button
              type="button"
              onClick={onSkip}
              className="tap -ml-2 min-h-12 px-2 text-base font-semibold text-onNightMuted hover:text-onNight"
            >
              Pular
            </button>
            <button
              type="button"
              onClick={goNext}
              className="tap ml-auto h-12 rounded-xl bg-accent px-5 text-base font-bold text-onAccent"
            >
              {isLast ? step.ctaLabel || 'Começar' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Onde encostar o balão. Devolve estilo com top OU bottom — nunca os dois —
 * pra não precisar saber a altura do card antes de renderizar.
 */
function getCardPosition(rect) {
  if (!rect) {
    return { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' };
  }

  const vh = window.innerHeight;
  const below = vh - (rect.top + rect.height);

  if (below >= CARD_SPACE) {
    return { top: rect.top + rect.height + PAD + CARD_GAP };
  }
  if (rect.top >= CARD_SPACE) {
    return { bottom: vh - rect.top + PAD + CARD_GAP };
  }
  // Elemento ocupa quase a tela toda: encosta no rodapé mesmo por cima dele.
  return { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' };
}
