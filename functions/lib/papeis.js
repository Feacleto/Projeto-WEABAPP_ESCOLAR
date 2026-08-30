/**
 * OS PAPÉIS, DO LADO DO SERVIDOR — o espelho de `src/utils/papeis.js`.
 *
 * A ARMADILHA É A MESMA DOS DOIS LADOS
 * `role: 'admin'` significa MOTORISTA, não administrador. Quem administra a
 * plataforma é `role: 'owner'`. Ler isso errado inverte todo raciocínio de
 * permissão — e aqui inverteu de verdade, três vezes.
 *
 * POR QUE ISTO VIROU MÓDULO
 * O portão de papel estava copiado em quatro callables, com quatro mensagens
 * diferentes para a mesma recusa ("Apenas admin.", "Apenas o motorista
 * responsável.", "A roleta é do motorista associado."). Copiado não é o
 * problema; copiado e DIVERGENTE é: uma das quatro cópias guardava uma função
 * do DONO exigindo papel de MOTORISTA.
 *
 * `backfillTestimonialPrivacy` é chamada de `/admin` — a tela do dono — e
 * pedia `role === 'admin'`. Ou seja: o motorista podia reescrever a
 * privacidade dos depoimentos públicos de todo mundo, e o dono só conseguia
 * porque a conta dele ainda é `admin` + `superAdmin`. No dia da migração para
 * `role: 'owner'` que `src/utils/papeis.js` descreve, o dono perderia o acesso
 * e o motorista manteria — o pior resultado possível dos dois.
 *
 * O LEGADO `superAdmin` É ACEITO AQUI PELO MESMO MOTIVO DO CLIENTE
 * A conta do dono não tem outra prova até a migração manual pelo console, e
 * `superAdmin` está entre as chaves que nenhum cliente escreve (as rules
 * proíbem). Documento que tem esse campo recebeu do console ou do Admin SDK.
 */

const { HttpsError } = require('firebase-functions/v2/https');

/** Lê o doc do usuário autenticado. Lança se não houver sessão. */
async function carregarUsuario(db, request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login obrigatório.');

  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) {
    // Conta de Auth sem doc em `users` é conta órfã — não é "sem permissão",
    // é "sem cadastro". A mensagem separa os dois casos para quem for depurar.
    throw new HttpsError('permission-denied', 'Conta sem cadastro no app.');
  }
  return { uid, dados: snap.data() };
}

/** É o dono da plataforma? Aceita o legado `superAdmin`. */
function ehDono(dados) {
  return dados?.role === 'owner' || dados?.superAdmin === true;
}

/** É motorista (opera uma perua)? */
function ehMotorista(dados) {
  return dados?.role === 'admin';
}

/**
 * Exige MOTORISTA e devolve o uid dele.
 *
 * O uid volta porque quem chama precisa dele para ESCOPAR a operação: uma
 * callable de motorista não pode agir sobre a base dos outros parceiros, e o
 * escopo tem que sair do chamador — nunca de um campo do payload, que é
 * exatamente como se passa por outro.
 */
async function exigirMotorista(db, request) {
  const { uid, dados } = await carregarUsuario(db, request);
  if (!ehMotorista(dados)) {
    throw new HttpsError(
      'permission-denied',
      'Esta ação é do motorista associado.'
    );
  }
  return uid;
}

/** Exige o DONO DA PLATAFORMA e devolve o uid dele. */
async function exigirDono(db, request) {
  const { uid, dados } = await carregarUsuario(db, request);
  if (!ehDono(dados)) {
    throw new HttpsError(
      'permission-denied',
      'Esta ação é do dono da plataforma.'
    );
  }
  return uid;
}

module.exports = { exigirMotorista, exigirDono, ehDono, ehMotorista };
