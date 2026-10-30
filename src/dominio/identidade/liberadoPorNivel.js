/**
 * O QUE CADA NÍVEL LIBERA NA TELA — regra pura, sem Firebase.
 *
 * Os níveis (`nivel.js`) ensinam o app com missões; este arquivo decide o que
 * APARECE. O nível 1 é enxuto e o resto chega quando ele sobe, como se fosse
 * uma atualização do app (pedido do dono, 30/10/2026).
 *
 * ⚠️ MORA FORA DE `nivel.js` DE PROPÓSITO. Aquele arquivo tem espelho no
 * servidor (`functions/lib/reguaDoNivel.js`) e `npm run testar:nivel` compara
 * os dois caso a caso. Isto aqui é só tela: o servidor não esconde nada.
 *
 * ⚠️ NUNCA ESCONDA O QUE UMA MISSÃO PEDE. Se a missão de um nível pede para
 * usar um recurso, esse recurso tem que estar visível NAQUELE nível — senão a
 * missão é impossível e ele trava. `npm run testar:liberado` confere isso
 * contra o catálogo de missões.
 *
 * ⚠️ NÃO REGRIDE. Quem lê o nível é `niveis/{uid}`, e o servidor nunca grava
 * abaixo do Ouro quem já chegou nele (o piso de `nivel.js`). Platina e Diamante
 * oscilam, mas os dois são acima do Ouro — o recurso não some.
 *
 * É esconder da TELA, não proteger dado: a Comunidade não guarda nada que as
 * rules não escopem. Mesma doutrina de `STORAGE_ENABLED`.
 */
import { NIVEIS } from './nivel.js';

/**
 * O nível a partir do qual cada recurso aparece, e a rota dele. A rota existe
 * para o teste cruzar com o `destino` das missões.
 */
export const LIBERA_NO = {
  comunidade: { nivel: 'ouro', rota: '/tio/comunidade' },
};

/**
 * O recurso aparece neste nível? Nível desconhecido ou ausente é o mais baixo
 * (`sem_nivel`): o erro barato é esconder por um instante; o caro é mostrar a
 * quem ainda não chegou. Recurso que não está na lista nunca é escondido.
 */
export function liberado(recurso, nivel) {
  const regra = LIBERA_NO[recurso];
  if (!regra) return true;
  const atual = NIVEIS.indexOf(nivel);
  if (atual < 0) return false;
  return atual >= NIVEIS.indexOf(regra.nivel);
}
