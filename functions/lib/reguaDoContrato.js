/**
 * A RÉGUA DO CONTRATO DA FAMÍLIA, do lado do servidor — PURA, sem `require`
 * (a regra de `testar:imports`: régua não alcança o SDK).
 *
 * Espelho de `src/dominio/cobranca/contratoDaFamilia.js`. O deploy das
 * functions não alcança `src/`, e `npm run testar:combinado` compara as duas
 * caso a caso.
 */

/**
 * JSON com as chaves em ordem. O Firestore não devolve um mapa na ordem em que
 * foi gravado, e o hash do aceite precisa sair igual em qualquer releitura —
 * senão ele não prova nada.
 */
function jsonCanonico(valor) {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor ?? null);
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  const chaves = Object.keys(valor).filter((k) => valor[k] !== undefined).sort();
  return `{${chaves.map((k) => `${JSON.stringify(k)}:${jsonCanonico(valor[k])}`).join(',')}}`;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O QUE O ADITIVO PODE MUDAR NA CRIANÇA quando a família aceita — e só isso.
 *
 * O aditivo é escrito pelo MOTORISTA, e o servidor aplica os valores com Admin
 * SDK (que ignora as rules). Sem esta lista fechada, um `novosValores` com
 * `parentUid` ou `adminUid` dentro seria aplicado no aceite de outra pessoa.
 */
function valoresDoAditivo(novos) {
  const out = {};
  if (!novos || typeof novos !== 'object') return out;
  const fee = Number(novos.monthlyFee);
  if (Number.isFinite(fee) && fee >= 0) out.monthlyFee = Math.round(fee * 100) / 100;
  const dia = Math.round(Number(novos.dueDay));
  if (Number.isFinite(dia) && dia >= 1 && dia <= 28) out.dueDay = dia;
  if (DATA.test(String(novos.vigenciaInicio || ''))) out.vigenciaInicio = novos.vigenciaInicio;
  if (DATA.test(String(novos.vigenciaFim || ''))) out.vigenciaFim = novos.vigenciaFim;
  return out;
}

module.exports = { jsonCanonico, valoresDoAditivo };
