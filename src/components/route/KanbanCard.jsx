import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  School,
  Home,
  Copy,
  UserX,
  Check,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import Avatar from '../common/Avatar';
import StatusBadge from '../children/StatusBadge';
import { formatPhone } from '../../utils/formatters';
import { ABSENCE_SHORT } from '../../services/absencesService';

/**
 * Card draggable de uma criança dentro do kanban de rota.
 *
 * Props:
 *   - child:        doc da criança (com .effectiveStatus já calculado fora)
 *   - direction:    'pickup' | 'dropoff' (afeta endereço mostrado e ação)
 *   - isAbsent:     bool — se true, card aparece "apagado" e sem ação
 *   - onAdvance:    () => void — clique no botão grande de ação
 *   - onMarkAbsent: () => void — clique em "Faltou"
 */
export default function KanbanCard({
  child,
  direction,
  isAbsent = false,
  declaredAbsence = null,
  onAdvance,
  onMarkAbsent,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: child.id, disabled: isAbsent });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : isAbsent ? 0.5 : 1,
  };

  const [copied, setCopied] = useState(false);
  const phone = child.parentPhone;

  const onCopyPhone = async (e) => {
    e.stopPropagation();
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      toast.success('Telefone copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const action = getActionForStatus(child.effectiveStatus, direction);

  // Para pickup: tio passa em CASA pra coletar (mostra endereço residencial).
  // Para dropoff: tio passa na ESCOLA pra coletar e levar pra casa.
  const AddressIcon = direction === 'pickup' ? Home : School;
  const addressLabel = direction === 'pickup' ? 'Casa' : 'Escola';
  const addressValue =
    direction === 'pickup'
      ? child.address || 'Sem endereço de casa'
      : child.schoolAddress || child.school || 'Sem endereço da escola';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card rounded-xl border ${
        isDragging
          ? 'border-primary shadow-lg'
          : isAbsent
          ? 'border-gray-100'
          : 'border-gray-200'
      } p-3 space-y-2.5`}
    >
      {/* Linha 1: drag handle + avatar + nome + status + faltou */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="Arrastar para reordenar"
          {...attributes}
          {...listeners}
          className="text-textMuted touch-none p-1 -ml-1 mt-1 cursor-grab active:cursor-grabbing"
          disabled={isAbsent}
        >
          <GripVertical size={18} />
        </button>
        <Avatar gender={child.gender} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text truncate leading-tight">
            {child.name}
          </p>
          <p className="text-xs text-textMuted truncate">{child.school}</p>
          <div className="mt-1">
            <StatusBadge status={child.effectiveStatus} />
            {isAbsent && (
              <span
                className={`ml-1.5 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  declaredAbsence
                    ? 'text-amber-800 bg-amber-100 border border-amber-200'
                    : 'text-warning bg-warning/10'
                }`}
              >
                <UserX size={11} />
                {declaredAbsence
                  ? `${ABSENCE_SHORT[declaredAbsence.type] || 'Ausente'} · ${
                      declaredAbsence.declaredBy === 'parent' ? 'pai avisou' : 'registrado'
                    }`
                  : 'Ausente'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Endereço (origem ou destino dependendo da direção do turno) */}
      <div className="flex items-start gap-2 text-xs pl-6">
        <AddressIcon size={12} className="text-textMuted shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase font-semibold tracking-wide text-textMuted">
            {addressLabel}
          </p>
          <p className="text-text break-words leading-snug">{addressValue}</p>
        </div>
      </div>

      {/* Responsável + telefone */}
      {(child.parentName || phone) && (
        <div className="flex items-center gap-2 text-xs pl-6">
          <span className="text-textMuted">{child.parentName}</span>
          {phone && (
            <>
              <span className="text-textMuted">·</span>
              <span className="text-text">{formatPhone(phone)}</span>
              <button
                type="button"
                onClick={onCopyPhone}
                aria-label="Copiar telefone"
                className="text-primary tap p-0.5"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </>
          )}
        </div>
      )}

      {/* Ação + botão de ausência */}
      {!isAbsent && (
        <div className="flex gap-2 pt-1">
          {action ? (
            <button
              type="button"
              onClick={() => onAdvance(action.nextStatus)}
              className={`flex-1 h-10 rounded-xl text-sm font-semibold tap text-white ${
                action.variant === 'success'
                  ? 'bg-success hover:bg-accentDark'
                  : 'bg-primary hover:bg-primaryDark'
              }`}
            >
              {action.label}
            </button>
          ) : (
            <div className="flex-1 h-10 rounded-xl bg-gray-100 text-textMuted text-xs font-medium flex items-center justify-center">
              Concluído neste turno
            </div>
          )}
          <button
            type="button"
            onClick={onMarkAbsent}
            aria-label="Marcar como ausente"
            className="h-10 px-3 rounded-xl border border-gray-200 text-warning text-xs font-semibold tap inline-flex items-center gap-1"
          >
            <UserX size={14} />
            Faltou
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Decide qual ação mostrar baseado no status efetivo + direção do turno.
 * Retorna { label, nextStatus, variant } ou null se não há ação possível.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getActionForStatus(status, direction) {
  if (direction === 'pickup') {
    // home → onboard → atSchool
    if (status === 'home') {
      return { label: 'Embarcar', nextStatus: 'onboard', variant: 'primary' };
    }
    if (status === 'onboard') {
      return {
        label: 'Entregar na escola',
        nextStatus: 'atSchool',
        variant: 'success',
      };
    }
    return null; // atSchool ou delivered: nada a fazer no pickup
  }
  // direction === 'dropoff'
  // atSchool → onboard → delivered
  if (status === 'atSchool') {
    return { label: 'Embarcar pra casa', nextStatus: 'onboard', variant: 'primary' };
  }
  if (status === 'onboard') {
    return { label: 'Entregar em casa', nextStatus: 'delivered', variant: 'success' };
  }
  return null;
}
