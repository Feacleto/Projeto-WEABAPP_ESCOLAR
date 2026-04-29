import { User } from 'lucide-react';

/**
 * Avatar circular com cor de fundo por gênero.
 * Substitui foto futuramente — por enquanto só ícone.
 *
 * Props:
 *   - gender: 'male' | 'female' | undefined (genérico = primary)
 *   - size:   'sm' | 'md' | 'lg' | 'xl'
 *   - className: extra
 */
const SIZES = {
  sm: { box: 'w-8 h-8', icon: 16 },
  md: { box: 'w-12 h-12', icon: 22 },
  lg: { box: 'w-16 h-16', icon: 30 },
  xl: { box: 'w-24 h-24', icon: 44 },
};

const GENDER_STYLES = {
  male: 'bg-sky-100 text-sky-700',
  female: 'bg-pink-100 text-pink-700',
  default: 'bg-primary/10 text-primary',
};

export default function Avatar({ gender, size = 'md', className = '' }) {
  const { box, icon } = SIZES[size] || SIZES.md;
  const style = GENDER_STYLES[gender] || GENDER_STYLES.default;

  return (
    <div
      className={`${box} ${style} rounded-full flex items-center justify-center shrink-0 ${className}`}
    >
      <User size={icon} strokeWidth={2.2} />
    </div>
  );
}
