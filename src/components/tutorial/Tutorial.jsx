import { useState } from 'react';
import { X, ChevronRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../common/Button';
import { getStepsForRole } from './tutorialSteps';
import { markTutorialDone } from '../../services/userService';
import { useAuth } from '../../hooks/useAuth';

/**
 * Modal central de onboarding. Aparece no primeiro acesso e quando o usuário
 * pede pra refazer. Marca tutorialDone=true só ao "Concluir"; ao "Pular"
 * pede confirmação e fecha sem marcar (volta no próximo login).
 *
 * Props:
 *   - onClose: () => void — fecha o modal sem alterar tutorialDone
 *   - onComplete?: () => void — chamado após marcar como concluído
 *   - floating?: bool — quando true, renderiza como card flutuante no rodapé
 *     (não bloqueia toques no resto da tela). Usado pelo botão "Como usar".
 */
export default function Tutorial({ onClose, onComplete, floating = false }) {
  const { user, profile, updateProfile } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [saving, setSaving] = useState(false);

  const steps = getStepsForRole(profile?.role);
  if (!steps.length) return null;

  const isLastStep = stepIndex === steps.length - 1;
  const step = steps[stepIndex];
  const Icon = step.icon;

  const onNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));

  const onComplete_ = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      await markTutorialDone(user.uid);
      // Atualiza o profile local pra modal não reabrir antes do próximo fetch
      updateProfile({ tutorialDone: true });
      toast.success('Tudo certo! Bom uso.');
      onComplete?.();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const onSkip = () => setConfirmingSkip(true);

  const onConfirmSkip = () => {
    setConfirmingSkip(false);
    toast('Sem problema — o tutorial vai aparecer novamente no próximo login.', {
      icon: 'ℹ️',
      duration: 4000,
    });
    onClose();
  };

  // ---------------------------------------------------------------------------
  // Tela de confirmação do "Pular"
  // ---------------------------------------------------------------------------
  if (confirmingSkip) {
    return (
      <Overlay floating={floating}>
        <ModalCard floating={floating}>
          <h2 className="text-lg font-bold text-text">Pular o tutorial?</h2>
          <p className="text-sm text-textMuted mt-2">
            Como você não chegou até o final, o tutorial vai aparecer
            <strong> novamente no próximo login</strong>. Você pode concluí-lo
            depois ou abrir manualmente pelo botão de ajuda na tela inicial.
          </p>
          <div className="flex flex-col gap-2 mt-6">
            <Button onClick={() => setConfirmingSkip(false)}>
              Continuar tutorial
            </Button>
            <Button variant="ghost" onClick={onConfirmSkip}>
              Pular mesmo assim
            </Button>
          </div>
        </ModalCard>
      </Overlay>
    );
  }

  // ---------------------------------------------------------------------------
  // Slide do tutorial
  // ---------------------------------------------------------------------------
  return (
    <Overlay floating={floating}>
      <ModalCard floating={floating}>
        <button
          type="button"
          onClick={onSkip}
          aria-label="Pular tutorial"
          className="absolute top-3 right-3 p-1 text-textMuted hover:text-text tap"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center pt-2">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Icon size={32} className="text-primary" />
          </div>
          <h2 className="text-lg font-bold text-text">{step.title}</h2>
          <p className="text-sm text-textMuted mt-2 leading-relaxed">
            {step.description}
          </p>
        </div>

        <div className="flex justify-center gap-2 mt-6 mb-4">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === stepIndex
                  ? 'w-6 bg-primary'
                  : i < stepIndex
                    ? 'w-2 bg-primary/50'
                    : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {isLastStep ? (
            <Button
              icon={Check}
              loading={saving}
              onClick={onComplete_}
            >
              Concluir
            </Button>
          ) : (
            <Button icon={ChevronRight} onClick={onNext}>
              Próximo ({stepIndex + 1}/{steps.length})
            </Button>
          )}
          {!isLastStep && (
            <button
              type="button"
              onClick={onSkip}
              className="text-sm text-textMuted hover:text-text tap py-2"
            >
              Pular tutorial
            </button>
          )}
        </div>
      </ModalCard>
    </Overlay>
  );
}

function Overlay({ children, floating }) {
  if (floating) {
    // Modo flutuante: overlay com pointer-events:none deixa toques passarem
    // pro app embaixo. Card é absoluto no rodapé com pointer-events:auto.
    return (
      <div
        className="fixed inset-0 z-50 pointer-events-none max-w-mobile mx-auto flex items-end justify-center p-3"
        role="dialog"
        aria-modal="false"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 5rem)' }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
}

function ModalCard({ children, floating }) {
  if (floating) {
    return (
      <div className="relative pointer-events-auto bg-card rounded-3xl shadow-2xl shadow-black/20 p-5 w-full max-w-sm border border-gray-100">
        {children}
      </div>
    );
  }
  return (
    <div className="relative bg-card rounded-2xl shadow-xl p-6 w-full max-w-sm">
      {children}
    </div>
  );
}
