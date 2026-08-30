import { Home, Bus, School, CheckCircle2 } from 'lucide-react';
import { STATUS_LABELS } from '../../services/childrenService';

// Cor + ícone por status. Mantém o mesmo "vocabulário" visual em qualquer
// lugar do app (lista do Tio, dashboard do Pai, etc.).
const VISUAL = {
  home: { icon: Home, color: 'bg-neutro text-textMuted' },
  onboard: { icon: Bus, color: 'bg-primary/10 text-primaryDark' },
  atSchool: { icon: School, color: 'bg-escolaChip text-escola' },
  delivered: { icon: CheckCircle2, color: 'bg-success/10 text-accentText' },
};

export default function StatusBadge({ status, size = 'md' }) {
  const visual = VISUAL[status] || VISUAL.home;
  const Icon = visual.icon;
  const label = STATUS_LABELS[status] || 'Desconhecido';
  const sizing =
    size === 'lg'
      ? 'px-3 py-1.5 text-sm gap-1.5'
      : 'px-2 py-1 text-xs gap-1';
  const iconSize = size === 'lg' ? 16 : 12;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${visual.color} ${sizing}`}
    >
      <Icon size={iconSize} />
      {label}
    </span>
  );
}
