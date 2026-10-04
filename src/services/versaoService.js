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
 *
 * ⚠️ 04/10/2026: O TOQUE AINDA PODIA VOLTAR PARA A VERSÃO VELHA, e o teste no
 * navegador provou. Com o aviso aberto, sai OUTRA publicação: o `update()`
 * acha a mais nova baixando, o prazo de 10 s acabava antes (no celular,
 * baixar 2,6 MB passa disso fácil), o recado ia para o worker do meio e a
 * página recarregava na versão ANTIGA. Agora:
 *   - espera o download do mais novo até 90 s, mostrando "Baixando";
 *   - repete se, no meio, aparecer um worker ainda mais novo (até 3 vezes);
 *   - só recarrega depois de o worker novo assumir;
 *   - e depois do recarregamento, se o app ainda não está na versão do
 *     servidor, CONTINUA a troca sozinho, na mesma tela de "Atualizando" —
 *     o aviso não volta a aparecer como se nada tivesse acontecido.
 */

import { APP_VERSION } from '../version';

const PRAZO_BAIXAR_MS = 90000;
const PRAZO_ASSUMIR_MS = 8000;
const TENTATIVAS = 3;
const CHAVE_DA_TROCA = 'alobuzinou:trocandoDeVersao';

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

/** Espera o worker novo assumir a página. `true` se assumiu dentro do prazo. */
function esperarAssumir(prazo) {
  return Promise.race([
    new Promise((resolve) =>
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(true), { once: true })
    ),
    esperar(prazo).then(() => false),
  ]);
}

/**
 * Faz o worker MAIS NOVO assumir. Se, enquanto um assume, outro mais novo
 * começar a baixar (outra publicação), volta e espera esse — até 3 vezes.
 */
async function fazerOMaisNovoAssumir(reg) {
  for (let i = 0; i < TENTATIVAS; i += 1) {
    if (reg.installing) {
      mudarEtapa('baixando');
      await esperarInstalar(reg.installing, PRAZO_BAIXAR_MS);
    }
    const esperando = reg.waiting;
    if (!esperando) return;
    mudarEtapa('instalando');
    const assumiu = esperarAssumir(PRAZO_ASSUMIR_MS);
    esperando.postMessage({ type: 'SKIP_WAITING' });
    const ok = await assumiu;
    if (ok && !reg.waiting && !reg.installing) return;
  }
}

/** O que a troca em curso quer alcançar, guardado para depois do recarregamento. */
function lerTroca() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_DA_TROCA) || 'null');
  } catch {
    return null;
  }
}
function gravarTroca(valor) {
  try {
    if (valor) sessionStorage.setItem(CHAVE_DA_TROCA, JSON.stringify(valor));
    else sessionStorage.removeItem(CHAVE_DA_TROCA);
  } catch {
    /* sem armazenamento: só não continua sozinho depois de recarregar */
  }
}

/**
 * AS ETAPAS DA TROCA, PARA A TELA MOSTRAR (03/10/2026, pedido do dono).
 *
 * A tela dizia só "Atualizando o app" com uma barra correndo, e quem olha não
 * sabia se aquilo andava. Agora cada passo de verdade da troca vira uma
 * etapa — a tela marca a que terminou e a que está em curso. São as mesmas
 * quatro coisas da lista acima, na mesma ordem: nada aqui é encenado.
 */
export const ETAPAS_DA_TROCA = [
  { id: 'procurando', rotulo: 'Procurando a versão nova' },
  { id: 'baixando', rotulo: 'Baixando' },
  { id: 'instalando', rotulo: 'Instalando' },
  { id: 'abrindo', rotulo: 'Abrindo o app de novo' },
];

const ouvintes = new Set();
let etapaAtual = null;

function mudarEtapa(id) {
  etapaAtual = id;
  ouvintes.forEach((fn) => fn(id));
}

/** Escuta a etapa da troca. Devolve a função de parar. */
export function ouvirEtapaDaTroca(fn) {
  ouvintes.add(fn);
  if (etapaAtual) fn(etapaAtual);
  return () => ouvintes.delete(fn);
}

/**
 * O número da versão que está no servidor — o app antigo não o conhece, e o
 * build publica `/versao.json` para isto (ver vite.config.js). `cache:
 * 'no-store'` e o worker não guarda .json, então a resposta é a de agora.
 * Sem rede ou sem arquivo (o `npm run dev` não gera), devolve null e a tela
 * diz "versão nova" sem número.
 *
 * Devolve `{ versao, data, commit, hash }` — a data é a do build publicado.
 */
export async function buscarVersaoNova() {
  try {
    const controle = new AbortController();
    const prazo = setTimeout(() => controle.abort(), 4000);
    const res = await fetch(`/versao.json?t=${Date.now()}`, {
      cache: 'no-store',
      signal: controle.signal,
    });
    clearTimeout(prazo);
    if (!res.ok) return null;
    const json = await res.json();
    if (typeof json?.versao !== 'string') return null;
    return {
      versao: json.versao,
      data: typeof json.data === 'string' ? json.data : null,
      commit: json.commit || null,
      hash: json.hash || null,
    };
  } catch {
    return null;
  }
}

let trocando = null;

/** Troca para a versão nova e recarrega. Chamar duas vezes não troca duas vezes. */
export function trocarDeVersao() {
  if (trocando) return trocando;
  trocando = (async () => {
    try {
      mudarEtapa('procurando');
      const nova = await buscarVersaoNova();
      const antes = lerTroca();
      gravarTroca({
        alvo: nova?.versao || antes?.alvo || null,
        tentativa: (antes?.tentativa || 0) + 1,
      });
      const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null;
      const reg = sw ? await sw.getRegistration('/') : null;
      if (reg) {
        try {
          await reg.update();
        } catch {
          // Sem rede para perguntar: segue com o que já foi baixado.
        }
        await fazerOMaisNovoAssumir(reg);
      }
    } catch (err) {
      console.error('trocarDeVersao', err);
    }
    mudarEtapa('abrindo');
    // Um respiro para a última etapa aparecer marcada antes de a tela sumir.
    await esperar(400);
    window.location.reload();
  })();
  return trocando;
}

/**
 * DEPOIS DE RECARREGAR: a troca chegou? Se o app ainda não está na versão que
 * a troca buscava, continua sozinho (até 3 tentativas no total), na mesma tela
 * de "Atualizando". Chegou, ou desistiu: limpa e segue. Devolve se continuou.
 */
export function continuarTrocaSePreciso() {
  const troca = lerTroca();
  if (!troca) return false;
  const chegou = !troca.alvo || troca.alvo === APP_VERSION;
  if (chegou || troca.tentativa >= TENTATIVAS) {
    gravarTroca(null);
    return false;
  }
  trocarDeVersao();
  return true;
}
