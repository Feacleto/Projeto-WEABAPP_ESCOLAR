import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  School,
  Home,
  Copy,
  UserX,
  Check,
  UserCheck,
  Phone,
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import Avatar from '../common/Avatar';
import StatusBadge from '../children/StatusBadge';
import { formatPhone } from '../../utils/formatters';
import { ABSENCE_SHORT } from '../../services/absencesService';
import { getActionForStatus } from '../../services/routeStatusService';
import { createCall } from '../../services/pendingCallService';
import { useAuth } from '../../hooks/useAuth';

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
  altPickup = null,
  onAdvance,
  onMarkAbsent,
}) {
  const { user } = useAuth();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: child.id, disabled: isAbsent });

  const onCallParent = async () => {
    if (!child.parentUid) {
      toast.error('Pai ainda não tem conta vinculada.');
      return;
    }
    try {
      await createCall({
        adminUid: user?.uid,
        parentUid: child.parentUid,
        childId: child.id,
        childName: child.name,
      });
      toast.success('Ligando pro pai…');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível ligar.');
    }
  };

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

  // Mostramos os DOIS endereços (casa + escola) sempre — o Tio enxerga a
  // rota completa de cada criança. A direção do turno só destaca qual é o
  // ponto de coleta dessa etapa (anel verde no ícone correspondente).
  const homeAddress = child.address || 'Sem endereço de casa';
  const schoolAddress =
    child.schoolAddress || child.school || 'Sem endereço da escola';

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
        <Avatar
          photoURL={child.photoURL}
          gender={child.gender}
          seed={child.id}
          kind="child"
          size="md"
        />
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

      {/* Endereços (casa + escola, sempre os dois — destaque conforme a etapa) */}
      <div className="space-y-1.5 pl-6">
        <AddressRow
          icon={Home}
          label="Casa"
          value={homeAddress}
          highlighted={direction === 'pickup'}
        />
        <AddressRow
          icon={School}
          label="Escola"
          value={schoolAddress}
          highlighted={direction === 'dropoff'}
        />
      </div>

      {/* Aviso "outro responsável vai buscar hoje" — só em dropoff
        * (faz sentido só quando é a hora de entregar a criança) */}
      {altPickup && direction === 'dropoff' && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-2 flex items-center gap-2">
          <UserCheck size={14} className="text-violet-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wide font-semibold text-violet-900">
              Hoje quem pega
            </p>
            <p className="text-xs text-text font-semibold truncate">
              {altPickup.name}
              {altPickup.relationship && (
                <span className="text-textMuted font-normal">
                  {' '}
                  · {altPickup.relationship}
                </span>
              )}
            </p>
            {altPickup.phone && (
              <a
                href={`tel:${altPickup.phone}`}
                className="text-xs text-violet-700 underline"
              >
                {formatPhone(altPickup.phone)}
              </a>
            )}
          </div>
        </div>
      )}

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

      {/* Botão "Chamar pai" — só em dropoff, quando o Tio chegou e
        * precisa apressar o pai a buscar a criança */}
      {!isAbsent && direction === 'dropoff' && child.parentUid && (
        <button
          type="button"
          onClick={onCallParent}
          className="w-full h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold tap inline-flex items-center justify-center gap-1.5 mt-1"
        >
          <Phone size={14} />
          Chamar o pai pra buscar
        </button>
      )}
    </div>
  );
}

function AddressRow({ icon: Icon, label, value, highlighted }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <div
        className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
          highlighted
            ? 'bg-primary text-white'
            : 'bg-gray-100 text-textMuted'
        }`}
      >
        <Icon size={11} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-[10px] uppercase font-semibold tracking-wide ${
            highlighted ? 'text-primary' : 'text-textMuted'
          }`}
        >
          {label}
          {highlighted && (
            <span className="ml-1 normal-case tracking-normal text-textMuted font-medium">
              · etapa atual
            </span>
          )}
        </p>
        <p className="text-text break-words leading-snug">{value}</p>
      </div>
    </div>
  );
}


