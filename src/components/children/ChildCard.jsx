import { GraduationCap, Phone, MoreVertical } from 'lucide-react';
import Card from '../common/Card';
import StatusBadge from './StatusBadge';
import { PERIOD_LABELS, formatPhone } from '../../utils/formatters';

/**
 * Card de criança (lista do Tio).
 *
 * Props:
 *   - child:           dados do Firestore
 *   - onCycleStatus:   handler do botão "Próximo status"
 *   - onMenuClick:     handler do menu de opções (editar/excluir) — opcional
 */
export default function ChildCard({ child, onCycleStatus, onMenuClick }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text truncate">{child.name}</h3>
          <p className="text-xs text-textMuted flex items-center gap-1 mt-0.5 truncate">
            <GraduationCap size={12} className="shrink-0" />
            <span className="truncate">{child.school}</span>
            <span className="shrink-0">·</span>
            <span className="shrink-0">{PERIOD_LABELS[child.period]}</span>
          </p>
          {child.parentPhone && (
            <p className="text-xs text-textMuted flex items-center gap-1 mt-0.5 truncate">
              <Phone size={12} className="shrink-0" />
              {formatPhone(child.parentPhone)}
            </p>
          )}
        </div>
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            aria-label="Mais opções"
            className="text-textMuted tap p-1 -mr-1"
          >
            <MoreVertical size={18} />
          </button>
        )}
      </div>

      {/* Convite ainda não usado pelo pai? Mostra um aviso discreto */}
      {child.inviteStatus === 'pending' && (
        <div className="text-[11px] bg-warning/10 text-amber-700 px-2 py-1 rounded inline-flex items-center w-fit">
          Aguardando primeiro acesso · {child.inviteCode}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={child.status} />
        {onCycleStatus && (
          <button
            type="button"
            onClick={() => onCycleStatus(child)}
            className="h-9 px-4 bg-primary/10 text-primaryDark rounded-lg text-xs font-semibold tap"
          >
            Próximo status
          </button>
        )}
      </div>
    </Card>
  );
}
