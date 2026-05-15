import { useState } from 'react';
import { User } from 'lucide-react';
import { childAvatarUrl, adultAvatarUrl } from '../../utils/avatarUrl';

/**
 * Avatar circular.
 *
 * Hierarquia de exibição:
 *   1. photoURL (foto enviada pelo usuário) — se carregar sem erro
 *   2. DiceBear (gerado automaticamente):
 *      - kind='child' → adventurer com gênero (boy/girl seed)
 *      - kind='adult' → initials com nome
 *   3. Fallback final → ícone <User /> com cor de fundo por gênero
 *
 * Props:
 *   - photoURL:  string opcional — URL pública (Firebase Storage)
 *   - gender:    'male' | 'female' | undefined
 *   - kind:      'child' | 'adult' (default: 'child' por compat)
 *   - seed:      string — id estável (childId, uid). Default: '' (gera neutro)
 *   - name:      string — usado em initials pro kind='adult'
 *   - size:      'sm' | 'md' | 'lg' | 'xl'
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

export default function Avatar({
  photoURL,
  gender,
  kind = 'child',
  seed = '',
  name = '',
  size = 'md',
  className = '',
}) {
  const { box, icon } = SIZES[size] || SIZES.md;
  const style = GENDER_STYLES[gender] || GENDER_STYLES.default;

  // Estado de erro pra cair pro fallback em caso de img quebrada
  const [photoError, setPhotoError] = useState(false);
  const [generatedError, setGeneratedError] = useState(false);

  // 1. Foto enviada pelo usuário
  if (photoURL && !photoError) {
    return (
      <div
        className={`${box} rounded-full overflow-hidden shrink-0 bg-gray-100 ${className}`}
      >
        <img
          src={photoURL}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setPhotoError(true)}
        />
      </div>
    );
  }

  // 2. Avatar gerado automaticamente (DiceBear)
  const generatedSrc =
    kind === 'adult'
      ? adultAvatarUrl({ name, seed })
      : childAvatarUrl({ id: seed, gender });

  if (!generatedError) {
    return (
      <div
        className={`${box} rounded-full overflow-hidden shrink-0 bg-gray-100 ${className}`}
      >
        <img
          src={generatedSrc}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setGeneratedError(true)}
        />
      </div>
    );
  }

  // 3. Fallback final — ícone (rede sem internet, DiceBear off etc)
  return (
    <div
      className={`${box} ${style} rounded-full flex items-center justify-center shrink-0 ${className}`}
    >
      <User size={icon} strokeWidth={2.2} />
    </div>
  );
}
