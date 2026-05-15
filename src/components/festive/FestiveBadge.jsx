import { useEffect, useRef, useState } from 'react';
import { getFestivityForDate } from '../../utils/festivities';
import { getSound, stopSound, areSoundsEnabled } from '../../services/soundService';

/**
 * Bolinha animada festiva ao lado da saudação. Tema vem do mês corrente
 * (Halloween em outubro, Natal nov/dez etc — ver utils/festivities.js).
 *
 * Comportamento de áudio (quando o tema tem som):
 *   - 1º clique: toca o som em loop
 *   - 2º clique: para o som
 *   - 3º clique: toca de novo
 * Para meses sem som dedicado, o clique só dispara uma animação extra.
 *
 * Quando os sons estão globalmente desativados (sino mudo no Profile),
 * a bolinha continua aparecendo mas o clique não faz nada de áudio.
 *
 * Renderização: separada do texto da saudação — fica em flex ao lado.
 */
export default function FestiveBadge({ date = new Date() }) {
  const theme = getFestivityForDate(date);
  const [playing, setPlaying] = useState(false);
  const [pop, setPop] = useState(false);
  const audioRef = useRef(null);
  const themeKey = theme?.key;

  // Reseta o estado quando o tema do mês trocar (ex: virada do mês com
  // app aberto). Para o som anterior também.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaying(false);
    audioRef.current = null;
  }, [themeKey]);

  // Para o som quando o componente desmonta
  useEffect(() => {
    return () => {
      if (theme?.sound) stopSound(theme.sound);
    };
  }, [theme?.sound]);

  if (!theme) return null;

  const onClick = () => {
    // Anima um "pop" extra pra dar feedback de toque
    setPop(true);
    setTimeout(() => setPop(false), 350);

    if (!theme.sound || !areSoundsEnabled()) return;

    if (playing) {
      stopSound(theme.sound);
      setPlaying(false);
      return;
    }
    const audio = getSound(theme.sound);
    if (!audio) return;
    audio.loop = true;
    audioRef.current = audio;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
    setPlaying(true);

    // Quando o áudio terminar naturalmente (caso loop seja desligado), reseta
    audio.onended = () => setPlaying(false);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={theme.label}
      title={theme.label}
      className={`shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${theme.gradient} text-white text-xl shadow-lg flex items-center justify-center tap ${theme.animation} ${
        pop ? 'scale-125' : ''
      } transition-transform`}
    >
      <span aria-hidden>{theme.emoji}</span>
    </button>
  );
}
