import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import { getInteractiveTour } from './interactiveSteps';
import { useAuth } from '../../hooks/useAuth';
import { markTutorialDone } from '../../services/userService';

/**
 * Tour interativo passo a passo — overlay flutuante no rodapé que
 * NÃO bloqueia toques no app. Navega entre as telas reais conforme
 * o usuário avança, mostrando frases curtas contextuais.
 *
 * Pra dispensar: botão "Pular" ou ✕ — marca tutorialDone=true e fecha.
 * Avançar último passo também marca como concluído.
 *
 * Props:
 *   - open: bool
 *   - onClose: () => void
 */
export default function InteractiveTour({ open, onClose }) {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const steps = getInteractiveTour(profile?.role);
  const [stepIndex, setStepIndex] = useState(0);

  // Sempre que abrir, reseta o passo
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepIndex(0);
    }
  }, [open]);

  // Navega pra rota do passo atual quando ela diferir
  useEffect(() => {
    if (!open || !steps[stepIndex]) return;
    const target = steps[stepIndex].path;
    if (target && location.pathname !== target) {
      navigate(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  if (!open || steps.length === 0) return null;

  const step = steps[stepIndex];
  const Icon = step.icon;
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  const onFinish = async (markAsDone = true) => {
    if (markAsDone && user?.uid) {
      try {
        await markTutorialDone(user.uid);
        updateProfile({ tutorialDone: true });
      } catch (err) {
        console.error('Falha ao marcar tutorial concluído:', err);
      }
    }
    onClose?.();
  };

  const onNext = () => {
    if (isLast) onFinish(true);
    else setStepIndex((i) => i + 1);
  };

  const onPrev = () => {
    if (isFirst) return;
    setStepIndex((i) => i - 1);
  };

  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto pointer-events-none p-3 flex items-end justify-center"
      role="dialog"
      aria-modal="false"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 6rem)' }}
    >
      <div className="pointer-events-auto w-full max-w-sm bg-card rounded-3xl shadow-2xl shadow-black/30 border border-gray-100 overflow-hidden">
        {/* Top: ícone + título + dots */}
        <div className="bg-gradient-to-br from-primary to-primaryDark text-white p-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
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
              onClick={() => onFinish(false)}
              aria-label="Fechar tour"
              className="tap w-9 h-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Barra de progresso */}
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

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="text-sm text-text leading-relaxed">{step.body}</p>

          <div className="flex items-center gap-2 pt-1">
            {!isFirst && (
              <button
                onClick={onPrev}
                className="tap h-11 px-3 rounded-xl bg-gray-100 text-text text-sm font-semibold inline-flex items-center gap-1"
              >
                <ChevronLeft size={16} />
                Voltar
              </button>
            )}
            <button
              onClick={onNext}
              className="tap h-11 flex-1 rounded-xl bg-primary text-white font-bold inline-flex items-center justify-center gap-2"
            >
              {isLast ? 'Concluir' : 'Próximo'}
              {!isLast && <ChevronRight size={16} />}
            </button>
          </div>

          {!isLast && (
            <button
              onClick={() => onFinish(false)}
              className="tap w-full text-xs text-textMuted py-1.5 hover:text-text"
            >
              Pular tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
