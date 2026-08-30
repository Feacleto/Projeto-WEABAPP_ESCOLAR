import { useEffect, useMemo } from 'react';
import { primeiroNome } from '../../utils/formatters';
import { PartyPopper, X } from 'lucide-react';
import Avatar from '../common/Avatar';
import { playSound, stopSound } from '../../services/soundService';

const CONFETTI_COLORS = [
  '#f43f5e', // rose
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
];

/**
 * Modal celebrativo com confetti. Toca birthday.mp3 ao abrir.
 *
 * Variantes:
 *   - role="tio":  lista de aniversariantes (1 ou mais crianças)
 *   - role="pai":  mensagem pessoal pro filho do usuário
 *
 * Props:
 *   - children:  array de docs de criança aniversariantes (mín 1)
 *   - onClose:   callback quando o usuário fecha
 *   - role:      'tio' | 'pai'
 */
export default function BirthdayModal({ children = [], onClose, role = 'tio' }) {
  // Confetti — pré-calculado pra não re-randomizar a cada render
  const confetti = useMemo(() => generateConfetti(40), []);

  // A MÚSICA MORRE COM O MODAL.
  //
  // Aqui estava escrito que não havia cleanup necessário "porque toca uma vez
  // só, sem loop". As duas metades da frase são verdade e a conclusão não:
  // sem loop quer dizer que ela não recomeça, não que ela para. O parabéns
  // dura mais que a vontade de ouvi-lo — quem fechava no segundo três seguia
  // com música tocando por cima da rota, sem nenhum botão na tela pra
  // interromper, porque a tela que a iniciou já tinha saído.
  //
  // O cleanup do efeito cobre as duas saídas de uma vez ("Vamos começar" e o
  // X, que chamam o mesmo `onClose`) e mais a que ninguém lembra: trocar de
  // rota com o modal aberto.
  useEffect(() => {
    playSound('birthday');
    return () => stopSound('birthday');
  }, []);

  if (!children.length) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 max-w-mobile mx-auto overflow-hidden">
      {/* Confetti caindo no fundo */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map((c, i) => (
          <i
            key={i}
            className="confetti-piece"
            style={{
              left: `${c.left}%`,
              top: '-20px',
              backgroundColor: c.color,
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Card central */}
      <div className="relative bg-card rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-5 animate-fest-bounce">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-neutro text-textMuted flex items-center justify-center tap"
        >
          <X size={18} />
        </button>

        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 via-rose-500 to-amber-500 text-white flex items-center justify-center shadow-lg">
            <PartyPopper size={32} />
          </div>
        </div>

        {role === 'pai' ? (
          <ParentMessage child={children[0]} />
        ) : (
          <AdminMessage childrenList={children} />
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold tap shadow-lg"
        >
          Vamos comemorar!
        </button>
      </div>
    </div>
  );
}

function ParentMessage({ child }) {
  const first = child.name?.split(' ')[0] || 'a criança';
  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <div className="rounded-full overflow-hidden border-4 border-pink-200">
          <Avatar
            photoURL={child.photoURL}
            gender={child.gender}
            seed={child.id}
            kind="child"
            size="lg"
          />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-text leading-tight">
        Feliz aniversário, {first}! 🎂
      </h2>
      <p className="text-textMuted text-sm">
        Todo o time do Tio Nino deseja um dia incrível pra você.
      </p>
    </div>
  );
}

function AdminMessage({ childrenList }) {
  if (childrenList.length === 1) {
    const c = childrenList[0];
    const first = c.name?.split(' ')[0] || 'A criança';
    return (
      <div className="space-y-3">
        <div className="flex justify-center">
          <div className="rounded-full overflow-hidden border-4 border-pink-200">
            <Avatar
              photoURL={c.photoURL}
              gender={c.gender}
              seed={c.id}
              kind="child"
              size="lg"
            />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-text leading-tight">
          Hoje é aniversário do(a) {first}! 🎂
        </h2>
        <p className="text-textMuted text-sm">
          Que tal dar um parabéns extra na rota hoje?
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-bold text-text leading-tight">
        Hoje tem {childrenList.length} aniversariantes! 🎂
      </h2>
      <div className="flex justify-center gap-2 flex-wrap pt-1">
        {childrenList.slice(0, 6).map((c) => (
          <div
            key={c.id}
            className="rounded-full overflow-hidden border-2 border-pink-200"
          >
            <Avatar
              photoURL={c.photoURL}
              gender={c.gender}
              seed={c.id}
              kind="child"
              size="md"
            />
          </div>
        ))}
      </div>
      <ul className="text-sm text-text space-y-0.5">
        {childrenList.map((c) => (
          <li key={c.id}>
            <span className="font-semibold">{primeiroNome(c.name, 'A criança')}</span>
            <span className="text-textMuted"> — {c.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function generateConfetti(count) {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    duration: 2.5 + Math.random() * 2.5,
    delay: Math.random() * 2,
    color:
      CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  }));
}
