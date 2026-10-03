/**
 * TROCAR DE VERSÃO COM UM TOQUE SÓ (03/10/2026).
 *
 * O dono precisava tocar em "Atualizar" várias vezes até a versão nova
 * aparecer. Eram dois defeitos, um em cada tela:
 *
 *   1. "SAIU UMA VERSÃO NOVA" (ErrorScreen, quando um pedaço da versão antiga
 *      sumiu do servidor) só fazia `location.reload()`. Recarregar NÃO troca o
 *      service worker: enquanto a aba existe, o worker antigo continua no
 *      controle e serve o `index.html` ANTIGO do cache dele — que pede os
 *      mesmos pedaços que já não existem. A tela de erro voltava, e cada toque
 *      era um recarregar inútil, até o navegador resolver trocar sozinho.
 *   2. O AVISO "Tem uma versão nova" mandava o worker em espera assumir — mas
 *      se ainda não houvesse worker em espera (o novo ainda baixando, ou a
 *      checagem ainda não feita), o recado ia para ninguém, o prazo de 8 s
 *      recarregava a versão VELHA, e o aviso voltava.
 *
 * A troca agora é uma só e faz as quatro coisas, na ordem:
 *   - pergunta ao servidor pelo worker mais novo (`update()`);
 *   - espera ele terminar de baixar, se ainda estiver baixando;
 *   - manda ele assumir (`SKIP_WAITING`) e espera o `controllerchange`;
 *   - só então recarrega — e aí a página vem da versão nova.
 * Cada espera tem prazo, e o recarregamento acontece de qualquer jeito: tela
 * de "Atualizando" sem saída é pior que versão velha.
 *
 * Só fala com o worker do APP. O do push mora em outro escopo
 * (`/firebase-cloud-messaging-push-scope`) e não tem nada a ver com a versão.
 */

const PRAZO_BAIXAR_MS = 10000;
const PRAZO_ASSUMIR_MS = 6000;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Espera um worker sair de `installing` (para `installed` ou `redundant`). */
function esperarInstalar(worker, prazo) {
  if (!worker || worker.state !== 'installing') return Promise.resolve();
  return Promise.race([
    new Promise((resolve) => {
      worker.addEventListener('statechange', function aoMudar() {
        if (worker.state !== 'installing') {
          worker.removeEventListener('statechange', aoMudar);
          resolve();
        }
      });
    }),
    esperar(prazo),
  ]);
}

function esperarAssumir(prazo) {
  return Promise.race([
    new Promise((resolve) =>
      navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
    ),
    esperar(prazo),
  ]);
}

let trocando = null;

/** Troca para a versão nova e recarrega. Chamar duas vezes não troca duas vezes. */
export function trocarDeVersao() {
  if (trocando) return trocando;
  trocando = (async () => {
    try {
      const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null;
      const reg = sw ? await sw.getRegistration('/') : null;
      if (reg) {
        try {
          await reg.update();
        } catch {
          // Sem rede para perguntar: segue com o que já foi baixado.
        }
        await esperarInstalar(reg.installing, PRAZO_BAIXAR_MS);
        if (reg.waiting) {
          const assumiu = esperarAssumir(PRAZO_ASSUMIR_MS);
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          await assumiu;
        }
      }
    } catch (err) {
      console.error('trocarDeVersao', err);
    }
    window.location.reload();
  })();
  return trocando;
}
