const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const { randomInt } = require('node:crypto');
const admin = require('firebase-admin');
const LIMITES = require('./limites');

const REGION = 'southamerica-east1';

/**
 * A ROLETA — sorteio decidido pelo SERVIDOR, girado ao CONTRATAR.
 *
 * ── ELA ERA DE ENTRADA, E MUDOU DE MOMENTO EM 06/09/2026
 * O arquivo anterior (`entryBonus.js`) dizia por que existia: *"o sistema está
 * em teste e o motorista não vai querer pagar desde o primeiro dia. A roleta é
 * o que faz ele entrar e USAR o app antes de existir cobrança"*.
 *
 * Esse papel passou a ser do TESTE DE TRÊS MESES. Com os dois no mesmo lugar,
 * a plataforma dava três meses grátis e sorteava mais um a quatro por cima —
 * até cinco meses e meio sem receita por associado, comprando algo que o teste
 * já comprava sozinho. Duas coisas grátis empilhadas na entrada não convencem
 * o dobro; só custam o dobro.
 *
 * Agora ela é prêmio de CONVERSÃO: gira quando ele fecha o contrato. O
 * momento faz o prêmio significar outra coisa — não é mais isca para
 * experimentar, é reconhecimento de quem decidiu.
 *
 * ── OS PRÊMIOS MUDARAM JUNTO, E DOIS DELES NÃO SÃO MESES
 * Eram 1, 2, 3 ou 4 meses sem taxa. Agora são dois meses sem taxa e dois
 * descontos que duram os 12 meses do contrato — porque o contrato passou a
 * ter prazo, e desconto com prazo é o instrumento que nasceu com ele.
 *
 * ── O SORTEIO NÃO PODE MORAR NO CLIENTE
 * Se o número sair no navegador, ele é escolhido por quem está no navegador.
 * Não precisa de má-fé: basta recarregar a página no meio da animação até sair
 * o melhor prêmio. E o pior caso não é ele ganhar um mês a mais — é a
 * plataforma não ter como saber o que foi concedido, porque o registro
 * dependeria da boa-fé do cliente em contar a verdade.
 *
 * O servidor sorteia, GRAVA, APLICA e só depois responde. A animação do
 * cliente encena um resultado que já existe.
 *
 * ── UMA VEZ POR CONTA, GARANTIDO PELO ID
 * O documento é `premios/{uid}` — o id É a conta. Duas chamadas simultâneas
 * não criam dois sorteios porque a transação falha na segunda. Quem já girou
 * recebe de volta o que tirou, com `novo: false`.
 *
 * ── O REGISTRO É DEFINITIVO, MAS O EFEITO É APLICADO
 * As rules proíbem create, update e delete de `premios` para TODOS — só o
 * Admin SDK escreve. Benefício que o beneficiário reescreve não é benefício.
 *
 * Só que o registro sozinho não vale nada: quem cobra é a fatura, e ela lê
 * `users.isencaoAte` e `users.descontos`. Então o sorteio e a APLICAÇÃO
 * acontecem na MESMA transação — separados, uma falha entre os dois deixaria
 * um prêmio registrado que nunca chegou na conta, e o motorista veria a
 * animação e pagaria cheio.
 */

/**
 * Os quatro prêmios e o peso de cada um.
 *
 * Pesos IGUAIS de propósito: 25% para cada. Está explícito porque é decisão de
 * negócio, não detalhe — mexer aqui muda quanto a plataforma abre mão por
 * associado convertido.
 *
 * `npm run testar:gateway` compara esta lista com `PREMIOS_DA_ROLETA` em
 * `src/dominio/associacao/planos.js`, que é o que a tela mostra. Divergir faria
 * a roleta prometer uma coisa e conceder outra.
 */
const PREMIOS = [
  { id: 'meses2', meses: 2, peso: 1 },
  { id: 'desconto30', fracao: 0.3, meses: 12, peso: 1 },
  { id: 'mes1', meses: 1, peso: 1 },
  { id: 'desconto10', fracao: 0.1, meses: 12, peso: 1 },
];

/**
 * Sorteio com `randomInt` do node, não com `Math.random`.
 *
 * `Math.random` não é criptográfico e o valor aqui vale dinheiro. Não é que
 * alguém vá prever a sequência do V8 na prática — é que não há razão para
 * escolher a versão frágil quando a robusta é a mesma linha.
 */
function sortear() {
  const total = PREMIOS.reduce((s, p) => s + p.peso, 0);
  let ponto = randomInt(0, total);
  for (const p of PREMIOS) {
    if (ponto < p.peso) return p;
    ponto -= p.peso;
  }
  // Inalcançável enquanto todo peso for >= 1; existe para não devolver
  // `undefined` caso alguém edite a lista e zere tudo.
  return PREMIOS[0];
}

/**
 * 'AAAA-MM' de N meses à frente, inclusive o mês atual.
 *
 * ⚠️ O DIA VAI PARA 1 ANTES DE SOMAR. `setMonth` preserva o dia, e 31 não
 * existe em todo mês: girar a roleta em 31/01 e tirar "2 meses sem taxa"
 * produzia 31/02, que o JavaScript normaliza para 03/03 — e `isentoEm` isenta
 * por comparação de texto, então janeiro, fevereiro E março. Três meses de
 * prêmio de dois, para quem girasse num dia 29, 30 ou 31.
 */
function mesDaqui(meses, agora = new Date()) {
  const d = new Date(agora);
  d.setDate(1);
  d.setMonth(d.getMonth() + meses - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function makeGirarPremio(db) {
  return onCall({ region: REGION, maxInstances: LIMITES.AUTENTICADO }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Login obrigatório.');

    const userRef = db.doc(`users/${uid}`);
    const premioRef = db.doc(`premios/${uid}`);

    const resultado = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const dados = userSnap.exists ? userSnap.data() : null;

      // Quem gira é MOTORISTA, e a checagem lê o doc em vez de confiar em algo
      // que venha do cliente. Sessão sem doc em `users` não passa daqui.
      if (!dados || dados.role !== 'admin') {
        throw new HttpsError('permission-denied', 'A roleta é do motorista associado.');
      }

      // ⚠️ É PRÊMIO DE CONVERSÃO: só gira quem já contratou uma faixa. Sem
      // esta linha ela voltaria a ser bônus de entrada, e todo mundo que
      // criasse conta levaria meses sem taxa antes de existir contrato — que
      // é exatamente o desenho que acabou de ser desfeito.
      if (!dados.planoId) {
        throw new HttpsError(
          'failed-precondition',
          'A roleta gira quando você contrata um plano.'
        );
      }

      const atual = await tx.get(premioRef);
      if (atual.exists) {
        const d = atual.data();
        return { premio: { id: d.premioId, meses: d.meses, fracao: d.fracao }, novo: false };
      }

      const premio = sortear();
      const agora = new Date();

      tx.set(premioRef, {
        uid,
        premioId: premio.id,
        meses: premio.meses ?? null,
        fracao: premio.fracao ?? null,
        // A régua usada NO MOMENTO do sorteio. Se os prêmios mudarem depois,
        // ainda dá para explicar de onde saiu este resultado — sem isso, um
        // sorteio antigo fica impossível de auditar contra a tabela nova.
        premiosNaEpoca: PREMIOS.map((p) => ({
          id: p.id,
          meses: p.meses ?? null,
          fracao: p.fracao ?? null,
          peso: p.peso,
        })),
        giradoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ── E O EFEITO, NA MESMA TRANSAÇÃO ────────────────────────────────
      //
      // O registro sozinho não cobra nada: quem cobra é a fatura, e ela lê
      // `users`. Separados, uma falha entre os dois deixaria um prêmio
      // registrado que nunca chegou na conta — ele veria a animação e pagaria
      // cheio no fim do mês.
      if (premio.fracao) {
        // Desconto com PRAZO. A lista é reescrita sem outro prêmio de roleta:
        // `arrayUnion` acumularia numa segunda chamada, e desconto duplicado
        // numa fatura é dinheiro que ninguém soma.
        const outros = (Array.isArray(dados.descontos) ? dados.descontos : []).filter(
          (d) => d?.origem !== 'roleta'
        );
        tx.set(
          userRef,
          {
            descontos: [
              ...outros,
              { origem: 'roleta', fracao: premio.fracao, ate: mesDaqui(premio.meses, agora) },
            ],
          },
          { merge: true }
        );
      } else {
        // Meses SEM FATURA. Isenção não é desconto de 100%: uma diz que o mês
        // não tem fatura, a outra produz fatura de R$ 0. Os dois chegam a zero
        // e contam histórias diferentes na hora de conferir o concedido.
        //
        // Se já houver isenção (nada concede duas hoje, mas amanhã pode), a
        // maior vence — nunca a última, que faria um prêmio menor apagar um
        // maior já concedido.
        const nova = mesDaqui(premio.meses, agora);
        const atualIsencao = dados.isencaoAte || '';
        tx.set(userRef, { isencaoAte: nova > atualIsencao ? nova : atualIsencao }, { merge: true });
      }

      return { premio, novo: true };
    });

    if (resultado.novo) {
      logger.info('[premio] girado', { uid, premio: resultado.premio.id });
    }

    return {
      premioId: resultado.premio.id,
      meses: resultado.premio.meses ?? null,
      fracao: resultado.premio.fracao ?? null,
      novo: resultado.novo,
      premios: PREMIOS.map((p) => ({ id: p.id, meses: p.meses ?? null, fracao: p.fracao ?? null })),
    };
  });
}

module.exports = { makeGirarPremio, PREMIOS, mesDaqui };
