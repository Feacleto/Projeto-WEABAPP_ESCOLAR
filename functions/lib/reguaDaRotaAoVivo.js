/**
 * OS DOIS AVISOS DA ROTA QUE NASCEM NO SERVIDOR — a régua (03/10/2026).
 *
 * ── "ESTÁ CHEGANDO" VIROU NOTIFICAÇÃO
 * Era só um toast na tela da mãe, e só se o app estivesse aberto NO INÍCIO:
 * com o celular na bolsa, nada tocava — e é exatamente o momento em que ela
 * precisa. Agora o celular do motorista grava a FAIXA (como sempre) e o
 * servidor, ao ver a faixa mudar, escreve a notificação — que
 * vira push com o app fechado e aviso na tela com o app aberto.
 *
 * ── A BUZINA COM O APP FECHADO
 * A tela cheia que toca só existe com o app aberto. Fechado, a buzina não
 * chegava a lugar nenhum. Agora cada chamada também vira notificação.
 *
 * ⚠️ A FAIXA SAIU DE `rides/{dia}` PARA `children/{id}/proximidade/atual`
 * (03/10/2026): o gatilho escutava `rides` e acordava a cada marco e a cada
 * previsão só para sair na primeira linha. O documento novo é um por criança,
 * não por dia — e `zonaAnteriorDoDia` é o que impede a faixa de ontem de
 * contar como "anterior" hoje (a primeira faixa do dia nunca avisa, como
 * quando cada dia tinha o seu documento).
 *
 * `avisoDeAproximacao` ESPELHA `src/dominio/rota/proximidade.js` — o deploy
 * das functions não alcança `src/`; `npm run testar:notificacoes` compara os
 * dois caso a caso. `fraseDaBuzina` espelha `src/dominio/rota/buzina.js`.
 *
 * PURA: sem `require`.
 */

'use strict';

const ORDEM_DA_ZONA = { longe: 0, perto: 1, chegou: 2 };

function avisoDeAproximacao({ anterior, atual, statusDaCrianca }) {
  if (statusDaCrianca !== 'home' && statusDaCrianca !== 'onboard') return null;
  if (!(anterior in ORDEM_DA_ZONA) || !(atual in ORDEM_DA_ZONA)) return null;
  if (ORDEM_DA_ZONA[atual] <= ORDEM_DA_ZONA[anterior]) return null;
  return atual === 'longe' ? null : atual;
}

/**
 * A faixa ANTERIOR que vale para comparar: a do documento de antes, se for do
 * MESMO dia. De outro dia, ou sem documento, é "nenhuma".
 */
function zonaAnteriorDoDia(antes, depois) {
  if (!antes || !depois || !antes.dateKey || antes.dateKey !== depois.dateKey) return null;
  return antes.zona || null;
}

function primeiro(nome, reserva) {
  return String(nome || '').trim().split(/\s+/)[0] || reserva;
}

/**
 * O texto do "está chegando". `quem` é a MARCA do motorista ("Tio Zé"), como
 * a família o chama — nunca o nome civil do contrato.
 */
function textoDaAproximacao({ zona, quem, nomeDaCrianca, statusDaCrianca }) {
  const motorista = String(quem || '').trim() || 'A perua';
  const crianca = primeiro(nomeDaCrianca, 'a criança');
  const entrega = statusDaCrianca === 'onboard';
  if (zona === 'chegou') {
    return {
      type: 'perua_chegou',
      title: `${motorista} chegou`,
      body: entrega
        ? `A perua está na porta com ${crianca}.`
        : `A perua está na porta para buscar ${crianca}.`,
    };
  }
  return {
    type: 'perua_chegando',
    title: `${motorista} está chegando`,
    body: entrega
      ? `A perua está perto, trazendo ${crianca}.`
      : `A perua está perto. Hora de descer com ${crianca}.`,
  };
}

function fraseDaBuzina({ momento, nomeDaCrianca }) {
  const nome = primeiro(nomeDaCrianca, 'a criança');
  return momento === 'entregar'
    ? `O motorista está na porta para entregar ${nome}. Pode descer?`
    : `O motorista está na porta para buscar ${nome}. Pode descer?`;
}

function textoDaBuzina({ quem, momento, nomeDaCrianca }) {
  const motorista = String(quem || '').trim() || 'O motorista';
  return {
    type: 'buzina',
    title: `${motorista} está na porta`,
    body: fraseDaBuzina({ momento, nomeDaCrianca }),
  };
}

module.exports = {
  ORDEM_DA_ZONA,
  avisoDeAproximacao,
  zonaAnteriorDoDia,
  textoDaAproximacao,
  fraseDaBuzina,
  textoDaBuzina,
};
