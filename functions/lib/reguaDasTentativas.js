/**
 * QUANTAS VEZES ALGUÉM PODE TENTAR (03/10/2026) — régua pura.
 *
 * As portas públicas (a prévia e a consulta do convite, o formulário de
 * investidor) e o pedido de acesso pelo telefone respondiam a quantas
 * chamadas viessem. O teto de instâncias (`limites.js`) limita o CUSTO de um
 * laço, não a quantidade de tentativas de quem está varrendo códigos ou
 * telefones. Esta régua decide; quem conta é `limiteDeTentativas.js`, numa
 * coleção só do servidor (`limitesDeTentativa/{chave}`), que as rules negam
 * ao cliente por padrão — se o cliente alcançasse, zeraria o próprio
 * contador.
 *
 * ── A CHAVE É `{escopo}_{quem}_{janela}`
 * `quem` chega JÁ RESUMIDO (sha256 do IP ou o uid): o IP cru não vai para o
 * banco. `janela` é o número da hora (ou do dia) — passar a hora abre uma
 * chave nova, e a anterior fica para o TTL de `expiraEm` apagar.
 *
 * ── ⚠️ NA PRÉVIA DO CONVITE SÓ O ERRO CONTA
 * Operadora de celular põe milhares de pessoas atrás do mesmo IP (CGNAT), e o
 * link do convite é o caminho mais percorrido do app — a mãe toca nele toda
 * semana. Contar todo acesso trancaria famílias inteiras às 6h40. Quem varre
 * erra quase sempre; quem é família acerta. Por isso a prévia e a consulta
 * contam só os códigos que não abriram.
 *
 * PURA: sem `require` (ver `npm run testar:imports`).
 */

'use strict';

const HORA_MS = 60 * 60 * 1000;
const DIA_MS = 24 * HORA_MS;

const REGRAS = Object.freeze({
  // Códigos que não abriram, por IP, na prévia e na consulta do convite.
  CONVITE_PUBLICO: Object.freeze({ escopo: 'convite', max: 30, janelaMs: HORA_MS }),
  // Pedidos de acesso pelo telefone, por conta.
  PEDIDO_DE_ACESSO: Object.freeze({ escopo: 'pedido', max: 5, janelaMs: DIA_MS }),
  // Contatos do formulário de investidor, por IP.
  INVESTIDOR: Object.freeze({ escopo: 'investidor', max: 5, janelaMs: HORA_MS }),
  // Links da substituta de um dia que não abriram (token mal formado ou
  // segredo errado), por IP. O link certo que morreu NÃO conta: é a própria
  // substituta relendo a página depois da rota (reguaDaSubstitutaDeUmDia.js).
  SUBSTITUTA_PUBLICA: Object.freeze({ escopo: 'substituta', max: 30, janelaMs: HORA_MS }),
});

const MENSAGEM_DE_LIMITE = 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';

function janelaDe(agoraMs, janelaMs) {
  return Math.floor(agoraMs / janelaMs);
}

function chaveDaTentativa({ regra, quem, agoraMs }) {
  const limpo = String(quem || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'anonimo';
  return `${regra.escopo}_${limpo}_${janelaDe(agoraMs, regra.janelaMs)}`;
}

/** Quando a janela desta chave termina (é o `expiraEm` do documento). */
function fimDaJanelaMs({ regra, agoraMs }) {
  return (janelaDe(agoraMs, regra.janelaMs) + 1) * regra.janelaMs;
}

/** Ainda cabe mais uma tentativa com `contagem` já gasta? */
function cabeMaisUma({ regra, contagem }) {
  return (Number(contagem) || 0) < regra.max;
}

/**
 * O IP de quem chamou.
 *
 * `ip` é o que o Express resolveu (`req.ip`); sem ele, o primeiro salto do
 * `x-forwarded-for`.
 * ⚠️ O PRIMEIRO SALTO PODE SER ESCRITO POR QUEM CHAMA — este limite segura o
 * laço ingênuo, não um atacante que troca o cabeçalho a cada chamada. Quem
 * responde "esta chamada veio do app?" é o App Check (`LIMITES.APP_CHECK`).
 * Preferimos isso a usar o último salto: atrás do proxy, o último pode ser o
 * IP do próprio Google, e aí TODA família cairia na mesma chave.
 */
function ipDaRequisicao({ ip, headers } = {}) {
  if (ip) return String(ip);
  const xff = headers?.['x-forwarded-for'];
  const primeiro = String(Array.isArray(xff) ? xff[0] : xff || '').split(',')[0].trim();
  return primeiro || 'desconhecido';
}

/**
 * O MESMO CONTATO DE NOVO (formulário de investidor). Quem manda duas vezes
 * no mesmo mês recebe "ok", mas não vira documento nem aviso novo: o dono
 * já tem o contato, e cada reenvio era mais uma notificação no sino dele.
 */
const DIAS_PARA_REPETIR_CONTATO = 30;

function contatoRepetido({ criadosEmMs = [], agoraMs, dias = DIAS_PARA_REPETIR_CONTATO }) {
  const corte = agoraMs - dias * DIA_MS;
  return criadosEmMs.some((ms) => Number.isFinite(ms) && ms >= corte);
}

module.exports = {
  DIAS_PARA_REPETIR_CONTATO,
  contatoRepetido,
  REGRAS,
  MENSAGEM_DE_LIMITE,
  janelaDe,
  chaveDaTentativa,
  fimDaJanelaMs,
  cabeMaisUma,
  ipDaRequisicao,
};
