import { useState } from 'react';
import { User } from 'lucide-react';
import { childAvatarUrl } from '../../marca/avatarUrl';

/**
 * O rosto de uma criança dentro de uma vaga da perua (05/10/2026).
 *
 * ⚠️ É SEMPRE O AVATAR DESENHADO (decisão do dono): a perua mostra a turma
 * inteira de uma vez, e o desenho é igual para toda criança — nenhuma tela
 * da perua convida a mandar imagem de ninguém. Por isso ele não recebe nada
 * além do id e do gênero, que é o que sorteia e penteia o `adventurer`.
 */
export default function RostoDaVaga({ crianca, className = '' }) {
  const [erro, setErro] = useState(false);
  if (erro) {
    return (
      <span className={`flex items-center justify-center text-textMuted ${className}`} aria-hidden="true">
        <User size={18} />
      </span>
    );
  }
  return (
    <img
      src={childAvatarUrl({ id: crianca?.id, gender: crianca?.gender })}
      alt=""
      loading="lazy"
      onError={() => setErro(true)}
      className={`rounded-full object-cover ${className}`}
    />
  );
}
