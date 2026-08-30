import { useState } from 'react';
import { User, Bus } from 'lucide-react';
import {
  childAvatarUrl,
  adultAvatarUrl,
  adminAvatarUrl,
} from '../../utils/avatarUrl';

/**
 * Avatar circular.
 *
 * Hierarquia de exibição:
 *   1. photoURL (foto enviada pelo usuário) — se carregar sem erro
 *   2. Default por tipo:
 *      - kind='child'  → avatar no traço do Notion, paleta suave
 *      - kind='adult'  → mesmo traço, paleta fria e sóbria
 *      - kind='admin'  → mesmo traço, paleta do esmeralda da marca
 *   3. Fallback final → ícone genérico com cor de fundo
 *
 * Props:
 *   - photoURL:  string opcional — URL pública (Firebase Storage)
 *   - gender:    'male' | 'female' | undefined — vale pros três kinds
 *   - kind:      'child' | 'adult' | 'admin' (default: 'child' por compat)
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
        className={`${box} rounded-full overflow-hidden shrink-0 bg-neutro ${className}`}
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

  // 2. Avatar gerado, no traço do Notion. TODOS os três públicos passam
  // por aqui.
  //
  // Antes o motorista caía num ícone de van e o responsável numa letra
  // dentro de um círculo: os dois adultos do app não tinham rosto. Num app
  // em que a relação entre eles é o produto, isso importa — o pai vê "quem"
  // está levando o filho dele, não um pictograma de veículo.
  // `gender` vale pros TRÊS públicos agora. Antes só a criança recebia, e
  // os dois adultos do app saíam com rosto sorteado — inclusive o do próprio
  // motorista, que ele vê no canto de toda tela.
  const generatedSrc =
    kind === 'admin'
      ? adminAvatarUrl({ name, seed, gender })
      : kind === 'adult'
        ? adultAvatarUrl({ name, seed, gender })
        : childAvatarUrl({ id: seed, gender });

  if (!generatedError) {
    return (
      <div
        className={`${box} rounded-full overflow-hidden shrink-0 bg-neutro ${className}`}
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

  // 3. Último recurso: sem internet ou DiceBear fora do ar. Ícone, mas
  // ainda diferenciando o motorista — a van some só quando não há
  // alternativa nenhuma.
  const FallbackIcon = kind === 'admin' ? Bus : User;
  return (
    <div
      className={`${box} ${style} rounded-full flex items-center justify-center shrink-0 ${className}`}
    >
      <FallbackIcon size={icon} strokeWidth={2.2} />
    </div>
  );
}
