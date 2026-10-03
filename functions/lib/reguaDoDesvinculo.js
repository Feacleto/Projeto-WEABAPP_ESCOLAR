/**
 * QUEM PODE SER DESVINCULADO DE UMA CRIANÇA (03/10/2026) — régua pura.
 *
 * `desvincularResponsavel` pode APAGAR uma conta inteira, e ela já apagou a
 * conta errada: o `parentUid` da criança é escrito por quem a cadastrou (o
 * motorista), então confiar só nele é deixar o motorista escolher quem some.
 * O alvo precisa ser RESPONSÁVEL e ter ESTA criança na lista que só o
 * servidor mantém (`childIds`, ou o `childId` legado). Conta de motorista ou
 * de dono nunca passa.
 *
 * PURA: sem `require` — `testar:irmaos` a importa direto.
 */

'use strict';

function podeDesvincular(familia, childId) {
  if (!familia || familia.role !== 'parent') return false;
  if (typeof childId !== 'string' || !childId) return false;
  const lista = Array.isArray(familia.childIds) ? familia.childIds : [];
  return lista.includes(childId) || familia.childId === childId;
}

module.exports = { podeDesvincular };
