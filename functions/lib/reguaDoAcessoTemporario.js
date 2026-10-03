/**
 * O ACESSO DE 24 HORAS DO SEGUNDO RESPONSÁVEL — a régua (03/10/2026).
 *
 * ── O PROBLEMA
 * `parent2Name` e `parent2Phone` eram só contato: o pai separado, a avó que
 * busca às quintas, ficavam fora do app. E não havia caminho certo para
 * entrar — abrir o link do convite antes da mãe o tornava O responsável da
 * criança, com contrato, mensalidade e tudo.
 *
 * ── A DECISÃO (do dono): UMA CONTA TEMPORÁRIA DE 24 HORAS
 * Não é uma conta no Firebase. É um LINK que vale 24 horas a partir de quando
 * foi gerado, mandado pelo WhatsApp ao número do segundo responsável. Com ele
 * a pessoa vê o dia da criança (o mesmo recorte da página `/acompanhar`) e,
 * se aceitar, recebe no celular os avisos da ROTA daquela criança. Passadas
 * as 24 horas, o link para de abrir e os avisos param — sem ninguém precisar
 * lembrar de desligar.
 *
 *   - Quem gera: a responsável titular ou o motorista da criança.
 *   - Um por criança: gerar de novo encerra o anterior (o link velho morre).
 *   - O que ele NUNCA vê: endereço, telefone, mensalidade, contrato, saúde, a
 *     perua no mapa. É o recorte fechado de `reguaDoAcompanhamento`.
 *   - O que ele recebe: só avisos de ROTA (lista abaixo). Dinheiro e
 *     contrato são da titular.
 *
 * PURA: sem `require`. `npm run testar:acompanhamento` a mede.
 */

'use strict';

const DURACAO_DO_ACESSO_MS = 24 * 60 * 60 * 1000;

/** O que chega ao celular de quem tem o acesso de 24h. */
const TIPOS_DO_ACESSO_TEMPORARIO = [
  'rota_iniciada',
  'proxima_parada',
  'perua_chegando',
  'perua_chegou',
  'buzina',
  'child_onboard',
  'child_arrived_school',
  'child_arrived_home',
  'nao_embarcou',
  'rota_atrasada',
];

/** Aparelhos por acesso — o bastante para um celular e um tablet. */
const MAXIMO_DE_APARELHOS = 3;

/** O prefixo que separa o token de 24h do token do "quem busca hoje". */
const PREFIXO = 't_';

function emMs(valor) {
  if (!valor) return null;
  if (typeof valor === 'number') return valor;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor.seconds === 'number') return valor.seconds * 1000;
  return null;
}

/** Vale agora? Não revogado e antes do fim. Sem data de fim, NÃO vale. */
function acessoTemporarioValendo(acesso, agora = Date.now()) {
  if (!acesso || acesso.revogadoEm) return false;
  const fim = emMs(acesso.expiraEm);
  return fim != null && agora < fim;
}

/** Lê `t_{id}.{segredo}`; qualquer outra forma é `null`. */
function lerTokenTemporario(bruto) {
  const texto = String(bruto || '').trim();
  if (!texto.startsWith(PREFIXO)) return null;
  const ponto = texto.indexOf('.');
  if (ponto < 0 || ponto === texto.length - 1) return null;
  const id = texto.slice(PREFIXO.length, ponto);
  const segredo = texto.slice(ponto + 1);
  if (!/^[A-Za-z0-9_-]{10,60}$/.test(id) || segredo.length > 200) return null;
  return { id, segredo };
}

/** Quem pode gerar ou encerrar: a titular ou o motorista DA criança. */
function podeGerar({ uid, crianca }) {
  if (!uid || !crianca) return false;
  return crianca.parentUid === uid || crianca.adminUid === uid;
}

/** A mensagem do WhatsApp. Sem endereço, sem horário: só quem e por quanto tempo. */
function mensagemDoAcesso({ nomeDoSegundo, nomeDaCrianca, link }) {
  const quem = String(nomeDoSegundo || '').trim().split(/\s+/)[0];
  const crianca = String(nomeDaCrianca || '').trim().split(/\s+/)[0] || 'a criança';
  return (
    `${quem ? `Olá, ${quem}! ` : 'Olá! '}` +
    `Este link mostra o dia de ${crianca} na perua escolar (saída, chegada na escola e em casa). ` +
    `Ele vale por 24 horas: ${link}`
  );
}

module.exports = {
  DURACAO_DO_ACESSO_MS,
  TIPOS_DO_ACESSO_TEMPORARIO,
  MAXIMO_DE_APARELHOS,
  PREFIXO,
  acessoTemporarioValendo,
  lerTokenTemporario,
  podeGerar,
  mensagemDoAcesso,
};
