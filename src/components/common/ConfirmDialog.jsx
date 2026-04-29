import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import Button from './Button';

/**
 * Modal de confirmação genérico — bloqueia interação até o usuário confirmar
 * ou cancelar. Usado pra ações irreversíveis ou de impacto.
 *
 * Props:
 *   - open:           bool — controla exibição
 *   - title:          string
 *   - description:    string | ReactNode
 *   - confirmLabel:   string (default 'Confirmar')
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
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) {
  // Fecha com ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) onCancel?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const iconColor = variant === 'danger' ? 'text-danger' : 'text-primary';
  const iconBg = variant === 'danger' ? 'bg-danger/10' : 'bg-primary/10';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 pt-20"
      onClick={() => !loading && onCancel?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-mobile bg-card rounded-2xl shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => !loading && onCancel?.()}
          aria-label="Fechar"
          className="absolute right-3 top-3 p-1 text-textMuted tap"
          disabled={loading}
        >
          <X size={20} />
        </button>

        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
          <AlertTriangle size={24} className={iconColor} />
        </div>

        <h3 className="text-lg font-bold text-text">{title}</h3>
        {description && (
          <div className="text-sm text-textMuted mt-2 mb-5 leading-relaxed">
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
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
