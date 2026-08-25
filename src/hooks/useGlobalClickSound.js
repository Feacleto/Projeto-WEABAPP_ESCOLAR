import { useEffect } from 'react';
import {
  playSound,
  preloadSounds,
  areSoundsEnabled,
} from '../services/soundService';

/**
 * Listener global que toca `click.mp3` toda vez que o usuário aciona um
 * elemento "tap" — botões, links, chips, cards clicáveis com a classe
 * `.tap`. Hookado no App.jsx pra valer em todas as rotas.
 *
 * Decisões:
 *   - Escuta `click`, e não `pointerdown`.
 *
 *     Era `pointerdown`, com a justificativa de "feedback no momento do
 *     toque". Na prática o som saía ANTES de qualquer coisa acontecer na
 *     tela: entre encostar o dedo e a ação rodar existe o tempo de soltar o
 *     dedo, mais o carregamento da tela nova quando ela é lazy. O som chegava
 *     sozinho, o olho não achava o que ele estava confirmando, e a sensação
 *     era de app atrasado — quando o atrasado era o resto.
 *
 *     `click` dispara no mesmo instante em que o handler do React roda. Som e
 *     ação passam a acontecer juntos, que é o que "responsivo" quer dizer:
 *     não é chegar cedo, é chegar junto.
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
    // O primeiro toque é o único momento em que dá pra aquecer os sons: antes
    // dele o navegador não deixa tocar áudio, e baixar o que não pode ser
    // usado é gastar a rede do motorista à toa.
    let aquecido = false;

    function isInteractive(el) {
      if (!el || typeof el.closest !== 'function') return null;
      // .tap é a classe-âncora que usamos em todo o app pra botões clicáveis
      return el.closest('.tap');
    }

    function aquecer() {
      if (aquecido) return;
      aquecido = true;
      preloadSounds();
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

    // Aquecer no primeiro TOQUE (pointerdown) e tocar no clique são coisas
    // diferentes de propósito: o aquecimento quer o gesto mais cedo possível
    // pra liberar o áudio no navegador; o som quer o instante da ação.
    document.addEventListener('pointerdown', aquecer, true);
    document.addEventListener('click', handler, true);
    return () => {
      document.removeEventListener('pointerdown', aquecer, true);
      document.removeEventListener('click', handler, true);
    };
  }, []);
}
