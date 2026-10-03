/**
 * A SENHA DO FINANCEIRO, DO LADO DO SERVIDOR (03/10/2026) — régua pura.
 *
 * Espelho em CommonJS de `src/dominio/identidade/tecladoDeBanco.js`: o deploy
 * das functions não alcança `src/`, então a regra existe duas vezes e
 * `npm run testar:senha-financeiro` compara as duas caso a caso (as 10 mil
 * senhas contra pares gerados).
 *
 * ── POR QUE AS 16 CANDIDATAS
 * O servidor guarda só o HASH da senha (scrypt com sal, em
 * `senhasDoFinanceiro/{uid}`), e o celular manda os PARES tocados no teclado,
 * nunca a senha. Com hash não dá para perguntar "a senha cabe nestes pares?".
 * Mas cada par tem dois números, então quatro pares descrevem exatamente
 * 2^4 = 16 senhas possíveis: o servidor calcula o hash de cada uma e compara.
 * É barato e mantém o banco sem nada reversível.
 * ⚠️ O preço disso é conhecido: um acerto por pares vale 1 em 16 do espaço,
 * não 1 em 10 mil — por isso o limite de tentativas abaixo é curto.
 *
 * ── AS TENTATIVAS
 * 5 erros seguidos trancam a conferência por 60 s. O acerto zera. O contador
 * mora no próprio `senhasDoFinanceiro/{uid}` (que nenhum cliente lê nem
 * escreve), e não em `limitesDeTentativa`: aquela coleção conta por JANELA
 * fixa de hora, e aqui a regra é "trava por um minuto a partir do 5º erro" e
 * "o acerto zera" — formas diferentes que não cabem na mesma chave.
 *
 * PURA: sem `require` (ver `npm run testar:imports`). O hash mora em
 * `senhaDoFinanceiro.js`.
 */

'use strict';

const DIGITOS_DA_SENHA = 4;
const MAX_ERROS = 5;
const ESPERA_MS = 60 * 1000;
// "Esqueci a senha" / "trocar": a tela reautentica antes, e o servidor só
// aceita sobrescrever uma senha existente com um login destes últimos minutos.
const LOGIN_RECENTE_MS = 5 * 60 * 1000;

/** Quatro números, nada mais. */
function formatoValido(senha) {
  return typeof senha === 'string' && /^\d{4}$/.test(senha);
}

/** Tudo igual (1111) ou sequência (1234, 4321). Recusada na criação. */
function senhaFacil(senha) {
  if (!formatoValido(senha)) return true;
  if (/^(\d)\1{3}$/.test(senha)) return true;
  return '0123456789'.includes(senha) || '9876543210'.includes(senha);
}

/** Um par é dois números diferentes de 0 a 9. */
function parValido(par) {
  return (
    Array.isArray(par) &&
    par.length === 2 &&
    par.every((d) => Number.isInteger(d) && d >= 0 && d <= 9) &&
    par[0] !== par[1]
  );
}

/** Quatro pares válidos? */
function paresValidos(pares) {
  return Array.isArray(pares) && pares.length === DIGITOS_DA_SENHA && pares.every(parValido);
}

/** A senha cabe nos pares tocados? Entrada malformada é sempre `false`. */
function conferePares(senha, pares) {
  if (!formatoValido(senha)) return false;
  if (!paresValidos(pares)) return false;
  return pares.every((par, i) => par.includes(Number(senha[i])));
}

/**
 * As 16 senhas que os pares descrevem, sem repetição. Pares malformados
 * devolvem `[]` — nunca uma lista parcial que alguém pudesse conferir.
 */
function candidatasDosPares(pares) {
  if (!paresValidos(pares)) return [];
  let parciais = [''];
  for (const par of pares) {
    const proximas = [];
    for (const p of parciais) for (const d of par) proximas.push(p + String(d));
    parciais = proximas;
  }
  return parciais;
}

/** Está trancado agora? `bloqueadoAteMs` ausente é "nunca trancou". */
function trancado({ bloqueadoAteMs, agoraMs }) {
  return Number.isFinite(bloqueadoAteMs) && agoraMs < bloqueadoAteMs;
}

/**
 * O estado depois de um ERRO. Com a espera vencida, a contagem recomeça do
 * zero (quem esperou o minuto ganha cinco tentativas, não uma).
 * Devolve `{ erros, bloqueadoAteMs, restam }`.
 */
function depoisDoErro({ erros, bloqueadoAteMs, agoraMs }) {
  const esperaVencida = Number.isFinite(bloqueadoAteMs) && agoraMs >= bloqueadoAteMs;
  const base = esperaVencida ? 0 : Math.max(0, Number(erros) || 0);
  const novo = base + 1;
  if (novo >= MAX_ERROS) {
    return { erros: novo, bloqueadoAteMs: agoraMs + ESPERA_MS, restam: 0 };
  }
  return { erros: novo, bloqueadoAteMs: null, restam: MAX_ERROS - novo };
}

/**
 * O login é recente o bastante para trocar uma senha que já existe?
 * `authTimeSeg` é o `auth_time` do token (em SEGUNDOS, como o Firebase manda).
 */
function loginRecente({ authTimeSeg, agoraMs }) {
  const t = Number(authTimeSeg);
  if (!Number.isFinite(t) || t <= 0) return false;
  const idade = agoraMs - t * 1000;
  return idade >= -60 * 1000 && idade <= LOGIN_RECENTE_MS;
}

module.exports = {
  DIGITOS_DA_SENHA,
  MAX_ERROS,
  ESPERA_MS,
  LOGIN_RECENTE_MS,
  formatoValido,
  senhaFacil,
  parValido,
  paresValidos,
  conferePares,
  candidatasDosPares,
  trancado,
  depoisDoErro,
  loginRecente,
};
