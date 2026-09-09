const admin = require('firebase-admin');
const { logger } = require('firebase-functions/v2');

/**
 * O RELÓGIO DOS TRÊS MESES — e os três gestos que o ligam.
 *
 * ── POR QUE ELE NÃO COMEÇA NO CADASTRO
 * Motorista escolar tem calendário. Contando do cadastro, quem conhece o app
 * em dezembro chega em fevereiro com três semanas de teste, e a primeira
 * experiência real dele é a tela de cobrança. Por isso o relógio espera o uso.
 *
 * ── E POR QUE "USO" NÃO É SÓ RODAR ROTA (06/09/2026)
 * Durante um dia inteiro o único gatilho foi a primeira rota — e isso deixou um
 * buraco de graça ilimitada, porque o app tem DUAS metades.
 *
 * Um motorista podia cadastrar a turma, mandar os convites, emitir contrato com
 * cada família, gerar mensalidade, cobrar por PIX e dar baixa — tudo isso para
 * sempre, sem tocar em "iniciar rota". `trialInicio` nunca existia, e
 * `trialCorrendo()` devolvia `true` eternamente. E a metade da cobrança é
 * justamente a que se usa com a perua parada.
 *
 * O erro não foi escolher a rota. Foi confundir ROTA com USO.
 *
 * ── OS TRÊS SINAIS, E O QUE VIER PRIMEIRO
 *
 *   primeira rota            a perua apareceu no mapa de uma família
 *   primeiro responsável     uma família passou a usar o app
 *   primeira mensalidade     o dinheiro dele passou por aqui
 *
 * Os três são "o produto entregou valor a alguém". Nenhum deles é o cadastro —
 * então o caso de dezembro continua protegido: ele se inscreve, não faz nada, e
 * nada conta.
 *
 * ── ESTE MÓDULO É DO SERVIDOR, E ISSO NÃO É DETALHE
 * A rota liga o relógio pelo cliente, e tem que ser assim: o GPS liga no
 * meio-fio, às vezes sem sinal, e esperar cold start com o passageiro na porta
 * é a regressão que a decisão 2 recusou.
 *
 * Os outros dois acontecem no servidor, com Admin SDK — que não passa por
 * rules. É o que permite ligar o relógio de OUTRA pessoa (o motorista) a partir
 * de um gesto do responsável, sem abrir nenhuma permissão nova.
 *
 * ── UMA VEZ, E NUNCA MAIS
 * A guarda é a mesma dos três lados: só grava se o campo não existe. Livre, o
 * campo reinicia o próprio teste para sempre — que é `limiteCriancas` com
 * outro nome. As rules garantem isso para o cliente; aqui a garantia é a
 * leitura antes da escrita, dentro da mesma transação quando há uma.
 */

/**
 * Liga o relógio do motorista, se ele ainda não estiver ligado.
 *
 * `tx` é a transação em curso, quando existe — passar por fora dela criaria a
 * janela em que dois gestos simultâneos escrevem dois `trialInicio` e o segundo
 * empurra a data para a frente.
 *
 * Devolve `true` se ligou agora. Nunca lança: o relógio do teste é problema da
 * plataforma, e nenhum dos três caminhos pode falhar por causa dele — a
 * família não pode deixar de resgatar um convite, nem a mensalidade deixar de
 * ser gerada, porque uma escrita de controle não deu certo.
 */
async function ligarRelogio(db, uid, motivo, tx = null) {
  if (!uid) return false;
  try {
    const ref = db.doc(`users/${uid}`);
    const snap = tx ? await tx.get(ref) : await ref.get();
    if (!deveLigar(snap)) return false;
    // Sem transação a escrita é AGUARDADA: em Cloud Functions, promessa solta
    // pode ser congelada com o processo e a escrita simplesmente não acontece.
    if (tx) tx.set(ref, valorDoRelogio(), { merge: true });
    else await ref.set(valorDoRelogio(), { merge: true });
    logger.info('[teste] relógio ligado', { uid, motivo });
    return true;
  } catch (err) {
    // Engolir é deliberado — ver o cabeçalho. O custo de errar aqui é o
    // motorista ganhar um dia a mais de teste; o custo de lançar é um convite
    // que não é resgatado.
    logger.error('[teste] não deu para ligar o relógio', { uid, motivo, err });
    return false;
  }
}

/**
 * ⚠️ A VERSÃO PARA QUEM JÁ ESTÁ DENTRO DE UMA TRANSAÇÃO COM ESCRITAS.
 *
 * ISTO EXISTE PORQUE O GATILHO DO CONVITE FICOU MORTO POR DIAS, SEM SINAL.
 *
 * `redeemInvite` chamava `ligarRelogio(..., tx)` DEPOIS de já ter feito
 * `tx.update(childRef, …)`. O Admin SDK exige que todas as leituras de uma
 * transação venham antes de todas as escritas, então o `tx.get()` daqui
 * lançava — e o `catch` acima, que é deliberadamente silencioso, engolia.
 *
 * O convite era resgatado normalmente e `trialInicio` NUNCA era gravado por
 * esse caminho. Ou seja: dos "três gatilhos" que o cabeçalho descreve,
 * sobraram dois, e metade do buraco de graça ilimitada voltou. Ninguém
 * sentiu nada, que é o pior desfecho possível.
 *
 * O conserto não é mover a chamada — é separar a LEITURA da ESCRITA, para que
 * quem chama possa ler junto das outras leituras dele. Assine assim:
 *
 *   const relogioSnap = await tx.get(db.doc(`users/${adminUid}`));  // fase 1
 *   …                                                              // escritas
 *   ligarRelogioComSnap(ref, relogioSnap, 'motivo', tx);           // fase 2
 *
 * Não é `async` de propósito: se voltar a ter `await` aqui, alguém a chamou de
 * um lugar que ainda lê depois de escrever.
 */
function ligarRelogioComSnap(ref, snap, motivo, tx) {
  try {
    if (!deveLigar(snap)) return false;
    tx.set(ref, valorDoRelogio(), { merge: true });
    logger.info('[teste] relógio ligado', { uid: ref.id, motivo });
    return true;
  } catch (err) {
    logger.error('[teste] não deu para ligar o relógio', {
      uid: ref?.id || null,
      motivo,
      err,
    });
    return false;
  }
}

/**
 * A DECISÃO, comum às duas portas — e ela é só leitura, de propósito.
 *
 * Separar a decisão da escrita é o que permite `ligarRelogioComSnap` existir
 * sem duplicar a regra do "uma vez e nunca mais".
 */
function deveLigar(snap) {
  // Sem documento não há o que ligar — e criar aqui seria criar conta por um
  // caminho que não é o de criar conta.
  if (!snap || !snap.exists) return false;
  if (snap.data()?.trialInicio) return false;
  return true;
}

function valorDoRelogio() {
  return { trialInicio: admin.firestore.FieldValue.serverTimestamp() };
}

module.exports = { ligarRelogio, ligarRelogioComSnap };
