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

/**
 * ⚠️ A COBRANÇA RESPEITA A VIGÊNCIA (03/10/2026).
 *
 * `generateMonthlyPayments` cobrava todo mês de toda criança ativa — antes do
 * início do contrato e depois do fim. Em janeiro, toda família com contrato
 * até 31/12 recebia uma mensalidade que o documento assinado não prevê.
 *
 * O mês é cobrável quando cai entre a 1ª e a última PARCELA: a contagem é a
 * de `parcelasDaVigencia` (meses de serviço, mês começado conta inteiro),
 * espelhada aqui porque o deploy das functions não alcança `src/`.
 * `testar:combinado` compara as duas. Sem vigência gravada (criança anterior
 * ao campo), o mês é cobrável — como sempre foi.
 */
function partes(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(a, me - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== me - 1 || dt.getDate() !== d) return null;
  return { a, me, d };
}

function parcelasDaVigencia(inicio, fim) {
  const i = partes(inicio);
  const f = partes(fim);
  if (!i || !f || fim < inicio) return 0;
  const depois = new Date(f.a, f.me - 1, f.d + 1);
  let n = (depois.getFullYear() - i.a) * 12 + (depois.getMonth() + 1 - i.me);
  if (depois.getDate() > i.d) n += 1;
  return n > 0 ? n : 0;
}

function mesDentroDaVigencia(mesAAAAMM, inicio, fim) {
  const i = partes(inicio);
  if (!i || !partes(fim)) return true;
  const [a, me] = String(mesAAAAMM).split('-').map(Number);
  const indice = (a - i.a) * 12 + (me - i.me);
  return indice >= 0 && indice < parcelasDaVigencia(inicio, fim);
}

module.exports = { jsonCanonico, valoresDoAditivo, parcelasDaVigencia, mesDentroDaVigencia };
