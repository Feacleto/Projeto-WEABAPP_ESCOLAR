import { X, UserX } from 'lucide-react';
import { ABSENCE_LABELS } from '../../services/absencesService';
import { useArrastarPraFechar } from '../../hooks/useArrastarPraFechar';

/**
 * Sheet com a lista de ausências do dia — exibido na home do Tio
 * quando ele toca no card "Ausentes hoje". Visualização rápida sem
 * sair da tela inicial.
 */
export default function AbsenceListSheet({ open, onClose, absences = [] }) {
  const { alcaProps, estilo } = useArrastarPraFechar(onClose);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)', ...estilo }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          {...alcaProps}
          className={`pt-3 pb-1 flex justify-center sticky top-0 bg-card z-10 ${alcaProps.className}`}
        >
          <span className="block w-10 h-1.5 rounded-full bg-borderStrong" />
        </div>

        <div className="px-5 pt-2 pb-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-text leading-tight">
                Ausentes hoje
              </h2>
              <p className="text-xs text-textMuted mt-1">
                {absences.length}{' '}
                {absences.length === 1 ? 'criança' : 'crianças'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="tap w-9 h-9 rounded-full bg-neutro flex items-center justify-center text-textMuted shrink-0"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {absences.length === 0 ? (
            <p className="text-sm text-textMuted text-center py-8">
              Ninguém ausente hoje.
            </p>
          ) : (
            <div className="space-y-2">
              {absences.map((a) => (
                <div
                  key={a.id}
                  className="bg-bg rounded-2xl p-3 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-warningChip text-warningText flex items-center justify-center shrink-0">
                    <UserX size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text truncate leading-tight">
                      {a.childName || 'Aluno'}
                    </p>
                    <p className="text-[11px] text-textMuted mt-0.5">
                      {ABSENCE_LABELS[a.type] || 'Ausente'} ·{' '}
                      {a.declaredBy === 'parent'
                        ? 'avisado pelo responsável'
                        : 'registrado por você'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
