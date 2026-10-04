import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Button from './Button';
import { useVoltarFechaFolha } from '../../hooks/useVoltarFechaFolha';

/**
 * Modal de confirmação — bloqueia interação até o usuário decidir. É o
 * diálogo MAIS FORTE abaixo da buzina, então só serve ao que não tem volta
 * (docs/design-system.md, "Diálogos"). Durante a rota, nada de confirmação.
 *
 * O TÍTULO é a pergunta ("Tirar o Pedro da turma?"), a DESCRIÇÃO é a
 * consequência, e o BOTÃO REPETE O VERBO ("Tirar da turma"). Nunca "Tem
 * certeza?" com "Confirmar": quem lê só o botão — e no portão é o que se
 * lê — precisa saber o que vai acontecer ao tocar.
 *
 * Por isso `confirmLabel` é OBRIGATÓRIO na prática. O 'Confirmar' de
 * reserva continua só como rede, para uma tela esquecida não renderizar um
 * botão vazio; em desenvolvimento ele avisa no console, para ser trocado
 * pelo verbo antes de chegar em alguém.
 *
 * Props:
 *   - open:           bool — controla exibição
 *   - title:          string — a pergunta
 *   - description:    string | ReactNode — a consequência
 *   - confirmLabel:   string — o VERBO da ação (obrigatório; ver acima)
 *   - cancelLabel:    string (default 'Cancelar')
 *   - variant:        'primary' | 'danger' (controla cor do botão de confirmar)
 *   - loading:        bool — desabilita ações durante operação async
 *   - onConfirm:      () => void
 *   - onCancel:       () => void
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) {
  // Fecha com ESC
  // O voltar do celular é o "Cancelar" (03/10/2026) — nunca durante a
  // gravação, como o Escape.
  useVoltarFechaFolha(open, () => {
    if (!loading) onCancel?.();
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  if (!confirmLabel && import.meta.env.DEV) {
    console.warn(
      `ConfirmDialog "${title}" sem confirmLabel: o botão precisa dizer o verbo da ação.`
    );
  }
  const rotuloDeConfirmar = confirmLabel || 'Confirmar';

  const iconColor = variant === 'danger' ? 'text-dangerText' : 'text-primary';
  const iconBg = variant === 'danger' ? 'bg-dangerChip' : 'bg-primaryChip';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-night/45 px-4 pb-4 pt-20"
      onClick={() => !loading && onCancel?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-mobile bg-card rounded-2xl shadow-float p-5 animate-sheet-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => !loading && onCancel?.()}
          aria-label="Fechar"
          className="absolute right-3 top-3 w-9 h-9 rounded-lg bg-neutro flex items-center justify-center text-textMuted tap"
          disabled={loading}
        >
          <X size={20} />
        </button>

        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
          <AlertTriangle size={24} className={iconColor} />
        </div>

        <h3 className="font-display text-xl font-bold text-text leading-tight pr-8">{title}</h3>
        {description && (
          <div className="text-[15px] text-textBody mt-2 mb-5 leading-relaxed">
            {description}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
            fullWidth
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            fullWidth
          >
            {rotuloDeConfirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}
