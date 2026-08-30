import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { getInteractiveTour } from './interactiveSteps';
import { useAuth } from '../../hooks/useAuth';
import { markTutorialDone } from '../../services/userService';

/**
 * Tour guiado sobre o app de verdade.
 *
 * COMO FUNCIONA
 * O tour navega até a tela do passo, procura o elemento marcado com
 * data-tour="<anchor>", rola até ele e abre um buraco de luz por cima do
 * escurecido. O balão de texto encosta no elemento (acima ou abaixo, o que
 * couber). Passo com interact:true avança quando o usuário toca no PRÓPRIO
 * elemento — é o que ensina o gesto em vez de descrever o gesto.
 *
 * POR QUE O ELEMENTO PODE SUMIR
 * Metade dos destaques é condicional na tela real: "Começar agora" não existe
 * com a rota já rodando, "avisar falta" vira outro card quando a falta já foi
 * declarada. Então a ausência do anchor é um caminho normal, não um erro: o
 * balão cai pro rodapé sem destaque e o texto continua fazendo sentido.
 *
 * CONCLUIR x PULAR
 * Só o último passo marca tutorialDone. Pular fecha e o tour volta no próximo
 * login — de propósito: quem pulou não aprendeu, e uma tela que a pessoa não
 * entende é o motivo nº 1 de ela voltar pro WhatsApp.
 *
 * Props:
 *   - open:  bool
 *   - mode:  'first' (primeiro acesso) | 'review' (reveu pelo perfil)
 *   - onClose: () => void
 */

const DIM = 'rgba(0,0,0,0.62)';
const PAD = 8; // folga entre o elemento e a borda do recorte de luz
const CARD_GAP = 14; // distância do balão até o elemento destacado
const CARD_SPACE = 250; // altura estimada do balão, pra decidir acima/abaixo

export default function InteractiveTour({ open, mode = 'review', onClose }) {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const steps = getInteractiveTour(profile?.role);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const scrolledFor = useRef(-1);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

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
    if (!step.anchor) {
      // rAF em vez de chamada direta: o passo sem âncora só precisa apagar o
      // destaque, e apagar já no corpo do efeito dispara render em cascata.
      const raf = requestAnimationFrame(() => setRect(null));
      return () => cancelAnimationFrame(raf);
    }

    let misses = 0;
    const measure = () => {
      const el = document.querySelector('[data-tour="' + step.anchor + '"]');
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
  }, [open, stepIndex, step?.anchor]);

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

  const goNext = useCallback(() => {
    if (isLast) finish(true);
    else setStepIndex((i) => i + 1);
  }, [isLast, finish]);

  // Passo interativo: tocar no elemento de verdade avança o tour
  useEffect(() => {
    if (!open || !step?.interact || !step.anchor || !rect) return undefined;
    const el = document.querySelector('[data-tour="' + step.anchor + '"]');
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
      toast(
        'Sem problema. O tutorial volta no próximo login até você terminar.',
        { icon: 'ℹ️', duration: 5000 }
      );
    }
    finish(false);
  };

  const onPrev = () => {
    if (isFirst) return;
    scrolledFor.current = -1;
    setStepIndex((i) => i - 1);
  };

  const Icon = step.icon;
  const cardPos = getCardPosition(rect);

  return (
    <div
      className="fixed inset-0 z-[60] pointer-events-none"
      role="dialog"
      aria-modal="false"
      aria-label={`Tutorial, passo ${stepIndex + 1} de ${steps.length}`}
    >
      {/* Escurecido + recorte de luz. pointer-events:none em tudo: o app
       * embaixo continua tocável, que é o ponto de um tour interativo. */}
      {rect ? (
        <div
          className="absolute rounded-2xl transition-all duration-300 ease-out"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: `0 0 0 3px rgba(255,255,255,0.95), 0 0 0 9999px ${DIM}`,
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: DIM }} />
      )}

      {/* Balão */}
      <div
        className="absolute inset-x-0 px-3 flex justify-center transition-all duration-300 ease-out"
        style={cardPos}
      >
        <div className="pointer-events-auto w-full max-w-sm bg-card rounded-3xl shadow-float overflow-hidden">
          <div className="bg-gradient-to-br from-primary to-primaryDark text-white p-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/80">
                  Passo {stepIndex + 1} de {steps.length}
                </p>
                <p className="text-lg font-bold leading-tight mt-1">
                  {step.title}
                </p>
              </div>
              <button
                onClick={onSkip}
                aria-label="Fechar tutorial"
                className="tap w-9 h-9 rounded-full bg-white/15 flex items-center justify-center shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full flex-1 transition-colors ${
                    i <= stepIndex ? 'bg-white' : 'bg-white/25'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-[15px] text-text leading-relaxed">{step.body}</p>

            {step.interact && rect && (
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                Toque no que está iluminado
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              {!isFirst && (
                <button
                  onClick={onPrev}
                  className="tap h-12 px-3 rounded-xl bg-neutro text-text text-sm font-semibold inline-flex items-center gap-1"
                >
                  <ChevronLeft size={16} />
                  Voltar
                </button>
              )}
              <button
                onClick={goNext}
                className="tap h-12 flex-1 rounded-xl bg-primary text-white font-bold inline-flex items-center justify-center gap-2"
              >
                {isLast ? 'Terminei!' : 'Próximo'}
                {isLast ? <Check size={18} /> : <ChevronRight size={16} />}
              </button>
            </div>

            {!isLast && (
              <button
                onClick={onSkip}
                className="tap w-full text-xs text-textMuted py-1.5 hover:text-text"
              >
                {mode === 'first' ? 'Agora não' : 'Fechar tutorial'}
              </button>
            )}
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
