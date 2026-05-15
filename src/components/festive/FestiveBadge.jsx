import { useEffect, useRef, useState } from 'react';
import { getFestivityForDate } from '../../utils/festivities';
import { getSound, stopSound, areSoundsEnabled } from '../../services/soundService';

/**
 * Bolinha animada festiva ao lado da saudação. Tema vem do mês corrente
 * (Halloween em outubro, Natal nov/dez etc — ver utils/festivities.js).
 *
 * Comportamento ao clicar:
 *   - Abre um balão explicativo posicionado abaixo da bolinha com
 *     emoji + saudação ("Feliz Dia das Mães!") + frase de contexto.
 *     Isso responde à pergunta "por que essa bolinha está aqui?".
 *   - Se o tema tem som (Páscoa/Halloween/Natal), o som começa quando
 *     o balão abre e para quando o balão fecha. Clicar de novo na
 *     bolinha alterna abrir/fechar.
 *   - Clique fora do balão também fecha (e para o som).
 *
 * Quando os sons estão globalmente desativados (sino mudo no Profile),
 * o balão ainda abre, só sem áudio.
 */
export default function FestiveBadge({ date = new Date() }) {
  const theme = getFestivityForDate(date);
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const audioRef = useRef(null);
  const wrapperRef = useRef(null);
  const themeKey = theme?.key;

  // Reseta tudo quando o tema do mês muda (virada do mês com app aberto)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
    audioRef.current = null;
  }, [themeKey]);

  // Para o som ao desmontar
  useEffect(() => {
    return () => {
      if (theme?.sound) stopSound(theme.sound);
    };
  }, [theme?.sound]);

  // Click outside — fecha balão e para som
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        if (theme?.sound) stopSound(theme.sound);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [open, theme?.sound]);

  if (!theme) return null;

  const startSound = () => {
    if (!theme.sound || !areSoundsEnabled()) return;
    const audio = getSound(theme.sound);
    if (!audio) return;
    audio.loop = true;
    audioRef.current = audio;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
  };

  const onClick = () => {
    setPop(true);
    setTimeout(() => setPop(false), 350);

    if (open) {
      if (theme.sound) stopSound(theme.sound);
      setOpen(false);
    } else {
      setOpen(true);
      startSound();
    }
  };

  const closeFromBalloon = () => {
    if (theme.sound) stopSound(theme.sound);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={onClick}
        aria-label={theme.label}
        aria-expanded={open}
        title={theme.label}
        className={`w-10 h-10 rounded-full bg-gradient-to-br ${theme.gradient} text-white text-xl shadow-lg flex items-center justify-center tap ${theme.animation} ${
          pop ? 'scale-125' : ''
        } transition-transform`}
      >
        <span aria-hidden>{theme.emoji}</span>
      </button>

      {open && (
        <Balloon theme={theme} onClose={closeFromBalloon} />
      )}
    </div>
  );
}

/**
 * Balão posicionado à direita da bolinha, com seta apontando.
 * Right-align porque a bolinha fica no canto direito da saudação — abrir
 * pra esquerda evita estourar a borda da tela.
 */
function Balloon({ theme, onClose }) {
  return (
    <div
      role="dialog"
      aria-label={theme.greeting}
      className="absolute top-12 right-0 z-50 w-64 origin-top-right animate-fest-balloon-in"
    >
      {/* Seta apontando pra bolinha */}
      <div
        aria-hidden
        className="absolute -top-2 right-3 w-4 h-4 bg-card rotate-45 shadow-md"
      />
      <div className="relative bg-card rounded-2xl shadow-2xl border border-gray-100 p-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${theme.gradient} text-white text-2xl flex items-center justify-center shrink-0 shadow-md`}
          >
            <span aria-hidden>{theme.emoji}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-text leading-tight">
              {theme.greeting}
            </p>
            <p className="text-xs text-textMuted mt-1 leading-relaxed">
              {theme.subtitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="tap mt-3 w-full text-xs font-semibold text-primary py-1.5 rounded-lg hover:bg-gray-50"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
