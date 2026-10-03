import { Home, Bus, School, CheckCircle2 } from 'lucide-react';
import { STATUS_LABELS } from '../../services/childrenService';

// Cor + ícone por status. Mantém o mesmo "vocabulário" visual em qualquer
// lugar do app (lista do Tio, dashboard do Pai, etc.).
//
// ⚠️ A COR SEGUE A LEGENDA (03/10/2026, design system): perua é âmbar e
// escola é violeta, como no pino do mapa. "Na perua" era verde-claro e
// "Entregue" era verde-limão — dois verdes para dois estados, e nenhum dos
// dois batia com a perua do mapa. Em casa é o repouso (cinza), e entregue é
// o único verde: é o estado em que o dia daquela criança terminou bem.
const VISUAL = {
  home: { icon: Home, color: 'bg-neutro text-textMuted' },
  onboard: { icon: Bus, color: 'bg-warningChip text-warningText' },
  atSchool: { icon: School, color: 'bg-escolaChip text-escola' },
  delivered: { icon: CheckCircle2, color: 'bg-primaryChip text-accentText' },
};

export default function StatusBadge({ status, size = 'md' }) {
  const visual = VISUAL[status] || VISUAL.home;
  const Icon = visual.icon;
  const label = STATUS_LABELS[status] || 'Desconhecido';
  const sizing =
    size === 'lg'
      ? 'px-3 py-1.5 text-sm gap-1.5'
      : 'px-2.5 py-1 text-[13px] gap-1';
  const iconSize = size === 'lg' ? 16 : 13;

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap transition-colors duration-estado ${visual.color} ${sizing}`}
    >
      <Icon size={iconSize} />
      {label}
    </span>
  );
}
