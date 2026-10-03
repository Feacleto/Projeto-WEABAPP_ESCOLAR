// `FieldValue` pelo caminho modular (03/10/2026): `admin.firestore.FieldValue`
// chegava `undefined` no emulador — derrubou o `redeemInvite` no teste R1.
const { FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions/v2');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { cobrancaLigada } = require('./cobrancaLigada');
const { decidirRelogio } = require('./reguaDoRelogio');
const LIMITES = require('./limites');

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
 * ── ESTE MÓDULO É DO SERVIDOR, E DESDE 03/10/2026 OS TRÊS GATILHOS TAMBÉM
 * A rota ligava o relógio pelo CLIENTE (`trialService.ligarRelogioDoTrial`),
 * com o argumento de não esperar cold start no meio-fio. O preço era o campo
 * ficar gravável pelo motorista — uma vez, mas por ele, e com a data que o
 * aparelho dele mandasse dentro da janela das rules. Hoje o cliente só liga o
 * GPS; a escrita em `liveLocation/{uid}` com `routeActive: true` dispara
 * `relogioNaRota.js`, que chama `ligarRelogio` daqui. O meio-fio não espera
 * nada: o gatilho roda depois, sozinho, e a rota já começou.
 *
 * Os outros dois (primeiro responsável, primeira mensalidade) sempre
 * aconteceram aqui, com Admin SDK — que não passa por rules.
 *
 * ── A CÓPIA EM `taxaParceiros/{uid}.trialInicio`
 * Toda vez que o relógio liga, a data vai também para `taxaParceiros`, que só
 * o dono lê. Sem ela, o motorista que apaga e recria o próprio documento em
 * `users` ganharia um teste novo. `makeRestaurarRelogio` devolve a data ao
 * documento recriado. A decisão (qual das duas vale) é pura e mora em
 * `reguaDoRelogio.js`.
 *
 * ⚠️ E QUEM ZERAR O RELÓGIO DA BASE ANTES DE RELIGAR A COBRANÇA
 * (docs/estrutura-de-cobranca.md, "Para religar depois") precisa apagar as
 * DUAS cópias — senão a próxima rota restaura a data antiga.
 *
 * ── UMA VEZ, E NUNCA MAIS
 * A guarda é a mesma dos três lados: só grava se o campo não existe. Livre, o
 * campo reinicia o próprio teste para sempre — que é `limiteCriancas` com
 * outro nome. As rules garantem isso para o cliente; aqui a garantia é a
 * leitura antes da escrita, dentro da mesma transação quando há uma.
 */

/**
 * Liga o relógio do motorista, se ele ainda não estiver ligado — e mantém a
 * cópia de `taxaParceiros` em dia com ele.
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
  // ⚠️ COM A COBRANÇA DESLIGADA O TESTE NÃO COMEÇA. Senão os 90 dias correriam
  // durante a fase grátis e, no dia em que a cobrança voltasse, todo mundo
  // estaria vencido de uma vez. Ver lib/cobrancaLigada.js.
  //
  // A chave vem ANTES das leituras de propósito: `billing.js` chama isto uma
  // vez por criança por mês, e com a cobrança desligada o custo continua
  // sendo uma leitura só. A restauração da cópia não depende daqui — ela mora
  // no gatilho de criação de `users` (`makeRestaurarRelogio`).
  if (!(await cobrancaLigada(db))) return false;
  try {
    const ref = db.doc(`users/${uid}`);
    const copiaRef = db.doc(`taxaParceiros/${uid}`);
    const [snap, copiaSnap] = tx ? await tx.getAll(ref, copiaRef) : await db.getAll(ref, copiaRef);
    // Sem documento não há o que ligar — e criar aqui seria criar conta por um
    // caminho que não é o de criar conta.
    if (!snap.exists) return false;

    const noUsuario = snap.data()?.trialInicio || null;
    const naCopia = copiaSnap.exists ? copiaSnap.data()?.trialInicio || null : null;
    const decisao = decidirRelogio({ noUsuario, naCopia, podeComecar: true });

    // Sem transação as escritas são AGUARDADAS: em Cloud Functions, promessa
    // solta pode ser congelada com o processo e a escrita simplesmente não
    // acontece. As duas vão no mesmo lote para não existir a data em um lado
    // só.
    const escritas = escritasDoRelogio(ref, copiaRef, decisao, { noUsuario, naCopia });
    if (!escritas.length) return false;
    if (tx) escritas.forEach(([r, v]) => tx.set(r, v, { merge: true }));
    else {
      const lote = db.batch();
      escritas.forEach(([r, v]) => lote.set(r, v, { merge: true }));
      await lote.commit();
    }

    const ligou = decisao.usuario === 'agora';
    if (ligou) logger.info('[teste] relógio ligado', { uid, motivo });
    else logger.info('[teste] relógio conferido com a cópia', { uid, motivo, decisao });
    return ligou;
  } catch (err) {
    // Engolir é deliberado — ver o cabeçalho. O custo de errar aqui é o
    // motorista ganhar um dia a mais de teste; o custo de lançar é um convite
    // que não é resgatado.
    logger.error('[teste] não deu para ligar o relógio', { uid, motivo, err });
    return false;
  }
}

/** Traduz a decisão da régua em pares `[ref, dados]` para `set(merge)`. */
function escritasDoRelogio(ref, copiaRef, decisao, { noUsuario, naCopia }) {
  const valor = (de) =>
    de === 'agora' ? FieldValue.serverTimestamp() : de === 'copia' ? naCopia : noUsuario;
  const escritas = [];
  if (decisao.usuario) escritas.push([ref, { trialInicio: valor(decisao.usuario) }]);
  if (decisao.copia) escritas.push([copiaRef, { trialInicio: valor(decisao.copia) }]);
  return escritas;
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
    // ⚠️ A CÓPIA VAI JUNTO, SEM SER LIDA. Ler `taxaParceiros` aqui exigiria
    // que os dois chamadores (`invites.js`, `pedidosDeAcesso.js`) a lessem na
    // fase de leituras deles. O resíduo é estreito e fica escrito: se o
    // motorista recriar o documento E um responsável entrar nos segundos
    // antes de `makeRestaurarRelogio` rodar, a data antiga da cópia é
    // sobrescrita e o teste recomeça. Fechar isso é passar o snapshot da
    // cópia por estes dois chamadores.
    tx.set(ref.firestore.doc(`taxaParceiros/${ref.id}`), valorDoRelogio(), { merge: true });
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
  return { trialInicio: FieldValue.serverTimestamp() };
}

/**
 * O DOCUMENTO DO MOTORISTA FOI (RE)CRIADO — a data do teste volta da cópia.
 *
 * O motorista sem crianças ativas pode apagar o próprio `users/{uid}`, e a
 * sessão continua de pé: o "sou motorista" da `/comecar` cria o documento de
 * novo, sem `trialInicio`. Sem esta restauração, apagar e recriar seria um
 * teste de 90 dias novo a cada vez.
 *
 * ⚠️ NÃO DEPENDE DA CHAVE DA COBRANÇA: devolver uma data que já existia não é
 * ligar o relógio. E nunca LIGA nada — o cadastro não é uso (ver o cabeçalho).
 *
 * Roda para qualquer papel porque só quem já foi motorista tem a cópia; para
 * o resto, é uma leitura e nada mais.
 */
async function restaurarRelogio(db, uid) {
  if (!uid) return false;
  try {
    const copia = await db.doc(`taxaParceiros/${uid}`).get();
    const naCopia = copia.exists ? copia.data()?.trialInicio || null : null;
    if (!naCopia) return false;
    // Relê o documento em vez de confiar no evento: entre a criação e agora,
    // outro gatilho pode ter ligado o relógio.
    return await db.runTransaction(async (tx) => {
      const ref = db.doc(`users/${uid}`);
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const decisao = decidirRelogio({
        noUsuario: snap.data()?.trialInicio || null,
        naCopia,
        podeComecar: false,
      });
      if (decisao.usuario !== 'copia') return false;
      tx.set(ref, { trialInicio: naCopia }, { merge: true });
      logger.info('[teste] relógio restaurado da cópia', { uid });
      return true;
    });
  } catch (err) {
    // Mesmo motivo do gatilho de indicação: isto roda na criação da conta, o
    // gesto mais crítico do produto. Falhar aqui custa um teste a mais a quem
    // recriou a conta; lançar não desfaz nada.
    logger.error('[teste] não deu para restaurar o relógio', { uid, err });
    return false;
  }
}

function makeRestaurarRelogio(db) {
  return onDocumentCreated(
    { document: 'users/{uid}', region: 'southamerica-east1', maxInstances: LIMITES.GATILHO },
    async (event) => {
      if (!(event.data && event.data.data())) return;
      await restaurarRelogio(db, event.params.uid);
    }
  );
}

module.exports = { ligarRelogio, ligarRelogioComSnap, restaurarRelogio, makeRestaurarRelogio };
