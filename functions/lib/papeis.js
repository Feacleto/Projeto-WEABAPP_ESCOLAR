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
 * responsável.", "A faixa é do motorista associado."). Copiado não é o
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
 * O LEGADO `superAdmin` SAIU EM 06/09/2026, junto com o do cliente.
 * Ele existia porque a conta do dono do projeto ANTIGO nasceu como motorista
 * com a flag por cima. Esse projeto foi excluído, a base é zero e a conta de
 * dono ainda vai ser criada — a única janela em que o fallback podia sair sem
 * trancar ninguém. Ponte que ninguém atravessa vira porta dos fundos.
 *
 * ⚠️ A conta de dono precisa nascer com `role: 'owner'`.
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

/** É o dono da plataforma? Pode haver mais de um. */
function ehDono(dados) {
  return dados?.role === 'owner';
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
      'Esta ação é do motorista assinante.'
    );
  }
  return uid;
}

/**
 * Exige MOTORISTA ou AUXILIAR e devolve o uid de quem chamou (05/10/2026).
 *
 * Só a senha de 4 números usa isto: a do motorista protege o Financeiro, a
 * da auxiliar protege os pagamentos DELA. É a mesma peça (hash em
 * `senhasDoFinanceiro/{uid}`, sempre o documento de quem chamou), então
 * duplicar as callables seria duplicar a régua das tentativas.
 *
 * ⚠️ A auxiliar passa MESMO COM O VÍNCULO DESATIVADO: os pagamentos dela
 * continuam dela depois que o motorista encerra o acesso, e a senha é o que
 * os abre.
 */
async function exigirMotoristaOuAuxiliar(db, request) {
  const { uid, dados } = await carregarUsuario(db, request);
  if (!ehMotorista(dados) && dados?.role !== 'auxiliar') {
    throw new HttpsError(
      'permission-denied',
      'Esta ação é do motorista ou da auxiliar.'
    );
  }
  return uid;
}

/**
 * Exige AUXILIAR e devolve o uid dela (05/10/2026, as avaliações entre ela e
 * o tio). Passa com o vínculo desativado: a recomendação e a nota continuam
 * dela depois que o acesso à perua acaba — quem confere o PAR é a callable.
 */
async function exigirAuxiliar(db, request) {
  const { uid, dados } = await carregarUsuario(db, request);
  if (dados?.role !== 'auxiliar') {
    throw new HttpsError('permission-denied', 'Esta ação é da auxiliar.');
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

module.exports = { carregarUsuario, exigirMotorista, exigirMotoristaOuAuxiliar, exigirAuxiliar, exigirDono, ehDono, ehMotorista };
