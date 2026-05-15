import { useEffect } from 'react';
import { playSound, areSoundsEnabled } from '../services/soundService';

/**
 * Listener global que toca `click.mp3` toda vez que o usuário aciona um
 * elemento "tap" — botões, links, chips, cards clicáveis com a classe
 * `.tap`. Hookado no App.jsx pra valer em todas as rotas.
 *
 * Decisões:
 *   - Escuta `pointerdown` (não `click`) — feedback acontece no MOMENTO
 *     do toque, antes de soltar o dedo. Sensação mais responsiva.
 *   - Só toca se o usuário tem sons habilitados no Profile.
 *   - Usa event capture (true) pra pegar antes do React; assim o som
 *     toca mesmo quando o handler do botão chama stopPropagation.
 *   - Ignora elementos disabled e dentro de elementos editáveis (input,
 *     textarea) pra não gerar barulho ao digitar.
 *   - Throttle implícito via reset do áudio (mesmo elemento Audio é
 *     reusado pelo soundService) — cliques rápidos não acumulam.
 */
export function useGlobalClickSound() {
  useEffect(() => {
    function isInteractive(el) {
      if (!el || typeof el.closest !== 'function') return null;
      // .tap é a classe-âncora que usamos em todo o app pra botões clicáveis
      return el.closest('.tap');
    }

    function handler(e) {
      if (!areSoundsEnabled()) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const tap = isInteractive(target);
      if (!tap) return;
      // Disabled (aria ou prop) não toca
      if (tap.getAttribute('aria-disabled') === 'true') return;
      if (tap.disabled) return;
      playSound('click');
    }

    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, []);
}
