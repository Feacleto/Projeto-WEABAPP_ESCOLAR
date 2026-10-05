/**
 * A SENHA DO FINANCEIRO — criar e conferir (03/10/2026).
 *
 * A auxiliar usa o celular do motorista, com a sessão dele, e não deve ver os
 * valores. O Financeiro ganhou uma senha de 4 números digitada num teclado de
 * banco (cinco botões, dois números cada). A régua — formato, senha fácil,
 * pares, as 16 candidatas, as tentativas — é pura e mora em
 * `reguaDaSenhaDoFinanceiro.js`; aqui só o que precisa do SDK e do `crypto`.
 *
 * ── ONDE A SENHA MORA
 * `senhasDoFinanceiro/{uid}` = { hash, sal, criadaEm, erros, bloqueadoAte }.
 * As rules fecham a coleção para TODO cliente (`allow read, write: if false`):
 * só o Admin SDK alcança. Nunca em `users`, que as famílias leem inteiro.
 * O hash é scrypt com sal aleatório de 16 bytes; a senha nunca é gravada.
 * ⚠️ São 10 mil senhas possíveis: o hash forte não torna um VAZAMENTO do
 * documento inofensivo (testar todas custa minutos), ele só tira a senha do
 * texto puro. O que protege é a coleção ser inalcançável.
 *
 * ── É CORTINA, NÃO COFRE
 * Para o Firestore, a auxiliar e o motorista são a mesma conta. A senha
 * impede que ela VEJA o Financeiro na tela; não impede quem abre as
 * ferramentas do navegador de ler `payments`. A separação de verdade é a
 * conta própria da auxiliar.
 *
 * ── O ESCOPO É O UID AUTENTICADO
 * Nenhum id do payload vira caminho: o documento é sempre o de quem chamou
 * (`exigirMotoristaOuAuxiliar` devolve o uid). Por isso não há `idValido`.
 *
 * ── A AUXILIAR USA A MESMA PEÇA (05/10/2026, fase 4)
 * Com conta própria, a auxiliar ganhou a aba "Pagamentos" — o que o motorista
 * anotou que pagou a ELA — protegida pela senha DELA, no mesmo teclado de
 * banco. Mesmas callables, mesmo documento por uid: a senha dela mora em
 * `senhasDoFinanceiro/{uidDela}` e o `temSenha` em `configFinanceiro/{uidDela}`
 * (as rules deixam a auxiliar ler o próprio). Duas callables novas seriam a
 * régua das tentativas copiada, e a cópia é a que fica para trás.
 */

'use strict';

const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const LIMITES = require('./limites');
const { exigirMotoristaOuAuxiliar } = require('./papeis');
const {
  formatoValido,
  senhaFacil,
  paresValidos,
  candidatasDosPares,
  trancado,
  depoisDoErro,
  loginRecente,
  MAX_ERROS,
} = require('./reguaDaSenhaDoFinanceiro');

const REGION = 'southamerica-east1';
const COLECAO = 'senhasDoFinanceiro';
const TAMANHO_DO_HASH = 32;
// N = 2^14 é o padrão do Node. A conferência calcula 16 hashes por chamada,
// em série: subir o custo aqui multiplica por 16 a espera de quem tocou.
const PARAMETROS = Object.freeze({ N: 16384, r: 8, p: 1 });
const MENSAGEM_DE_ESPERA = 'Muitas tentativas. Aguarde 1 minuto.';

function hashDe(senha, sal) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(senha, sal, TAMANHO_DO_HASH, PARAMETROS, (err, chave) =>
      err ? reject(err) : resolve(chave)
    );
  });
}

function msDe(valor) {
  if (!valor) return null;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  if (valor instanceof Date) return valor.getTime();
  return Number.isFinite(valor) ? valor : null;
}

function makeCriarSenhaDoFinanceiro(db) {
  return onCall(
    { ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO },
    async (request) => {
      const uid = await exigirMotoristaOuAuxiliar(db, request);
      const senha = request.data?.senha;
      if (!formatoValido(senha)) {
        throw new HttpsError('invalid-argument', 'A senha tem 4 números.');
      }
      if (senhaFacil(senha)) {
        throw new HttpsError(
          'invalid-argument',
          'Essa senha é fácil de adivinhar. Evite números iguais ou em sequência.'
        );
      }

      const ref = db.doc(`${COLECAO}/${uid}`);
      const atual = await ref.get();
      // Trocar uma senha que existe é o "esqueci a senha": sem esta exigência,
      // a auxiliar com o celular na mão trocaria a senha do motorista sem
      // nunca ter sabido a antiga. A tela pede a senha da CONTA antes.
      if (atual.exists && atual.data()?.hash) {
        const ok = loginRecente({
          authTimeSeg: request.auth?.token?.auth_time,
          agoraMs: Date.now(),
        });
        if (!ok) {
          throw new HttpsError(
            'failed-precondition',
            'Para trocar a senha, entre de novo na sua conta.'
          );
        }
      }

      const sal = crypto.randomBytes(16);
      const hash = await hashDe(senha, sal);
      const lote = db.batch();
      // `set` sem merge: troca o hash e ZERA as tentativas na mesma escrita.
      lote.set(ref, {
        hash: hash.toString('base64'),
        sal: sal.toString('base64'),
        algoritmo: 'scrypt',
        parametros: { ...PARAMETROS },
        criadaEm: FieldValue.serverTimestamp(),
        erros: 0,
        bloqueadoAte: null,
      });
      lote.set(db.doc(`configFinanceiro/${uid}`), { temSenha: true }, { merge: true });
      await lote.commit();
      return { ok: true };
    }
  );
}

function makeConferirSenhaDoFinanceiro(db) {
  return onCall(
    { ...LIMITES.APP_CHECK, region: REGION, maxInstances: LIMITES.AUTENTICADO },
    async (request) => {
      const uid = await exigirMotoristaOuAuxiliar(db, request);
      // O "acordar" da tela trancada (04/10/2026): só liga a function, não
      // confere nada e não conta tentativa. Ver aquecerSenhaDoFinanceiro.
      if (request.data?.aquecer === true) return { aquecida: true };
      const pares = request.data?.pares;
      if (!paresValidos(pares)) {
        throw new HttpsError('invalid-argument', 'Toque os quatro números da senha.');
      }

      const ref = db.doc(`${COLECAO}/${uid}`);
      const snap = await ref.get();
      const doc = snap.exists ? snap.data() : null;
      if (!doc?.hash || !doc?.sal) {
        throw new HttpsError('failed-precondition', 'Crie a senha primeiro.');
      }
      if (trancado({ bloqueadoAteMs: msDe(doc.bloqueadoAte), agoraMs: Date.now() })) {
        throw new HttpsError('resource-exhausted', MENSAGEM_DE_ESPERA);
      }

      // As 16 senhas que os pares descrevem, todas calculadas (sem sair na
      // primeira que bate: o tempo da resposta não diz em qual posição estava).
      const sal = Buffer.from(doc.sal, 'base64');
      const guardado = Buffer.from(doc.hash, 'base64');
      let bateu = false;
      for (const candidata of candidatasDosPares(pares)) {
        const h = await hashDe(candidata, sal);
        if (h.length === guardado.length && crypto.timingSafeEqual(h, guardado)) bateu = true;
      }

      // O contador é relido na transação: dois toques simultâneos não podem
      // contar um erro só.
      return db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        const d = s.exists ? s.data() : {};
        const agoraMs = Date.now();
        if (bateu) {
          if ((Number(d.erros) || 0) > 0 || d.bloqueadoAte) {
            tx.update(ref, { erros: 0, bloqueadoAte: null });
          }
          return { ok: true };
        }
        const bloqueadoAteMs = msDe(d.bloqueadoAte);
        if (trancado({ bloqueadoAteMs, agoraMs })) {
          throw new HttpsError('resource-exhausted', MENSAGEM_DE_ESPERA);
        }
        const novo = depoisDoErro({ erros: d.erros, bloqueadoAteMs, agoraMs });
        tx.update(ref, {
          erros: novo.erros,
          bloqueadoAte: novo.bloqueadoAteMs ? new Date(novo.bloqueadoAteMs) : null,
        });
        return { ok: false, restam: novo.restam, max: MAX_ERROS };
      });
    }
  );
}

module.exports = { makeCriarSenhaDoFinanceiro, makeConferirSenhaDoFinanceiro };
