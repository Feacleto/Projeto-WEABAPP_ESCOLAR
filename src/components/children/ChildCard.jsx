import { GraduationCap, ChevronRight, AlertTriangle } from 'lucide-react';
import Avatar from '../common/Avatar';
import StatusBadge from './StatusBadge';
import { PERIOD_LABELS } from '../../utils/formatters';
import { getEffectiveStatus } from '../../services/childrenService';

/**
 * Card minimalista de criança na lista "Minha turma".
 * - Avatar (foto ou gerado)
 * - Nome + escola/período + status
 * - Aviso discreto se convite ainda não foi usado pelo pai
 *
 * Mudança de status NÃO acontece aqui — só na tela de rota.
 * Aqui o card é puramente informativo + navegação pro detalhe.
 */
export default function ChildCard({ child, onClick }) {
  const status = getEffectiveStatus(child);
  const pendingInvite = child.inviteStatus === 'pending';

  return (
    <button
      type="button"
      onClick={onClick}
      className="tap w-full text-left bg-card rounded-2xl shadow-sm p-4 flex items-center gap-3"
    >
      <Avatar
        photoURL={child.photoURL}
        gender={child.gender}
        seed={child.id}
        kind="child"
        size="md"
      />
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-text truncate leading-tight">
          {child.name}
        </h3>
        <p className="text-xs text-textMuted flex items-center gap-1 mt-0.5 truncate">
          <GraduationCap size={12} className="shrink-0" />
          <span className="truncate">{child.school}</span>
          <span className="shrink-0">·</span>
          <span className="shrink-0">{PERIOD_LABELS[child.period]}</span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <StatusBadge status={status} />
          {pendingInvite && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              <AlertTriangle size={10} />
              Convite pendente
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={18} className="text-textMuted shrink-0" />
    </button>
  );
}
