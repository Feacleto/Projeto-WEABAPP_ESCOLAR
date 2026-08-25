import { useState } from 'react';
import { X, UserX, Sunrise, Sunset, Trash2, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ABSENCE_TYPES,
  declareAbsence,
  removeAbsence,
  notifyAbsence,
} from '../../services/absencesService';
import { getDateKey } from '../../services/horariosService';

/**
 * Sheet (bottom sheet) reusável pra declarar ausência.
 *
 * Props:
 *  - open: bool
 *  - onClose: () => void
 *  - child: { id, name, parentUid }
 *  - declaredBy: 'parent' | 'admin'
 *  (destinatário da notificação é determinado internamente pelo notifyAbsence)
 *  - currentAbsence: doc da declaração existente (pra mostrar "remover")
 *  - dateKey: opcional, default = hoje
 */
export default function AbsenceSheet({
  open,
  onClose,
  child,
  declaredBy,
  currentAbsence,
  dateKey,
  // Status efetivo da criança agora. Só serve pra decidir se a opção
  // "já peguei" aparece — ela não faz sentido antes de a criança chegar
  // na escola, e uma opção impossível na lista é ruído no momento em que
  // o responsável está com pressa.
  status,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);

  if (!open) {
    // Garante que próxima abertura comece sem animação de fechamento.
    // Acontece dentro do render porque o componente só monta quando open=true.
    if (closing) setClosing(false);
    return null;
  }

  const targetDate = dateKey || getDateKey();
  const firstName = child?.name?.split(' ')[0] || 'Aluno';

  async function handleSelect(type) {
    if (!child?.id) return;
    setSubmitting(true);
    try {
      await declareAbsence({
        dateKey: targetDate,
        childId: child.id,
        childName: child.name || '',
        parentUid: child.parentUid || null,
        adminUid: child.adminUid || null,
        type,
        declaredBy,
      });
      // Notifica o outro lado — fire-and-forget. A função encontra o
      // destinatário internamente (admin via appState/init ou parent via child).
      notifyAbsence({
        child: { name: child.name, parentUid: child.parentUid },
        type,
        dateKey: targetDate,
        declaredBy,
      });
      toast.success('Ausência registrada!');
      handleClose();
    } catch (err) {
      console.error('Erro ao declarar ausência:', err);
      toast.error('Não foi possível registrar. Tente novamente.');
      setSubmitting(false);
    }
  }

  async function handleRemove() {
    if (!child?.id) return;
    setSubmitting(true);
    try {
      await removeAbsence({ dateKey: targetDate, childId: child.id });
      toast.success('Ausência removida.');
      handleClose();
    } catch (err) {
      console.error('Erro ao remover ausência:', err);
      toast.error('Não foi possível remover.');
      setSubmitting(false);
    }
  }

  function handleClose() {
    setClosing(true);
    setTimeout(() => {
      setSubmitting(false);
      onClose?.();
    }, 200);
  }

  const overlay = closing
    ? 'opacity-0'
    : 'opacity-100';
  const sheet = closing
    ? 'translate-y-full'
    : 'translate-y-0';

  return (
    <div
      className={`fixed inset-0 z-50 max-w-mobile mx-auto bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${overlay}`}
      onClick={handleClose}
    >
      <div
        className={`absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl transition-transform duration-200 ${sheet}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="pt-3 pb-1 flex justify-center">
          <span className="block w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pt-2 pb-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-text leading-tight">
                {firstName} vai faltar?
              </h2>
              <p className="text-xs text-textMuted mt-1">
                Escolha o que se aplica hoje
              </p>
            </div>
            <button
              onClick={handleClose}
              className="tap w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-textMuted"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Opções */}
          <div className="space-y-2">
            <OptionCard
              icon={UserX}
              title="Não vai à escola"
              subtitle="Motorista não busca nem traz hoje"
              gradient="from-red-50 to-rose-100"
              iconBg="bg-red-500"
              active={currentAbsence?.type === ABSENCE_TYPES.FULL}
              disabled={submitting}
              onClick={() => handleSelect(ABSENCE_TYPES.FULL)}
            />
            <OptionCard
              icon={Sunrise}
              title="Eu vou levar de manhã"
              subtitle="Motorista só busca à tarde"
              gradient="from-amber-50 to-orange-100"
              iconBg="bg-amber-500"
              active={currentAbsence?.type === ABSENCE_TYPES.NO_PICKUP}
              disabled={submitting}
              onClick={() => handleSelect(ABSENCE_TYPES.NO_PICKUP)}
            />
            <OptionCard
              icon={Sunset}
              title="Eu vou buscar à tarde"
              subtitle="Motorista só leva de manhã"
              gradient="from-violet-50 to-purple-100"
              iconBg="bg-violet-600"
              active={currentAbsence?.type === ABSENCE_TYPES.NO_DROPOFF}
              disabled={submitting}
              onClick={() => handleSelect(ABSENCE_TYPES.NO_DROPOFF)}
            />

            {/* O FATO CONSUMADO, e não o plano.
              * Só aparece com a criança já na escola: é a situação de quem
              * resolveu buscar no meio do dia e está ali com ela na mão. Sem
              * esta frase o responsável escolhia "vou buscar à tarde" — que é
              * outra coisa — ou avisava por WhatsApp, fora do app, onde a rota
              * não enxerga e o motorista passa na escola à toa. */}
            {(status === 'atSchool' || status === 'onboard'
              || currentAbsence?.type === ABSENCE_TYPES.ALREADY_PICKED) && (
              <OptionCard
                icon={UserCheck}
                title="Já peguei na escola"
                subtitle="O motorista não precisa passar lá hoje"
                gradient="from-emerald-50 to-green-100"
                iconBg="bg-emerald-600"
                active={currentAbsence?.type === ABSENCE_TYPES.ALREADY_PICKED}
                disabled={submitting}
                onClick={() => handleSelect(ABSENCE_TYPES.ALREADY_PICKED)}
              />
            )}
          </div>

          {/* Remover declaração existente */}
          {currentAbsence && (
            <button
              onClick={handleRemove}
              disabled={submitting}
              className="tap w-full rounded-xl py-3 px-4 bg-gray-100 text-text font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Trash2 size={16} />
              Remover ausência
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OptionCard({
  icon: Icon,
  title,
  subtitle,
  gradient,
  iconBg,
  active,
  disabled,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`tap w-full text-left rounded-2xl p-4 flex items-center gap-3 bg-gradient-to-br ${gradient} ${
        active ? 'ring-2 ring-text/30' : ''
      } disabled:opacity-50`}
    >
      <div
        className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm ${iconBg}`}
      >
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text leading-tight">{title}</p>
        <p className="text-xs text-textMuted mt-0.5">{subtitle}</p>
      </div>
      {active && (
        <span className="text-[10px] uppercase tracking-wider font-bold text-text bg-white/70 px-2 py-0.5 rounded-full">
          Ativo
        </span>
      )}
    </button>
  );
}
