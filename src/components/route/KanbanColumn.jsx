import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ListPlus } from 'lucide-react';
import { useMemo } from 'react';
import KanbanCard from './KanbanCard';

/**
 * Coluna de um turno: header + lista de cards arrastáveis.
 *
 * Props:
 *   - turno:        chave 'period-direction' (ex: 'morning-pickup')
 *   - title:        rótulo amigável
 *   - subtitle:     pequena descrição (ex: "Casa → Escola")
 *   - children:     array enriquecido { id, ..., effectiveStatus }
 *   - absentIds:    Set<string> com ids ausentes hoje
 *   - direction:    'pickup' | 'dropoff'
 *   - isActive:     se o turno é o "ativo agora" (destaque visual)
 *   - onReorder:    (newOrder: string[]) => void
 *   - onAdvance:    (childId) => void
 *   - onMarkAbsent: (childId) => void
 */
export default function KanbanColumn({
  title,
  subtitle,
  children = [],
  absentIds,
  direction,
  isActive = false,
  onReorder,
  onAdvance,
  onMarkAbsent,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    })
  );

  const ids = useMemo(() => children.map((c) => c.id), [children]);

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <section
      className={`rounded-2xl border ${
        isActive ? 'border-primary bg-primary/5' : 'border-gray-100 bg-card'
      } p-3 space-y-3`}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text leading-tight">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-textMuted">{subtitle}</p>
          )}
        </div>
        {isActive && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full uppercase tracking-wide">
            Agora
          </span>
        )}
      </header>

      {children.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-6 text-textMuted">
          <ListPlus size={20} className="mb-1" />
          <p className="text-xs">Sem crianças neste turno.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {children.map((c) => (
                <KanbanCard
                  key={c.id}
                  child={c}
                  direction={direction}
                  isAbsent={absentIds.has(c.id)}
                  onAdvance={(nextStatus) => onAdvance(c.id, nextStatus)}
                  onMarkAbsent={() => onMarkAbsent(c.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
