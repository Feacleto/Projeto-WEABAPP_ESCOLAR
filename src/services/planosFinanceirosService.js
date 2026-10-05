import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { MAX_PLANOS, novoPlano } from '../dominio/cobranca/planosFinanceiros.js';

/**
 * OS PLANOS FINANCEIROS — onde moram (05/10/2026).
 *
 * Em `configFinanceiro/{uid}.planos`, uma lista de até 12, no mesmo documento
 * da reserva da perua: só o próprio motorista lê e escreve (rules). A lista é
 * reescrita inteira a cada mudança — é pequena, e quem escreve é sempre o
 * mesmo aparelho de uma pessoa. A régua (conta por mês, validação) é pura e
 * mora em `dominio/cobranca/planosFinanceiros.js`.
 *
 * ⚠️ É ANOTAÇÃO, NÃO CONTA: `separado` é o número que ele diz ter no banco,
 * SUBSTITUÍDO a cada anotação. O app nunca soma dinheiro de ninguém.
 */

function gravar(uid, planos) {
  if (!uid) throw new Error('Entre de novo para salvar.');
  return setDoc(doc(db, 'configFinanceiro', uid), { planos }, { merge: true });
}

export function criarPlano(uid, atuais, dados) {
  const lista = Array.isArray(atuais) ? atuais : [];
  if (lista.length >= MAX_PLANOS) throw new Error('São até 12 planos. Encerre um para criar outro.');
  return gravar(uid, [...lista, novoPlano(dados)]);
}

export function anotarNoPlano(uid, atuais, id, valor) {
  const n = Math.round(Number(String(valor).replace(',', '.')) * 100) / 100;
  if (!Number.isFinite(n) || n < 0) throw new Error('Diga um valor igual ou maior que zero.');
  const lista = (Array.isArray(atuais) ? atuais : []).map((p) => (p.id === id ? { ...p, separado: n } : p));
  return gravar(uid, lista);
}

export function encerrarPlano(uid, atuais, id) {
  return gravar(uid, (Array.isArray(atuais) ? atuais : []).filter((p) => p.id !== id));
}
